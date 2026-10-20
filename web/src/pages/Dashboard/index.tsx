import { DashboardStatsSkeleton } from '../../components/layout/PageSkeletons';
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
import { Button } from '../../components/ui';
import useIsDark from '../../hooks/useIsDark';
import { advancePreviewState, createPreviewState } from './dashboardPreviewSimulation';
import { dashboardProfileSchema, dashboardStatsSchema, dashboardTodayRange } from './dashboard-data';
import { PerformanceOverview } from '../../features/performance-metrics/PerformancePanel';
import UsageFlow from '../../features/dashboard-flow/UsageFlow';
import ConsoleContent from '../../features/dashboard-content/ConsoleContent';

const StatMini = ({ label, value, caption }: { label: string; value: ReactNode; caption?: ReactNode }) => (
  <div className='dashboard-stat-mini'>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {caption && <div className='mt-1 text-xs text-ui-text-3'>{caption}</div>}
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
  const isDark = useIsDark();
  const role = auth.user?.role ?? 0; const admin = role >= 10;
  const base = admin ? '/api/log' : '/api/log/self';
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const today = dashboardTodayRange();
  const common = { enabled: !preview && !!auth.user, gcTime: 0, retry: false, refetchOnMount: 'always' as const, refetchInterval: preview ? false as const : 5000 };
  const profile = useQuery({ ...common, queryKey: ['dashboard-profile', identity], queryFn: ({ signal }) => readDashboardData('/api/user/self', dashboardProfileSchema, signal) });
  const cumulative = useQuery({ ...common, queryKey: ['dashboard-stat', identity], queryFn: ({ signal }) => readDashboardData(`${base}/stat`, dashboardStatsSchema, signal) });
  const daily = useQuery({ ...common, queryKey: ['dashboard-day-stat', identity, today.start_timestamp], queryFn: ({ signal }) => readDashboardData(`${base}/stat`, dashboardStatsSchema, signal, dashboardTodayRange()) });
  useEffect(() => {
    if (!preview) return;
    const timer = setInterval(() => setPreviewState((current) => advancePreviewState(current)), 2400);
    return () => clearInterval(timer);
  }, [preview]);
  const activeCumStats = preview ? previewState.cumulative : cumulative.error ? undefined : cumulative.data;
  const activeDayStats = preview ? previewState.today : daily.error ? undefined : daily.data;
  const activeRpm = preview ? previewState.rpm : cumulative.error ? undefined : cumulative.data?.rpm;
  const activeTpm = preview ? previewState.logs.reduce((sum, log) => sum + log.prompt_tokens + log.completion_tokens, 0) : cumulative.error ? undefined : cumulative.data?.tpm;
  const u = preview ? previewState.user : profile.error ? undefined : profile.data;
  const overviewError = !preview && (profile.error || cumulative.error || daily.error);
  const refresh = () => void Promise.allSettled([profile.refetch(), cumulative.refetch(), daily.refetch()]);
  const refreshing = profile.isFetching || cumulative.isFetching || daily.isFetching;

  return (
    <div className='dashboard-overview'>
      {/* 页面标题 */}
      <div className='flex flex-wrap items-center justify-between gap-3'><h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)', paddingBlockEnd: 8 }}>{admin ? t('Global usage') : t('Usage overview')}</h1>{!preview && <Button size='sm' variant='toggle' icon={RefreshCw} loading={refreshing} onClick={refresh}>{t('Refresh')}</Button>}</div>
      {overviewError && <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'><span>{t('Unable to load overview')}</span><Button variant='toggle' onClick={refresh}>{t('Retry')}</Button></div>}

      {/* 统计卡片 */}
      {!preview && profile.isPending ? <DashboardStatsSkeleton /> : <>
      <div className='dashboard-primary-stats'>
        {/* 积分余额 */}
        <div className='dashboard-primary-card'>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>{t('Remaining balance')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{u ? renderQuota(u.quota) : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>{t('Total spent')}: {u ? renderQuota(u.used_quota) : '—'}</div>
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
        {/* 总请求 */}
        <div className='dashboard-primary-card'>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>{t('Total requests')}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{u ? renderNumber(u.request_count) : '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>{admin ? t('Total tokens') : t('Log range tokens')}: {fmtTokens(activeCumStats?.tokens)}</div>
          </div>
        </div>
      </div>

      {/* 今日统计 */}
      <div className='dashboard-secondary-stats'>
        <StatMini label={t('Tokens today')} value={fmtTokens(activeDayStats?.tokens)} />
        <StatMini label={t('Spent today')} value={activeDayStats ? renderQuota(activeDayStats.quota) : '—'} />
        <StatMini label={t('Requests today')} value={activeDayStats ? renderNumber(activeDayStats.requests) : '—'} />
        <StatMini label={t('Current RPM')} value={activeRpm == null ? '—' : renderNumber(activeRpm)} caption={`${t('Current TPM')}: ${activeTpm == null ? '—' : fmtTokens(activeTpm)}`} />
      </div>
      </>}

      {!preview && <PerformanceOverview />}
      {!preview && <UsageFlow />}
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
