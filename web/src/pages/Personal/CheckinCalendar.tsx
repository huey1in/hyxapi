import { useContext, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { API, renderQuota, showSuccess } from '../../helpers';
import { Button, IconButton } from '../../components/ui';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope, User } from '../../types/api';
import TurnstileChallenge from '../../components/auth/TurnstileChallenge';
import { calendarDays, checkinStatusSchema, monthKey, moveMonth } from './checkin-calendar';
import { SettingGroup } from './ProfileSettingsLayout';

function Calendar({ identity, turnstileEnabled, siteKey }: { identity: string; turnstileEnabled: boolean; siteKey: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [collapsed, setCollapsed] = useState(false);
  const [token, setToken] = useState('');
  const [challenge, setChallenge] = useState(0);
  const initialized = useRef(false);
  const { busy, run } = useOwnedOperation();
  const status = useQuery({
    queryKey: ['personal-checkin', identity, month],
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>('/api/user/checkin', { params: { month }, signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load check-in records');
      return checkinStatusSchema.parse(data.data);
    }, retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const info = status.data;
  const checked = info?.stats.checked_in_today;
  useEffect(() => {
    if (checked !== undefined && !initialized.current) { initialized.current = true; setCollapsed(checked); }
  }, [checked]);
  const [year = 2000, number = 1] = month.split('-').map(Number);
  const heading = new Date(year, number - 1, 1).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long' });
  const records = new Map(info?.stats.records.map((record) => [record.checkin_date, record.quota_awarded]));
  const monthlyQuota = info?.stats.records.reduce((sum, record) => sum + record.quota_awarded, 0) ?? 0;
  const today = info?.today ?? `${monthKey(new Date())}-${String(new Date().getDate()).padStart(2, '0')}`;
  const formatReward = (quota: number) => renderQuota(quota, 6);
  const checkin = () => void run(async (signal) => {
    try {
      const { data } = await API.post<ApiEnvelope<{ quota_awarded: number; checkin_date: string }>>('/api/user/checkin', {}, { params: token ? { turnstile: token } : undefined, signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Check-in failed');
      showSuccess(t('Check-in successful: {{quota}}', { quota: formatReward(data.data.quota_awarded) }));
      setCollapsed(true);
      await client.invalidateQueries({ queryKey: ['personal-checkin', identity] });
      // Refresh the displayed wallet from its authoritative value. Failure to
      // refresh the profile cannot turn an already committed reward into a failure.
      try {
        const response = await API.get<ApiEnvelope<User>>('/api/user/self', { signal, skipErrorHandler: true });
        signal.throwIfAborted(); if (response.data.success) useAuthStore.getState().auth.setUser(response.data.data);
      } catch { /* The next profile refresh will update the balance. */ }
    } finally { if (!signal.aborted) { setToken(''); setChallenge((value) => value + 1); } }
  });
  const message = status.error && apiErrorMessage(status.error, 'Unable to load check-in records');
  return <SettingGroup title={t('Daily Check-in')}>
    <div className='flex flex-wrap items-center justify-between gap-3 p-4'>
      <div className='min-w-0 text-sm text-ui-text-2'>
        <p>{checked ? t('Already checked in today') : t('Check in daily to earn quota rewards')}</p>
        {info && <p className='mt-1 text-xs text-ui-text-3'>{t('Reward range: {{min}} – {{max}}', { min: formatReward(info.min_quota), max: formatReward(info.max_quota) })}</p>}
      </div>
      <div className='flex items-center gap-2'>
        <Button onClick={checkin} loading={busy} disabled={!info || checked || !info.enabled || (turnstileEnabled && !token)}>{t(checked ? 'Checked In' : 'Check In')}</Button>
        <IconButton icon={collapsed ? ChevronDown : ChevronUp} aria-label={t(collapsed ? 'Expand calendar' : 'Collapse calendar')} onClick={() => setCollapsed((value) => !value)} />
      </div>
    </div>
    {turnstileEnabled && !checked && <div className='px-4 pb-4'>{siteKey
      ? <TurnstileChallenge key={challenge} siteKey={siteKey} onToken={setToken} />
      : <p role='alert' className='text-sm text-ui-text-2'>{t('Security verification is not configured')}</p>}</div>}
    {message && <div role='alert' className='px-4 pb-4 text-sm text-ui-text-2'>{t(message)} <Button onClick={() => void status.refetch()}>{t('Retry')}</Button></div>}
    {!collapsed && <div className='border-t border-ui-divider p-4'>
      <div className='mb-4 flex items-center justify-between gap-2'>
        <IconButton icon={ChevronLeft} aria-label={t('Previous month')} disabled={busy || month <= '1900-01'} onClick={() => setMonth(moveMonth(month, -1))} />
        <h3 className='text-sm font-medium text-ui-text' aria-live='polite'>{heading}</h3>
        <IconButton icon={ChevronRight} aria-label={t('Next month')} disabled={busy || month >= '9998-12'} onClick={() => setMonth(moveMonth(month, 1))} />
      </div>
      <div className='grid grid-cols-7 gap-1 text-center text-xs'>
        {Array.from({ length: 7 }, (_, day) => <span key={day} className='pb-2 text-ui-text-3'>{new Date(2024, 0, 7 + day).toLocaleDateString(i18n.language, { weekday: 'short' })}</span>)}
        {calendarDays(month).map((date, index) => <div key={date ?? `blank-${index}`} aria-current={date === today ? 'date' : undefined}
          title={date ? (records.has(date) ? t('Checked in on {{date}}: {{quota}}', { date, quota: formatReward(records.get(date) ?? 0) }) : date) : undefined}
          data-checkin-date={date ?? undefined} data-checked={date ? records.has(date) : undefined}
          className={`flex min-h-11 flex-col items-center justify-center rounded-lg ${date === today ? 'ring-1 ring-inset ring-ui-border' : ''} ${date && records.has(date) ? 'bg-ui-bg-subtle font-semibold text-ui-text' : 'text-ui-text-3'}`}>
          {date && <><span>{Number(date.slice(-2))}</span>{records.has(date) && <span aria-hidden='true'>✓</span>}</>}
        </div>)}
      </div>
      <div className='mt-4 grid grid-cols-2 gap-3 border-t border-ui-divider pt-4 text-xs text-ui-text-3'>
        <p>{t('Check-ins this month: {{count}}', { count: info?.stats.checkin_count ?? 0 })}<br /><strong className='mt-1 inline-block font-medium text-ui-text'>{formatReward(monthlyQuota)}</strong></p>
        <p>{t('Total check-ins: {{count}}', { count: info?.stats.total_checkins ?? 0 })}<br /><strong className='mt-1 inline-block font-medium text-ui-text'>{formatReward(info?.stats.total_quota ?? 0)}</strong></p>
      </div>
    </div>}
  </SettingGroup>;
}

export default function CheckinCalendar() {
  const [state] = useContext(StatusContext);
  const identity = useAuthStore((store) => `${store.auth.user?.id}:${store.auth.session?.sid}`);
  const signedIn = useAuthStore((store) => !!store.auth.user);
  if (!signedIn || !state.status?.checkin_enabled) return null;
  return <Calendar key={identity} identity={identity} turnstileEnabled={!!state.status.turnstile_check} siteKey={typeof state.status.turnstile_site_key === 'string' ? state.status.turnstile_site_key : ''} />;
}
