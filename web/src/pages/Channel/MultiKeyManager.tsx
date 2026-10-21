import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Modal, Pagination, Select, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';

const keySchema = z.object({ index: z.number().int().nonnegative(), status: z.number().int().min(1).max(3), key_preview: z.string(), disabled_time: z.number().optional(), reason: z.string().optional() });
const snapshotSchema = z.object({ revision: z.string().min(1), keys: z.array(keySchema).nullable(), total: z.number().int().nonnegative(), page: z.number().int().positive(), page_size: z.number().int().positive(), total_pages: z.number().int().positive(), enabled_count: z.number().int().nonnegative(), manual_disabled_count: z.number().int().nonnegative(), auto_disabled_count: z.number().int().nonnegative() });
type KeyRow = z.infer<typeof keySchema>;
type Action = 'disable_key' | 'enable_key' | 'delete_key' | 'delete_disabled_keys' | 'enable_all_keys' | 'disable_all_keys';
type Confirmation = { action: Action; index?: number; revision: string; title: string; description: string };
type Props = { channel: { id: number; name: string }; onClose: () => void; onChanged: () => void };

export default function MultiKeyManager({ channel, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const canOperate = hasPermission(user, 'channel', 'operate');
  const canDelete = canOperate && hasPermission(user, 'channel', 'sensitive_write');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const lifetime = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner;
    return () => { owner.abort(); lifetime.current = null; };
  }, [user?.id, channel.id]);
  const query = useQuery({
    queryKey: ['channel-multi-keys', user?.id, channel.id, page, status],
    enabled: canOperate,
    queryFn: async ({ signal }) => {
      const { data } = await API.post('/api/channel/multi_key/manage', { channel_id: channel.id, action: 'get_key_status', page, page_size: 20, ...(status !== 'all' ? { status: Number(status) } : {}) }, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message ? t(data.message) : t('Unable to load key status'));
      const parsed = snapshotSchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Invalid key-status response'));
      return parsed.data;
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const snapshot = query.data;
  const disabled = busy || query.isFetching || !query.isSuccess;
  useEffect(() => { if (snapshot && snapshot.page !== page) setPage(snapshot.page); }, [snapshot, page]);
  const request = (action: Action, row?: KeyRow) => {
    if (disabled || !snapshot || !canOperate || (action.startsWith('delete') && !canDelete)) return;
    const title = row ? `${t(action === 'delete_key' ? 'Delete key' : action === 'enable_key' ? 'Enable key' : 'Disable key')} #${row.index + 1}?`
      : t(action === 'delete_disabled_keys' ? 'Delete automatically disabled keys?' : action === 'enable_all_keys' ? 'Enable all keys?' : 'Disable all enabled keys?');
    setFeedback(undefined);
    setConfirmation({ action, index: row?.index, revision: snapshot.revision, title, description: t(action === 'delete_disabled_keys' ? 'Manually disabled keys are retained. The last key cannot be deleted.' : action === 'delete_key' ? 'The selected key will be removed from this channel. The last key cannot be deleted.' : 'This changes the keys available for future requests.') });
  };
  const apply = async () => {
    const owner = lifetime.current;
    if (!confirmation || !owner || owner.signal.aborted || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { data } = await API.post('/api/channel/multi_key/manage', { channel_id: channel.id, action: confirmation.action, key_index: confirmation.index, expected_revision: confirmation.revision }, { signal: owner.signal, skipErrorHandler: true });
      owner.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message ? t(data.message) : t('Key operation failed'));
      setFeedback({ error: false, message: t('Key settings updated') });
      onChanged();
    } catch (error) {
      if (!owner.signal.aborted) setFeedback({ error: true, message: error instanceof Error ? error.message : t('Key operation failed') });
    } finally {
      if (!owner.signal.aborted) {
        setConfirmation(null);
        await query.refetch();
        if (!owner.signal.aborted) { lock.current = false; setBusy(false); }
      }
    }
  };
  const columns: TableColumn<KeyRow>[] = [
    { key: 'index', title: '#', render: (row) => row.index + 1 },
    { key: 'key_preview', title: t('Key preview'), render: (row) => <code className='break-all'>{row.key_preview}</code> },
    { key: 'status', title: t('Status'), render: (row) => t(row.status === 1 ? 'Enabled' : row.status === 2 ? 'Manually disabled' : 'Automatically disabled') },
    { key: 'reason', title: t('Disabled reason'), render: (row) => <span className='break-words'>{row.reason === 'Manually disabled' ? t(row.reason) : row.reason || '—'}</span> },
    { key: 'disabled_time', title: t('Disabled at'), render: (row) => row.disabled_time ? new Date(row.disabled_time * 1000).toLocaleString(i18n.language) : '—' },
    { key: 'actions', mobileRole: 'actions' as const, title: t('Actions'), render: (row) => <div className='flex gap-1'>
      <Button size='sm' variant='secondary' disabled={disabled || !canOperate} onClick={() => request(row.status === 1 ? 'disable_key' : 'enable_key', row)}>{t(row.status === 1 ? 'Disable' : 'Enable')}</Button>
      {canDelete && <Button size='sm' variant='secondary' disabled={disabled || (snapshot?.enabled_count ?? 0) + (snapshot?.manual_disabled_count ?? 0) + (snapshot?.auto_disabled_count ?? 0) <= 1} onClick={() => request('delete_key', row)}>{t('Delete')}</Button>}
    </div> },
  ];
  const close = () => { if (!lock.current && !confirmation) onClose(); };
  return <>
    <Modal open title={`${t('Manage channel keys')} · ${channel.name}`} width={1000} onClose={close} onConfirm={close} footer={<Button disabled={busy} onClick={close}>{t('Close')}</Button>}>
      <div className='flex flex-wrap gap-2 items-center'>
        <Select value={status} disabled={busy} onChange={(value) => { setStatus(value); setPage(1); }} width={180} options={[
          { value: 'all', label: t('All statuses') }, { value: '1', label: t('Enabled') }, { value: '2', label: t('Manually disabled') }, { value: '3', label: t('Automatically disabled') },
        ]} />
        <Button size='sm' variant='secondary' disabled={busy || query.isFetching} onClick={() => void query.refetch()}>{t('Refresh')}</Button>
        <Button size='sm' variant='secondary' disabled={disabled || !((snapshot?.manual_disabled_count ?? 0) + (snapshot?.auto_disabled_count ?? 0))} onClick={() => request('enable_all_keys')}>{t('Enable all keys')}</Button>
        <Button size='sm' variant='secondary' disabled={disabled || !snapshot?.enabled_count} onClick={() => request('disable_all_keys')}>{t('Disable all enabled keys')}</Button>
        {canDelete && <Button size='sm' variant='secondary' disabled={disabled || !snapshot?.auto_disabled_count} onClick={() => request('delete_disabled_keys')}>{t('Delete automatically disabled keys')}</Button>}
      </div>
      {snapshot && <p className='text-sm text-ui-text-2 flex flex-wrap gap-x-4 gap-y-1'><span>{t('Enabled')}: {snapshot.enabled_count}</span><span>{t('Manually disabled')}: {snapshot.manual_disabled_count}</span><span>{t('Automatically disabled')}: {snapshot.auto_disabled_count}</span></p>}
      {feedback && <p role='status' className={`text-sm break-words ${feedback.error ? 'text-ui-danger' : 'text-ui-text-2'}`}>{feedback.message}</p>}
      {!canOperate && <p role='alert'>{t('Channel operation permission is required')}</p>}
      {query.isPending && canOperate && <p role='status'>{t('Loading key status')}</p>}
      {query.isError && <p role='alert' className='text-sm text-ui-danger break-words'>{query.error.message}</p>}
      {snapshot && <>
        <Table columns={columns} rows={snapshot.keys ?? []} rowKey='index' minWidth={850} emptyText={t('No matching keys')} />
        <Pagination total={snapshot.total} pageSize={snapshot.page_size} page={snapshot.page} onChange={(value: number) => { if (!busy) setPage(value); }} />
      </>}
    </Modal>
    {confirmation && <ConfirmDialog open title={confirmation.title} description={confirmation.description} confirmText={t('Confirm')} cancelText={t('Cancel')} closeOnConfirm={false} loading={busy}
      onConfirm={() => void apply()} onClose={() => { if (!lock.current) setConfirmation(null); }} />}
  </>;
}
