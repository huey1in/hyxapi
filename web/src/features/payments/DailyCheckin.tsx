import { useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { API, renderQuota, showSuccess } from '../../helpers';
import { Button, IconButton, Skeleton } from '../../components/ui';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import TurnstileChallenge from '../../components/auth/TurnstileChallenge';
import { calendarDays, checkinStatusSchema, monthKey, moveMonth } from './checkin-calendar';
import type { CheckinStatus } from './checkin-calendar';

const dayHeight = 'h-12 sm:h-14 lg:h-16';

export function DailyCheckinSkeleton({ month = monthKey(new Date()) }: { month?: string }) {
  const { t } = useTranslation();
  return <section aria-label={t('Daily Check-in')} aria-busy='true' data-wallet-checkin data-loading-skeleton='cards' className='overflow-hidden rounded-[26px] border border-ui-border'>
    <div className='flex flex-wrap items-center justify-between gap-4 p-5'>
      <div className='min-w-0 space-y-2'>
        <h2 className='text-lg font-semibold text-ui-text'>{t('Daily Check-in')}</h2>
        <Skeleton width={208} height={16} />
        <Skeleton width={164} height={12} />
      </div>
      <Skeleton width={96} height={36} rounded='rounded-full' />
    </div>
    <div className='border-t border-ui-divider p-5' data-checkin-calendar>
      <div className='mb-4 flex h-8 items-center justify-between gap-2'><Skeleton width={32} height={32} /><Skeleton width={120} height={16} /><Skeleton width={32} height={32} /></div>
      <div className='grid grid-cols-7 gap-1'>
        {Array.from({ length: 7 }, (_, day) => <div key={day} className='pb-2'><Skeleton height={20} /></div>)}
        {calendarDays(month).map((date, index) => <div key={index} className={dayHeight}>{date && <Skeleton height='100%' rounded='rounded-lg' className='h-full' />}</div>)}
      </div>
      <div className='mt-4 grid grid-cols-2 gap-3 border-t border-ui-divider pt-4'><Skeleton width={140} height={36} /><Skeleton width={140} height={36} /></div>
    </div>
  </section>;
}

function CheckinCard({ identity, turnstileEnabled, siteKey }: { identity: string; turnstileEnabled: boolean; siteKey: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [token, setToken] = useState('');
  const [challenge, setChallenge] = useState(0);
  const { busy, run } = useOwnedOperation();
  const status = useQuery({
    queryKey: ['wallet-checkin', identity, month],
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>('/api/user/checkin', { params: { month }, signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load check-in records');
      return checkinStatusSchema.parse(data.data);
    }, retry: false, gcTime: 0,
  });
  const info = status.data;
  const [year = 2000, number = 1] = month.split('-').map(Number);
  const heading = new Date(year, number - 1, 1).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long' });
  const records = new Map(info?.stats.records.map((record) => [record.checkin_date, record.quota_awarded]));
  const monthlyQuota = info?.stats.records.reduce((sum, record) => sum + record.quota_awarded, 0) ?? 0;
  const today = info?.today ?? `${monthKey(new Date())}-${String(new Date().getDate()).padStart(2, '0')}`;
  const checked = info?.stats.checked_in_today;
  const checkin = () => void run(async (signal) => {
    try {
      const { data } = await API.post<ApiEnvelope<{ quota_awarded: number; checkin_date: string }>>('/api/user/checkin', {}, { params: token ? { turnstile: token } : undefined, signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Check-in failed');
      const reward = data.data;
      client.setQueryData<CheckinStatus>(['wallet-checkin', identity, month], (previous) => {
        if (!previous || previous.stats.checked_in_today) return previous;
        const inMonth = reward.checkin_date.startsWith(month + '-');
        return { ...previous, stats: {
          ...previous.stats,
          checked_in_today: true,
          total_checkins: previous.stats.total_checkins + 1,
          total_quota: previous.stats.total_quota + reward.quota_awarded,
          checkin_count: previous.stats.checkin_count + (inMonth ? 1 : 0),
          records: inMonth ? [reward, ...previous.stats.records] : previous.stats.records,
        } };
      });
      showSuccess(t('Check-in successful: {{quota}}', { quota: renderQuota(data.data.quota_awarded) }));
      await Promise.allSettled([
        client.invalidateQueries({ queryKey: ['wallet-checkin', identity] }),
        client.invalidateQueries({ queryKey: ['wallet-profile', identity] }),
        client.invalidateQueries({ queryKey: ['dashboard-profile', identity] }),
      ]);
    } finally { if (!signal.aborted) { setToken(''); setChallenge((value) => value + 1); } }
  });
  const message = status.error && apiErrorMessage(status.error, 'Unable to load check-in records');
  if (status.isPending) return <DailyCheckinSkeleton month={month} />;
  return <section aria-label={t('Daily Check-in')} data-wallet-checkin className='overflow-hidden rounded-[26px] border border-ui-border'>
    <div className='flex flex-wrap items-center justify-between gap-4 p-5'>
      <div className='min-w-0 text-sm text-ui-text-2'>
        <h2 className='text-lg font-semibold text-ui-text'>{t('Daily Check-in')}</h2>
        <p className='mt-1'>{checked ? t('Already checked in today') : t('Check in daily to earn quota rewards')}</p>
        {info && <p className='mt-1 text-xs text-ui-text-3'>{t('Reward range: {{min}} – {{max}}', { min: renderQuota(info.min_quota), max: renderQuota(info.max_quota) })}</p>}
      </div>
      <Button onClick={checkin} loading={busy} disabled={!info || status.isError || checked || !info.enabled || (turnstileEnabled && !token)}>{t(checked ? 'Checked In' : 'Check In')}</Button>
    </div>
    {turnstileEnabled && info && !checked && <div className='px-5 pb-5'>{siteKey
      ? <TurnstileChallenge key={challenge} siteKey={siteKey} onToken={setToken} />
      : <p role='alert' className='text-sm text-ui-text-2'>{t('Security verification is not configured')}</p>}</div>}
    {message && <div role='alert' className='px-5 pb-5 text-sm text-ui-text-2'>{t(message)} <Button onClick={() => void status.refetch()} loading={status.isFetching}>{t('Retry')}</Button></div>}
    {info && <div className='border-t border-ui-divider p-5' data-checkin-calendar>
      <div className='mb-4 flex items-center justify-between gap-2'>
        <IconButton icon={ChevronLeft} aria-label={t('Previous month')} disabled={busy || month <= '1900-01'} onClick={() => setMonth(moveMonth(month, -1))} />
        <h3 className='text-sm font-medium text-ui-text' aria-live='polite'>{heading}</h3>
        <IconButton icon={ChevronRight} aria-label={t('Next month')} disabled={busy || month >= '9998-12'} onClick={() => setMonth(moveMonth(month, 1))} />
      </div>
      <div className='grid grid-cols-7 gap-1 text-center text-sm'>
        {Array.from({ length: 7 }, (_, day) => <span key={day} className='pb-2 text-ui-text-3'>{new Date(2024, 0, 7 + day).toLocaleDateString(i18n.language, { weekday: 'short' })}</span>)}
        {calendarDays(month).map((date, index) => <div key={date ?? `blank-${index}`} aria-current={date === today ? 'date' : undefined}
          title={date ? (records.has(date) ? t('Checked in on {{date}}: {{quota}}', { date, quota: renderQuota(records.get(date) ?? 0) }) : date) : undefined}
          data-checkin-date={date ?? undefined} data-checked={date ? records.has(date) : undefined}
          className={`relative flex ${dayHeight} items-center justify-center rounded-lg ${date === today ? 'ring-1 ring-inset ring-ui-border' : ''} text-ui-text-2`}>
          {date && <>
            <span className={records.has(date) ? 'sr-only' : undefined}>{Number(date.slice(-2))}</span>
            {records.has(date) && <svg data-checkin-stamp aria-hidden='true' viewBox='0 0 48 48' className='pointer-events-none absolute inset-0 m-auto size-10 max-h-full max-w-full -rotate-12 text-[#b65d55] sm:size-12 dark:text-[#d98a80]'>
              <circle cx='24' cy='24' r='21' fill='none' stroke='currentColor' strokeWidth='1.5' />
              <circle cx='24' cy='24' r='18' fill='none' stroke='currentColor' strokeWidth='0.6' />
              <text x='24' y='21' textAnchor='middle' fill='currentColor' fontSize='13' fontWeight='700'>{Number(date.slice(-2))}</text>
              <text x='24' y='33' textAnchor='middle' fill='currentColor' fontSize='10' fontWeight='600' textLength='30' lengthAdjust='spacingAndGlyphs'>{t('Checked In')}</text>
            </svg>}
          </>}
        </div>)}
      </div>
      <div className='mt-4 grid grid-cols-2 gap-3 border-t border-ui-divider pt-4 text-xs text-ui-text-3'>
        <p>{t('Check-ins this month: {{count}}', { count: info?.stats.checkin_count ?? 0 })}<br /><strong className='mt-1 inline-block font-medium text-ui-text'>{renderQuota(monthlyQuota)}</strong></p>
        <p>{t('Total check-ins: {{count}}', { count: info?.stats.total_checkins ?? 0 })}<br /><strong className='mt-1 inline-block font-medium text-ui-text'>{renderQuota(info?.stats.total_quota ?? 0)}</strong></p>
      </div>
    </div>}
  </section>;
}

export default function DailyCheckin({ identity }: { identity: string }) {
  const [state] = useContext(StatusContext);
  const signedIn = useAuthStore((store) => !!store.auth.user);
  if (!signedIn || !state.status?.checkin_enabled) return null;
  return <CheckinCard key={identity} identity={identity} turnstileEnabled={!!state.status.turnstile_check} siteKey={typeof state.status.turnstile_site_key === 'string' ? state.status.turnstile_site_key : ''} />;
}
