import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Modal } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { availableResetCredits, codexLimits, parseCodexCredits, parseCodexUsage, resetTimestamp, usedPercent } from './codex-usage';
import type { CodexWindow } from './codex-usage';

type Props = { channel: { id: number; name: string }; onClose: () => void };
type Operation = 'refresh' | 'reset';
type Feedback = { success: boolean; message: string };

function payload(envelope: unknown): unknown {
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope) || !envelope.success) {
    const message = envelope && typeof envelope === 'object' && 'message' in envelope && typeof envelope.message === 'string' ? envelope.message : 'Request failed';
    throw new Error(message);
  }
  return 'data' in envelope ? envelope.data : undefined;
}

export default function CodexUsageDialog({ channel, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [credentialRefreshed, setCredentialRefreshed] = useState<string>();
  const lifetime = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner;
    return () => { owner.abort(); lifetime.current = null; };
  }, [user?.id, channel.id]);

  const prefix = `/api/channel/${channel.id}/codex`;
  const usageQuery = useQuery({
    queryKey: ['codex-usage', user?.id, channel.id],
    queryFn: async ({ signal }) => {
      const { data } = await API.get(`${prefix}/usage`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      const value = payload(data);
      try { return { usage: parseCodexUsage(value), receivedAt: Date.now() }; }
      catch { throw new Error(t('Invalid usage response')); }
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const creditsQuery = useQuery({
    queryKey: ['codex-reset-credits', user?.id, channel.id],
    queryFn: async ({ signal }) => {
      const { data } = await API.get(`${prefix}/usage/reset-credits`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      const value = payload(data);
      try { return parseCodexCredits(value); }
      catch { throw new Error(t('Invalid reset-credit response')); }
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });

  const usage = usageQuery.data?.usage;
  const credits = creditsQuery.data;
  const available = availableResetCredits(usage, credits);
  const fetching = usageQuery.isFetching || creditsQuery.isFetching;
  const canReset = hasPermission(user, 'channel', 'operate') && usageQuery.isSuccess && creditsQuery.isSuccess && (available ?? 0) > 0 && !fetching && !operation;
  const refresh = () => Promise.all([usageQuery.refetch(), creditsQuery.refetch()]);
  const perform = async (action: Operation) => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || lock.current) return;
    if (action === 'reset' && !canReset) return;
    if (action === 'refresh' && !hasPermission(user, 'channel', 'sensitive_write')) return;
    lock.current = true; setOperation(action); setFeedback(null);
    try {
      const { data } = await API.post(`${prefix}/${action === 'reset' ? 'usage/reset' : 'refresh'}`, {}, { signal: owner.signal, skipErrorHandler: true });
      owner.signal.throwIfAborted();
      payload(data);
      if (action === 'refresh') setCredentialRefreshed(new Date().toLocaleString(i18n.language));
      setConfirmReset(false);
      setFeedback({ success: true, message: t(action === 'reset' ? 'Usage reset completed' : 'Credential refreshed') });
      await refresh();
    } catch (error) {
      if (!owner.signal.aborted) {
        setConfirmReset(false);
        setFeedback({ success: false, message: error instanceof Error ? error.message : t('Request failed') });
        await refresh();
      }
    } finally { if (!owner.signal.aborted) { lock.current = false; setOperation(null); } }
  };
  const close = () => { if (!lock.current && !confirmReset) onClose(); };
  const date = (value?: string | null) => value && !Number.isNaN(new Date(value).valueOf()) ? new Date(value).toLocaleString(i18n.language) : t('Unavailable');
  const renderWindow = (window: CodexWindow | null | undefined, label: string) => {
    if (!window) return null;
    const percent = usedPercent(window);
    const reset = resetTimestamp(window, usageQuery.data?.receivedAt ?? Date.now());
    return <div key={label} className='min-w-0 rounded-lg border border-ui-border p-3 space-y-2'>
      <div className='flex flex-wrap justify-between gap-2 text-sm'><span>{t(label)}</span><strong className='tabular-nums'>{percent === undefined ? t('Unavailable') : `${percent.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`}</strong></div>
      {percent !== undefined && <div role='progressbar' aria-label={t(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className='h-1.5 rounded bg-ui-border overflow-hidden'><div className='h-full bg-ui-text-2' style={{ width: `${percent}%` }} /></div>}
      {window.limit_window_seconds != null && <p className='text-xs text-ui-text-3'>{t('Window length (hours)')}: {(window.limit_window_seconds / 3600).toLocaleString(i18n.language, { maximumFractionDigits: 2 })}</p>}
      <p className='text-xs text-ui-text-3 break-words'>{t('Resets at')}: {reset === undefined ? t('Unavailable') : new Date(reset).toLocaleString(i18n.language)}</p>
    </div>;
  };

  return <>
    <Modal open title={`${t('Codex usage')} · ${channel.name}`} width={780} onClose={close} onConfirm={close} footer={<Button disabled={!!operation} onClick={close}>{t('Close')}</Button>}>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' disabled={fetching || !!operation} onClick={() => void refresh()}>{t('Refresh usage')}</Button>
        {hasPermission(user, 'channel', 'sensitive_write') && <Button size='sm' disabled={fetching || !!operation} loading={operation === 'refresh'} onClick={() => void perform('refresh')}>{t('Refresh credential')}</Button>}
      </div>
      {credentialRefreshed && <p className='text-xs text-ui-text-3'>{t('Credential refreshed')}: {credentialRefreshed}</p>}
      {feedback && <p role='status' className={`text-sm break-words ${feedback.success ? 'text-ui-text-2' : 'text-ui-danger'}`}>{feedback.message}</p>}
      {usageQuery.isPending && <p role='status' className='text-sm text-ui-text-3'>{t('Loading usage')}</p>}
      {usageQuery.isError && <p role='alert' className='text-sm text-ui-danger break-words'>{t('Usage request failed')}: {usageQuery.error.message}{usage && ` · ${t('Showing the last successful snapshot')}`}</p>}
      {usage && <>
        <dl className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm'>
          <div><dt className='text-ui-text-3'>{t('Plan')}</dt><dd>{usage.plan_type || usage.rate_limit?.plan_type || t('Unavailable')}</dd></div>
          {usage.email && <div className='min-w-0'><dt className='text-ui-text-3'>{t('Account')}</dt><dd className='break-all'>{usage.email}</dd></div>}
        </dl>
        {(usage.credits?.overage_limit_reached || usage.spend_control?.reached) && <p role='alert' className='text-sm text-ui-danger'>{t('Account spending limit reached')}</p>}
        {codexLimits(usage).map(({ name, rate }, index) => <section key={`${name}-${index}`} className='space-y-2'>
          <div className='flex flex-wrap items-center justify-between gap-2 text-sm'><h4 className='font-medium break-all'>{t(name)}</h4><span className='text-ui-text-3'>{rate.limit_reached === true || rate.allowed === false ? t('Limit reached') : rate.allowed === true ? t('Available') : t('Unavailable')}</span></div>
          <div className='grid sm:grid-cols-2 gap-2'>{renderWindow(rate.primary_window, 'Primary window')}{renderWindow(rate.secondary_window, 'Secondary window')}</div>
        </section>)}
        {!codexLimits(usage).length && <p className='text-sm text-ui-text-3'>{t('No usage windows returned')}</p>}
      </>}
      <section aria-label={t('Reset credits')} className='border-t border-ui-border pt-4 space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'><h4 className='font-medium text-sm'>{t('Reset credits')}</h4><span className='text-sm'>{t('Available resets')}: <strong>{available ?? t('Unavailable')}</strong></span></div>
        {creditsQuery.isPending && <p className='text-xs text-ui-text-3'>{t('Loading reset credits')}</p>}
        {creditsQuery.isError && <p role='alert' className='text-sm text-ui-danger break-words'>{t('Reset-credit request failed')}: {creditsQuery.error.message}{credits && ` · ${t('Showing the last successful snapshot')}`}</p>}
        {credits?.total_earned_count != null && <p className='text-xs text-ui-text-3'>{t('Total earned resets')}: {credits.total_earned_count}</p>}
        {(credits?.credits ?? []).map((credit, index) => <article key={`${credit.id ?? index}`} className='rounded-lg border border-ui-border p-3 text-xs space-y-1 break-words'>
          <div className='flex flex-wrap justify-between gap-2 text-sm'><strong>{credit.title || `${t('Reset credit')} ${index + 1}`}</strong><span>{t(credit.status || 'Unavailable')}</span></div>
          {credit.description && <p className='text-ui-text-2'>{credit.description}</p>}
          {credit.reset_type && <p className='text-ui-text-3'>{t('Reset type')}: {credit.reset_type}</p>}
          <p className='text-ui-text-3'>{t('Granted at')}: {date(credit.granted_at)}</p><p className='text-ui-text-3'>{t('Expires at')}: {date(credit.expires_at)}</p>
          {credit.redeem_started_at && <p className='text-ui-text-3'>{t('Redemption started at')}: {date(credit.redeem_started_at)}</p>}
          {credit.redeemed_at && <p className='text-ui-text-3'>{t('Redeemed at')}: {date(credit.redeemed_at)}</p>}
        </article>)}
        {hasPermission(user, 'channel', 'operate') && <Button size='sm' disabled={!canReset} loading={operation === 'reset'} onClick={() => { setFeedback(null); setConfirmReset(true); }}>{t('Reset usage')}</Button>}
      </section>
    </Modal>
    {confirmReset && <ConfirmDialog open title={t('Reset Codex usage?')} description={t('This consumes one reset credit. Usage and credits will be refreshed after confirmation.')}
      confirmText={t('Confirm reset')} cancelText={t('Cancel')} loading={operation === 'reset'} closeOnConfirm={false}
      onConfirm={() => void perform('reset')} onClose={() => { if (!lock.current) setConfirmReset(false); }} />}
  </>;
}
