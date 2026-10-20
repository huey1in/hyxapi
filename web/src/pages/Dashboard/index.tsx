import { DashboardStatsSkeleton, TokenUsageSkeleton } from '../../components/layout/PageSkeletons';
import { useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { API, renderNumber, renderQuota } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { Button, Tabs } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import useIsDark from '../../hooks/useIsDark';
import { advancePreviewState, createPreviewState } from './dashboardPreviewSimulation';
import { getTokenUsageRequestConfig, getUsageBucketCount } from './usageGridLayout';
import { allowedUsageDays, dashboardProfileSchema, dashboardRange, dashboardStatsSchema, usageRowsSchema, type UsageBucket } from './dashboard-data';
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
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { ...getTokenUsageRequestConfig(), signal, params, disableDuplicate: true, skipErrorHandler: true });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to load overview');
  return schema.parse(data.data);
}

function DashboardContent({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate(); const { t } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [{ status }] = useContext(StatusContext);
  const [previewState, setPreviewState] = useState(createPreviewState);
  const [usageDays, setUsageDays] = useState('1');
  const isMobile = useIsMobile(); const isDark = useIsDark();
  const usageBucketCount = getUsageBucketCount(isMobile);
  const role = auth.user?.role ?? 0; const admin = role >= 10;
  const base = admin ? '/api/log' : '/api/log/self';
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const today = dashboardRange(1, usageBucketCount);
  const allowedDays = allowedUsageDays(role, status?.log_max_range_days);
  const days = allowedDays.includes(Number(usageDays)) ? Number(usageDays) : 1;
  const common = { enabled: !preview && !!auth.user, gcTime: 0, retry: false, refetchOnMount: 'always' as const, refetchInterval: preview ? false as const : 5000 };
  const profile = useQuery({ ...common, queryKey: ['dashboard-profile', identity], queryFn: ({ signal }) => readDashboardData('/api/user/self', dashboardProfileSchema, signal) });
  const cumulative = useQuery({ ...common, queryKey: ['dashboard-stat', identity], queryFn: ({ signal }) => readDashboardData(`${base}/stat`, dashboardStatsSchema, signal) });
  const daily = useQuery({ ...common, queryKey: ['dashboard-day-stat', identity, today.start_timestamp, usageBucketCount], queryFn: ({ signal }) => readDashboardData(`${base}/stat`, dashboardStatsSchema, signal, dashboardRange(1, usageBucketCount)) });
  const history = useQuery({ ...common, enabled: common.enabled && days !== 1, queryKey: ['dashboard-token-usage', identity, days, today.start_timestamp, usageBucketCount], queryFn: ({ signal }) => readDashboardData(`${base}/token-usage`, usageRowsSchema, signal, dashboardRange(days, usageBucketCount)) });
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
  const activeRecentLogs = preview ? createPreviewUsage(days, usageBucketCount) : days === 1 ? daily.data?.token_usage ?? [] : history.data ?? [];
  const usageError = !preview && (days === 1 ? daily.error : history.error);
  const logsLoading = !preview && (days === 1 ? daily.isPending : history.isPending);
  const overviewError = !preview && (profile.error || cumulative.error || daily.error);
  const refresh = () => void Promise.allSettled([profile.refetch(), cumulative.refetch(), daily.refetch(), ...(days === 1 ? [] : [history.refetch()])]);
  const refreshing = profile.isFetching || cumulative.isFetching || daily.isFetching;
  const usageOptions = allowedDays.map((value) => ({ value: String(value), label: value === 1 ? t('Today') : t('Past {{days}} days', { days: value }) }));

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

      {/* Token 使用情况 */}
      <div className='dashboard-token-usage'>
        <div className='dashboard-token-usage__header flex-wrap gap-3'>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>{t('Token usage')}</span>
          <Tabs value={String(days)} onChange={setUsageDays} items={usageOptions} variant='pill' size='sm' />
        </div>
        {logsLoading ? (
          <TokenUsageSkeleton />
        ) : usageError ? <div role='alert' className='space-y-3 p-5 text-sm text-ui-text-2'><p>{t('Unable to load token usage')}</p><Button variant='toggle' onClick={() => void (days === 1 ? daily.refetch() : history.refetch())}>{t('Retry')}</Button></div> : (
          <TokenUsageGrid data={activeRecentLogs} days={days} bucketCount={usageBucketCount} />
        )}
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

const createPreviewUsage = (days: number, bucketCount: number): UsageBucket[] => {
  const result: UsageBucket[] = [];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const bucketSeconds = Math.ceil(days * 86400 / bucketCount);
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = Math.floor(start.getTime() / 1000) + index * bucketSeconds;
    if (bucketStart > nowSeconds) break;
    const seed = (index * 17 + days * 31) % 29;
    if (seed < 9) continue;
    const prompt = (seed + 3) * 1820;
    result.push({ bucket_start: bucketStart, quota: 0, prompt_tokens: prompt, completion_tokens: Math.round(prompt * 0.28), cache_tokens: Math.round(prompt * 0.62), tokens: Math.round(prompt * 1.28), requests: seed * 3 });
  }
  return result;
};

const TokenUsageGrid = ({ data, days, bucketCount }: { data: UsageBucket[]; days: number; bucketCount: number }) => {
  const { t, i18n } = useTranslation();
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const startSeconds = Math.floor(start.getTime() / 1000);
  const bucketSeconds = Math.ceil(days * 86400 / bucketCount);
  const byBucket = new Map<number, UsageBucket>();
  data.forEach((item) => {
    const itemStart = Number(item.bucket_start);
    const index = Math.floor((itemStart - startSeconds) / bucketSeconds);
    if (index < 0 || index >= bucketCount) return;
    const previous = byBucket.get(index);
    byBucket.set(index, {
      ...previous,
      bucket_start: startSeconds + index * bucketSeconds,
      quota: Number(previous?.quota || 0) + Number(item.quota || 0),
      requests: Number(previous?.requests || 0) + Number(item.requests || 0),
      tokens: Number(previous?.tokens || 0) + Number(item.tokens || 0),
      prompt_tokens: Number(previous?.prompt_tokens || 0) + Number(item.prompt_tokens || 0),
      completion_tokens: Number(previous?.completion_tokens || 0) + Number(item.completion_tokens || 0),
      cache_tokens: Number(previous?.cache_tokens || 0) + Number(item.cache_tokens || 0),
    });
  });
  const cells: (Partial<UsageBucket> & { key: number; bucket_start: number; future: boolean })[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startSeconds + index * bucketSeconds;
    return { key: bucketStart, bucket_start: bucketStart, future: bucketStart > Date.now() / 1000, ...(byBucket.get(index) || {}) };
  });
  const nonZero = cells.map((cell) => Number(cell.tokens || 0)).filter(Boolean).sort((a, b) => a - b);
  const level = (tokens: number) => {
    if (!tokens || !nonZero.length) return 0;
    const rank = nonZero.findIndex((value) => value >= tokens) / Math.max(1, nonZero.length - 1);
    return Math.min(4, Math.max(1, Math.ceil(rank * 4)));
  };
  return (
    <div className='token-usage-card'>
      <div className='token-usage-grid'>
        {cells.map((cell) => {
          const total = Number(cell.tokens || 0);
          const from = new Date(cell.bucket_start * 1000);
          const to = new Date((cell.bucket_start + bucketSeconds) * 1000);
          const timeLabel = `${from.toLocaleString(i18n.language, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} - ${to.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}`;
          const title = `${timeLabel}\n${t('Total tokens')}: ${fmtTokens(total)}\n${t('Input')}: ${fmtTokens(cell.prompt_tokens || 0)} · ${t('Output')}: ${fmtTokens(cell.completion_tokens || 0)} · ${t('Cache')}: ${fmtTokens(cell.cache_tokens || 0)}`;
          return <span key={cell.key} className={`token-usage-cell level-${cell.future ? 0 : level(total)}`} title={title} aria-label={title} />;
        })}
      </div>
    </div>
  );
};

export default function Dashboard({ preview = false }: { preview?: boolean }) {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <DashboardContent key={`${identity}:${preview}`} preview={preview} />;
}
