import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Modal } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { parseBalanceResult } from './balance';
import type { BalanceResult } from './balance';

type Channel = { id: number; name: string; balance?: number; balance_updated_time?: number };
type Props = { channel: Channel; onClose: () => void; onChanged: () => void };

export default function BalanceQuery({ channel, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); owner.current = controller;
    return () => { controller.abort(); owner.current = null; };
  }, [channel.id, user?.id]);
  const query = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || lock.current || !hasPermission(user, 'channel', 'operate')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await API.get(`/api/channel/update_balance/${channel.id}`, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to query balance'));
      const parsed = parseBalanceResult(data);
      if (!parsed) throw new Error(t('Invalid balance response'));
      setResult(parsed); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t('Unable to query balance')); }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  const updatedAt = result?.kind === 'balance' ? result.updatedAt : channel.balance_updated_time;
  const balance = result?.kind === 'balance' ? result.balance : channel.balance;
  const amount = typeof balance === 'number' && Number.isFinite(balance) ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(balance) : '—';
  return <Modal open title={`${t('Channel balance')} · ${channel.name}`} width={640} onClose={onClose} onConfirm={onClose} footer={<>
    <Button variant='secondary' onClick={onClose}>{t(busy ? 'Cancel request' : 'Close')}</Button>
    {hasPermission(user, 'channel', 'operate') && <Button loading={busy} onClick={() => void query()}>{t('Query balance now')}</Button>}
  </>}>
    <p className='text-sm text-ui-text-2'>{t('Querying saves a numeric balance. Custom JSON is displayed without changing the saved balance.')}</p>
    <section className='rounded-lg border border-ui-border p-4 space-y-2'>
      <h4 className='text-sm text-ui-text-2'>{t('Saved balance (USD)')}</h4>
      <p className='text-2xl font-medium tabular-nums' aria-label={t('Saved balance (USD)')}>{amount}</p>
      <p className='text-xs text-ui-text-3'>{t('Last balance query')}: {updatedAt && updatedAt > 0 ? new Date(updatedAt * 1000).toLocaleString(i18n.language) : t('Not queried yet')}</p>
    </section>
    {busy && <p role='status' className='text-sm'>{t('Querying upstream balance')}</p>}
    {error && <><p role='alert' className='text-sm text-ui-danger break-words'>{error}</p><p className='text-xs text-ui-text-3'>{t('Previous balance snapshot; the latest query failed')}</p></>}
    {result && !busy && !error && <p role='status' className='text-sm'>{t(result.kind === 'balance' ? 'Balance updated' : 'Custom balance response received')}</p>}
    {result?.kind === 'raw' && <section className='min-w-0 space-y-2'>
      <h4 className='text-sm font-medium'>{t('Custom balance response')}</h4>
      <pre className='max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-ui-border p-3 text-xs'>{result.json}</pre>
    </section>}
  </Modal>;
}

const summarySchema = z.object({ updated: z.number().int().nonnegative(), raw_responses: z.number().int().nonnegative(), skipped: z.number().int().nonnegative(), failed_channel_ids: z.array(z.number().int().positive()) });

export function QueryAllBalances({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<z.infer<typeof summarySchema>>();
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); owner.current = controller;
    return () => { controller.abort(); owner.current = null; };
  }, [user?.id]);
  const query = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || lock.current || !hasPermission(user, 'channel', 'operate')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await API.get('/api/channel/update_balance', { signal: lifetime.signal, skipErrorHandler: true, timeout: 0 });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to query balance'));
      const parsed = summarySchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Invalid balance response'));
      setSummary(parsed.data); setOpen(false); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) { setOpen(false); setError(cause instanceof Error ? t(cause.message) : t('Unable to query balance')); onChanged(); } }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  if (!hasPermission(user, 'channel', 'operate')) return null;
  return <>
    <Button size='sm' variant='secondary' disabled={busy} onClick={() => { setSummary(undefined); setError(''); setOpen(true); }}>{t('Query all channel balances')}</Button>
    {open && <ConfirmDialog open title={t('Query all channel balances?')} description={t('Queries enabled single-key channels. Zero numeric balances may trigger automatic disabling. Custom JSON does not change balances. Completed queries remain saved if canceled.')} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')} closeOnConfirm={false} onConfirm={() => void query()} onClose={() => { if (!lock.current) setOpen(false); }} />}
    {(summary || error) && <Modal open title={t('Balance query results')} onClose={() => { setSummary(undefined); setError(''); }} onConfirm={() => { setSummary(undefined); setError(''); }} footer={<Button onClick={() => { setSummary(undefined); setError(''); }}>{t('Close')}</Button>}>
      {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
      {summary && <div className='space-y-2 text-sm'><p>{t('Numeric balances updated')}: {summary.updated}</p><p>{t('Custom JSON responses')}: {summary.raw_responses}</p><p>{t('Skipped channels')}: {summary.skipped}</p><p>{t('Failed channel IDs')}: {summary.failed_channel_ids.join(', ') || '—'}</p></div>}
    </Modal>}
  </>;
}
