import { DashboardPrimaryStatsSkeleton, DashboardUsageStatsSkeleton } from '../../components/layout/PageSkeletons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, renderNumber, renderQuota } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { Button, Select } from '../../components/ui';
import useIsDark from '../../hooks/useIsDark';
import { dashboardKeysSchema, dashboardLocalTime, dashboardPeriods, dashboardProfileSchema, dashboardRange, dashboardUsageSchema } from './dashboard-data';
import type { DashboardRange } from './dashboard-data';
import DashboardRangeDialog from './DashboardRangeDialog';
import SpendingTrendChart from './SpendingTrendChart';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';

const StatMini = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className='dashboard-stat-mini'>
    <div className='dashboard-stat-label'>{label}</div>
    <div className='dashboard-stat-value'>{value}</div>
  </div>
);

async function readDashboardData<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal, params?: Record<string, number | string | boolean>) {
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { timeout: 15000, signal, params, disableDuplicate: true, skipErrorHandler: true });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to load overview');
  return schema.parse(data.data);
}

function DashboardContent() {
  const navigate = useNavigate(); const { t } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [range, setRange] = useState<DashboardRange>('month');
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [selectedKeyID, setSelectedKeyID] = useState(0);
  const isDark = useIsDark();
  const role = auth.user?.role ?? 0;
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const day = new Date().toDateString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const common = { enabled: !!auth.user, gcTime: 0, retry: false, refetchOnMount: 'always' as const, refetchInterval: 5000 };
  const profile = useQuery({ ...common, queryKey: ['dashboard-profile', identity], queryFn: ({ signal }) => readDashboardData('/api/user/self', dashboardProfileSchema, signal) });
  const keys = useQuery({ ...common, queryKey: ['dashboard-keys', identity], queryFn: ({ signal }) => readDashboardData('/api/log/self/keys', dashboardKeysSchema, signal) });
  const availableKeys = keys.data ?? [];
  const activeKeyID = availableKeys.some((key) => key.id === selectedKeyID) ? selectedKeyID : 0;
  useEffect(() => {
    if (keys.isSuccess && selectedKeyID !== activeKeyID) setSelectedKeyID(activeKeyID);
  }, [keys.isSuccess, selectedKeyID, activeKeyID]);
  const usage = useQuery({ ...common, queryKey: ['dashboard-usage', identity, range, day, activeKeyID, timezone], queryFn: ({ signal }) => readDashboardData('/api/log/self/stat', dashboardUsageSchema, signal, { ...dashboardRange(range), include_trend: true, timezone, ...(activeKeyID ? { token_id: activeKeyID } : {}) }) });
  const activeStats = usage.error ? undefined : usage.data;
  const u = profile.error ? undefined : profile.data;
  const overviewError = profile.error || usage.error || keys.error;
  const refresh = () => void Promise.allSettled([profile.refetch(), usage.refetch(), keys.refetch()]);
  const closeRangeDialog = () => { setRangeDialogOpen(false); document.getElementById('dashboard-period')?.focus(); };
  const customRangeTitle = typeof range === 'string' ? undefined : `${dashboardLocalTime(range.start_timestamp).replace('T', ' ')} – ${dashboardLocalTime(range.end_timestamp).replace('T', ' ')}`;

  return (
    <div className='console-content-page dashboard-overview'>
      <div className='dashboard-content'>
        {/* 页面标题 */}
        <ConsolePageHeader title={t('Usage overview')} />
        {overviewError && <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'><span>{t('Unable to load overview')}</span><Button variant='toggle' onClick={refresh}>{t('Retry')}</Button></div>}

        {/* 统计卡片 */}
        {profile.isPending ? <DashboardPrimaryStatsSkeleton /> :
        <div className='dashboard-primary-stats'>
          {/* 充值余额 */}
          <div className='dashboard-primary-card'>
            <div>
              <div className='dashboard-primary-label'>{t('Top-up balance')}</div>
              <div className='dashboard-primary-value'>{u ? renderQuota(u.quota) : '—'}</div>
            </div>
            <button
              onClick={() => navigate('/topup')}
              className='dashboard-topup-button'
              style={{
                background: isDark
                  ? 'var(--ui-bg-subtle)'
                  : 'linear-gradient(136deg, #daf5fe, #ffeddf, #daf5fe, #ffeddf)',
                backgroundSize: '300% 300%',
              }}
            >{t('Top up')}</button>
          </div>
          {/* 累计消费金额 */}
          <div className='dashboard-primary-card'>
            <div>
              <div className='dashboard-primary-label'>{t('Total spending')}</div>
              <div className='dashboard-primary-value'>{u ? renderQuota(u.used_quota) : '—'}</div>
            </div>
          </div>
        </div>
        }

        <div aria-hidden='true' className='dashboard-divider' />

        <section className='dashboard-usage' aria-label={t('Usage statistics')} data-dashboard-usage>
          <div className='dashboard-usage-filters'>
            <div className='dashboard-filter-field'>
              <Select id='dashboard-period' size={32} prefix={t('Time')} aria-label={t('Time range')} value={typeof range === 'string' ? range : 'custom'} options={[...dashboardPeriods.map((period) => ({ value: period.value, label: <span title={t(period.label)}>{t(period.label)}</span> })), { value: 'custom', label: <span title={customRangeTitle}>{t('Custom range')}</span> }]} onChange={(value) => {
                if (value === 'custom') setRangeDialogOpen(true);
                else setRange(value);
              }} />
            </div>
            <div className='dashboard-filter-field dashboard-key-filter'>
              <Select id='dashboard-key' popover size={32} prefix='API Key' aria-label='API Key' value={activeKeyID} disabled={keys.isPending} options={[{ value: 0, label: t('All') }, ...availableKeys.map((key) => ({ value: key.id, label: <span title={`${key.name || 'API Key'} (#${key.id})`}>{key.name || 'API Key'} (#{key.id})</span> }))]} onChange={setSelectedKeyID} />
            </div>
          </div>
          {rangeDialogOpen && <DashboardRangeDialog initialRange={dashboardRange(range)} onClose={closeRangeDialog} onApply={(next) => { setRange(next); closeRangeDialog(); }} />}
          {usage.isPending ? <DashboardUsageStatsSkeleton /> : <div className='dashboard-secondary-stats'>
            <StatMini label={t('Spending amount')} value={activeStats ? renderQuota(activeStats.quota) : '—'} />
            <StatMini label={t('API requests')} value={activeStats ? renderNumber(activeStats.requests) : '—'} />
            <StatMini label='Tokens' value={fmtTokens(activeStats?.tokens)} />
          </div>}
          <SpendingTrendChart usage={activeStats} loading={usage.isPending} />
        </section>
      </div>
    </div>
  );
};
const fmtTokens = (n?: number) => {
  if (n == null) return '—';
  if (n === 0) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

export default function Dashboard() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <DashboardContent key={identity} />;
}
