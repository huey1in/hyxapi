import { DashboardPrimaryStatsSkeleton, DashboardUsageStatsSkeleton } from '../../components/layout/PageSkeletons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { API, renderNumber, renderQuota } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { Button, Select } from '../../components/ui';
import useIsDark from '../../hooks/useIsDark';
import { advancePreviewState, createPreviewState, getPreviewStats, previewKeys } from './dashboardPreviewSimulation';
import { dashboardKeysSchema, dashboardLocalTime, dashboardPeriods, dashboardProfileSchema, dashboardRange, dashboardStatsSchema } from './dashboard-data';
import type { DashboardRange } from './dashboard-data';
import DashboardRangeDialog from './DashboardRangeDialog';
import ConsoleContent from '../../features/dashboard-content/ConsoleContent';

const StatMini = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className='dashboard-stat-mini'>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

async function readDashboardData<T>(path: string, schema: z.ZodType<T>, signal: AbortSignal, params?: Record<string, number>) {
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { timeout: 15000, signal, params, disableDuplicate: true, skipErrorHandler: true });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to load overview');
  return schema.parse(data.data);
}

function DashboardContent({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate(); const { t } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [previewState, setPreviewState] = useState(createPreviewState);
  const [range, setRange] = useState<DashboardRange>('today');
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState({ id: 0, name: '' });
  const isDark = useIsDark();
  const role = auth.user?.role ?? 0; const admin = role >= 10;
  const base = admin ? '/api/log' : '/api/log/self';
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const day = new Date().toDateString();
  const common = { enabled: !preview && !!auth.user, gcTime: 0, retry: false, refetchOnMount: 'always' as const, refetchInterval: preview ? false as const : 5000 };
  const profile = useQuery({ ...common, queryKey: ['dashboard-profile', identity], queryFn: ({ signal }) => readDashboardData('/api/user/self', dashboardProfileSchema, signal) });
  const usage = useQuery({ ...common, queryKey: ['dashboard-usage', identity, range, day, selectedKey.id], queryFn: ({ signal }) => readDashboardData(`${base}/stat`, dashboardStatsSchema, signal, { ...dashboardRange(range), ...(selectedKey.id ? { token_id: selectedKey.id } : {}) }) });
  const keys = useQuery({ ...common, refetchInterval: 60000, queryKey: ['dashboard-keys', identity], queryFn: ({ signal }) => readDashboardData(`${base}/keys`, dashboardKeysSchema, signal) });
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => setPreviewState((current) => advancePreviewState(current)), 2400);
    return () => clearInterval(timer);
  }, [preview]);
  const activeStats = preview ? getPreviewStats(previewState, dashboardRange(range), selectedKey.id) : usage.error ? undefined : usage.data;
  const availableKeys = preview ? previewKeys : keys.data ?? [];
  const keyChoices = selectedKey.id && !availableKeys.some((key) => key.id === selectedKey.id) ? [selectedKey, ...availableKeys] : availableKeys;
  const u = preview ? previewState.user : profile.error ? undefined : profile.data;
  const overviewError = !preview && (profile.error || usage.error || keys.error);
  const refresh = () => void Promise.allSettled([profile.refetch(), usage.refetch(), keys.refetch()]);
  const refreshing = profile.isFetching || usage.isFetching || keys.isFetching;
  const closeRangeDialog = () => { setRangeDialogOpen(false); document.getElementById('dashboard-period')?.focus(); };
  const customRangeTitle = typeof range === 'string' ? undefined : `${dashboardLocalTime(range.start_timestamp).replace('T', ' ')} – ${dashboardLocalTime(range.end_timestamp).replace('T', ' ')}`;

  return (
    <div className='dashboard-overview'>
      {/* 页面标题 */}
      <div className='flex flex-wrap items-center justify-between gap-3'><h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)', paddingBlockEnd: 8 }}>{admin ? t('Global usage') : t('Usage overview')}</h1>{!preview && <Button size='sm' variant='toggle' icon={RefreshCw} loading={refreshing} onClick={refresh}>{t('Refresh')}</Button>}</div>
      {overviewError && <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'><span>{t('Unable to load overview')}</span><Button variant='toggle' onClick={refresh}>{t('Retry')}</Button></div>}

      {/* 统计卡片 */}
      {!preview && profile.isPending ? <DashboardPrimaryStatsSkeleton /> :
      <div className='dashboard-primary-stats'>
        {/* 充值余额 */}
        <div className='dashboard-primary-card'>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>{t('Top-up balance')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{u ? renderQuota(u.quota) : '—'}</div>
          </div>
          <button
            onClick={preview ? undefined : () => navigate('/console/topup')}
            disabled={preview}
            style={{
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 32, paddingInline: 16, border: 'none', borderRadius: 24,
              fontSize: 14, fontWeight: 500, color: 'var(--ui-text)',
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
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>{t('Total spending')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{u ? renderQuota(u.used_quota) : '—'}</div>
          </div>
        </div>
      </div>
      }

      <section className='space-y-3' aria-label={t('Usage statistics')} data-dashboard-usage>
        <div className='dashboard-usage-filters'>
          <div className='dashboard-filter-field'>
            <label htmlFor='dashboard-period' className='text-xs text-ui-text-3'>{t('Time range')}</label>
            <Select id='dashboard-period' size={32} aria-label={t('Time range')} value={typeof range === 'string' ? range : 'custom'} options={[...dashboardPeriods.map((period) => ({ value: period.value, label: t(period.label) })), { value: 'custom', label: <span title={customRangeTitle}>{t('Custom range')}</span> }]} onChange={(value) => {
              if (value === 'custom') setRangeDialogOpen(true);
              else setRange(value);
            }} />
          </div>
          <div className='dashboard-filter-field dashboard-key-filter'>
            <label htmlFor='dashboard-key' className='text-xs text-ui-text-3'>API Key</label>
            <Select id='dashboard-key' size={32} aria-label='API Key' value={selectedKey.id} disabled={!preview && keys.isPending} options={[{ value: 0, label: t('All API keys') }, ...keyChoices.map((key) => ({ value: key.id, label: <span title={`${key.name || 'API Key'} (#${key.id})`}>{key.name || 'API Key'} (#{key.id})</span> }))]} onChange={(id) => setSelectedKey(keyChoices.find((key) => key.id === id) ?? { id: 0, name: '' })} />
          </div>
        </div>
        {rangeDialogOpen && <DashboardRangeDialog initialRange={dashboardRange(range)} onClose={closeRangeDialog} onApply={(next) => { setRange(next); closeRangeDialog(); }} />}
        {!preview && usage.isPending ? <DashboardUsageStatsSkeleton /> : <div className='dashboard-secondary-stats'>
          <StatMini label={t('Spending amount')} value={activeStats ? renderQuota(activeStats.quota) : '—'} />
          <StatMini label={t('API requests')} value={activeStats ? renderNumber(activeStats.requests) : '—'} />
          <StatMini label='Tokens' value={fmtTokens(activeStats?.tokens)} />
        </div>}
      </section>

      {!preview && <ConsoleContent />}

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

export default function Dashboard({ preview = false }: { preview?: boolean }) {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <DashboardContent key={`${identity}:${preview}`} preview={preview} />;
}
