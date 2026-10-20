import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { showSuccess } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useAuthStore } from '../../stores/auth-store';
import { readOperationsData, errorText, timestamp } from './api';
import { instancesSchema } from './operations-data';
import type { Instance } from './operations-data';
import { Button, ConfirmDialog, Message, Panel, Table } from './ui';

function RemoveInstances({ target, onClose, onSaved }: { target: Instance | 'all'; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t('Remove offline instances')} description={target === 'all' ? t('Remove expired instance records. Nodes that resumed heartbeats are retained.') : t('Remove the offline record for {{node}}. The server rejects removal if it is online again.', { node: target.node_name })} confirmText={t('Confirm cleanup')} cancelText={t('Cancel')} onClose={onClose} loading={busy} closeOnConfirm={false} onConfirm={() => void run(async (signal) => {
    const path = target === 'all' ? '/api/system-info/stale-instances' : `/api/system-info/instances/${encodeURIComponent(target.node_name)}`;
    const { data } = await API.delete<ApiEnvelope<unknown>>(path, { signal, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to remove offline instances');
    const result = z.object({ deleted_count: z.number().int().nonnegative().safe() }).safeParse(data.data);
    showSuccess(result.success ? t('Removed {{count}} offline instances', { count: result.data.deleted_count }) : t('Offline instance cleanup completed')); onSaved(); onClose();
  })} />;
}
function InstancesSession({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation(); const [confirmation, setConfirmation] = useState<Instance | 'all' | null>(null);
  const query = useQuery({ queryKey: ['system-instances', identity], gcTime: 0, retry: false, refetchInterval: 30000, queryFn: ({ signal }) => readOperationsData('/api/system-info/instances', instancesSchema, signal) });
  const rows = query.isError ? [] : query.data ?? []; const percent = (value?: number) => value === undefined ? '—' : `${value.toFixed(1)}%`;
  return <Panel title={t('Running instances')} actions={<><Button size='sm' variant='toggle' loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh instances')}</Button><Button size='sm' disabled={Boolean(confirmation) || !rows.some((row) => row.status === 'stale')} onClick={() => setConfirmation('all')}>{t('Remove offline instances')}</Button></>}>
    <p className='text-xs text-ui-text-3'>{t('Heartbeats update every 30 seconds; nodes are offline after 90 seconds. Give each node a stable, unique NODE_NAME.')}</p>
    {query.isError ? <div className='space-y-2'><Message error={t(errorText(query.error))} /><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <Table<Instance> rows={rows} rowKey='node_name' minWidth={820} emptyText={t('No running instances')} columns={[
      { key: 'node', title: t('Node'), render: (row) => <div className='max-w-60 break-all font-medium'>{row.node_name}<div className='text-xs font-normal text-ui-text-3'>{row.info?.node ? t(row.info.node.manually_configured ? 'Manually configured' : 'Automatic hostname') : '—'} · {row.info?.role ? t(row.info.role.is_master ? 'Primary node' : 'Secondary node') : '—'}</div></div> },
      { key: 'status', title: t('Status'), render: (row) => <span className={row.status === 'stale' ? 'text-ui-danger' : 'text-ui-text'}>{t(row.status === 'stale' ? 'Offline' : 'Online')}</span> },
      { key: 'runtime', title: t('Runtime environment'), render: (row) => <div className='text-xs'>{row.info?.runtime?.version || '—'}<div className='text-ui-text-3'>{row.info?.runtime?.goos} / {row.info?.runtime?.goarch}</div></div> },
      { key: 'resources', title: t('CPU / memory / disk'), render: (row) => <span className='whitespace-nowrap text-xs tabular-nums'>{percent(row.info?.resources?.cpu?.usage_percent)} / {percent(row.info?.resources?.memory?.usage_percent)} / {percent(row.info?.resources?.storage?.used_percent)}</span> },
      { key: 'time', title: t('Last heartbeat / startup'), render: (row) => <div className='whitespace-nowrap text-xs'>{timestamp(row.last_seen_at, i18n.language)}<div className='text-ui-text-3'>{timestamp(row.started_at, i18n.language)}</div></div> },
      { key: 'delete', title: t('Actions'), align: 'right', render: (row) => <Button size='sm' disabled={Boolean(confirmation) || row.status !== 'stale'} onClick={() => setConfirmation(row)}>{t('Clean up')}</Button> },
    ]} />}
    {confirmation && <RemoveInstances key={confirmation === 'all' ? 'all' : confirmation.node_name} target={confirmation} onClose={() => setConfirmation(null)} onSaved={() => void query.refetch()} />}
  </Panel>;
}
export default function InstancesPanel() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const root = useAuthStore((state) => state.auth.user?.role === 100);
  return root ? <InstancesSession key={identity} identity={identity} /> : null;
}
