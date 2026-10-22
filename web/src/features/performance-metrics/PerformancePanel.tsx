import { useState } from 'react';
import { Gauge } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Select, Tag, Table, ContentSkeleton } from '../../components/ui';
import { useModelPerformance } from './api';
import { formatLatency, formatSuccessRate, formatThroughput, successTone, trendSamples, ttftSamples } from './format';
import type { ModelSummary, SeriesPoint, SuccessPoint } from './types';
import Skeleton from '../../components/ui/feedback/Skeleton';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div className='min-w-0 rounded-xl bg-ui-bg-subtle p-3'>
    <div className='text-xs text-ui-text-3'>{label}</div>
    <div className='mt-1 text-base tabular-nums text-ui-text break-words'>{children}</div>
  </div>;
}

function MetricsSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='cards'><div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
    {['Request success rate', 'Average request latency', 'Output throughput'].map((label) => <Stat key={label} label={t(label)}><div className='flex h-6 items-center'><Skeleton width={80} height={16} className='[&>div]:bg-ui-border' /></div></Stat>)}
  </div></ContentSkeleton>;
}

function SuccessHistory({ points }: { points: SuccessPoint[] }) {
  const { t, i18n } = useTranslation();
  const samples = trendSamples(points, 'success_rate').slice(-24);
  if (!samples.length) return <span className='text-xs text-ui-text-3'>{t("No recent samples")}</span>;
  return <div className='flex gap-1 min-w-0' aria-label={t("Success rate for recent hours with samples")}>
    {samples.map((point) => <span key={point.ts} className={`h-5 flex-1 min-w-1 max-w-3 rounded-sm ${point.success_rate >= 99 ? 'bg-emerald-500' : point.success_rate >= 95 ? 'bg-amber-500' : 'bg-ui-danger'}`}
      title={`${new Date(point.ts * 1000).toLocaleString(i18n.language)} · ${formatSuccessRate(point.success_rate, i18n.language)}`} />)}
  </div>;
}

export function PerformanceBadge({ model, history }: { model?: ModelSummary; history?: SuccessPoint[] }) {
  const { t, i18n } = useTranslation();
  if (!model && !history?.length) return <span className='text-xs text-ui-text-3'>{t("No performance samples")}</span>;
  return <div className='flex flex-wrap items-center gap-2'>
    {model && <Tag tone={successTone(model.success_rate)}>{formatSuccessRate(model.success_rate, i18n.language)} {' '}{t("Success")}</Tag>}
    {!!history?.length && <SuccessHistory points={history} />}
  </div>;
}

function MetricsError({ retry }: { retry: () => void }) {
  const { t, i18n } = useTranslation();
  return <div className='flex flex-wrap items-center gap-2 text-xs text-ui-text-3' role='status'>{t("Unable to load performance metrics")}<Button size='sm' variant='link' onClick={retry}>{t("Retry")}</Button></div>;
}

function LatencyTrend({ points }: { points: SeriesPoint[] }) {
  const { t, i18n } = useTranslation();
  const samples = ttftSamples(points);
  if (!samples.length) return <p className='text-xs text-ui-text-3'>{t("No streaming first-token samples")}</p>;
  const maximum = Math.max(...samples.map((point) => point.avg_ttft_ms), 1);
  const start = samples[0].ts; const duration = Math.max(1, samples[samples.length - 1].ts - start);
  const x = (point: SeriesPoint) => samples.length === 1 ? 300 : 10 + (point.ts - start) / duration * 580;
  const y = (point: SeriesPoint) => 80 - point.avg_ttft_ms / maximum * 70;
  return <svg viewBox='0 0 600 96' className='w-full h-28 text-ui-text-2' role='img' aria-label={t("Average time to first token")}>
    <path d='M10 85H590' fill='none' stroke='var(--ui-border)' />
    <polyline points={samples.map((point) => `${x(point)},${y(point)}`).join(' ')} fill='none' stroke='currentColor' strokeWidth='1.5' />
    {samples.map((point) => <circle key={point.ts} cx={x(point)} cy={y(point)} r='3' fill='currentColor'>
      <title>{`${new Date(point.ts * 1000).toLocaleString(i18n.language)} · ${formatLatency(point.avg_ttft_ms, i18n.language)}`}</title>
    </circle>)}
  </svg>;
}

export function ModelPerformance({ model }: { model: string }) {
  const { t, i18n } = useTranslation();
  const [hours, setHours] = useState('24');
  const metrics = useModelPerformance(model, Number(hours));
  const summary = metrics.data?.summary;
  return <Card><section className='space-y-4' aria-label={t("Model performance")}>
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <h2 className='text-sm font-medium text-ui-text'>{t("Model performance")}</h2>
      <Select aria-label={t('Performance period')} value={hours} onChange={setHours} width={150} options={[
        { value: '24', label: t("Past 24 hours") }, { value: '168', label: t("Past 7 days") }, { value: '720', label: t("Past 30 days") },
      ]} />
    </div>
    {metrics.isLoading ? <MetricsSkeleton /> : metrics.isError ? <MetricsError retry={() => { void metrics.refetch(); }} /> : <>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
        <Stat label={t("Request success rate")}>{formatSuccessRate(summary?.success_rate, i18n.language)}</Stat>
        <Stat label={t("Average request latency")}>{formatLatency(summary?.avg_latency_ms, i18n.language)}</Stat>
        <Stat label={t("Output throughput")}>{formatThroughput(summary?.avg_tps, i18n.language)}</Stat>
      </div>
      {!summary ? <p className='text-xs text-ui-text-3'>{t("No actual call samples for this period")}</p> : <>
        <div className='space-y-2'><h3 className='text-xs text-ui-text-3'>{t("Average time to first token")}</h3><LatencyTrend points={metrics.data?.series ?? []} /></div>
        <div className='space-y-2'><h3 className='text-xs text-ui-text-3'>{t("Success rate history (last 24 hours with samples)")}</h3><SuccessHistory points={metrics.data?.series ?? []} /></div>
        <Table rows={metrics.data?.groups ?? []} rowKey='group' size='sm' emptyIcon={Gauge} columns={[
          { key: 'group', title: t('Group') },
          { key: 'ttft', title: t('Time to first token'), render: (group) => formatLatency(group.avg_ttft_ms, i18n.language) },
          { key: 'latency', title: t('Request latency'), render: (group) => formatLatency(group.avg_latency_ms, i18n.language) },
          { key: 'success', title: t('Success rate'), render: (group) => formatSuccessRate(group.success_rate, i18n.language) },
          { key: 'throughput', title: t('Throughput'), render: (group) => formatThroughput(group.avg_tps, i18n.language) },
        ]} />
      </>}
      <p className='text-xs text-ui-text-3'>{t("Based on actual calls. Business rejections and user cancellations are excluded from success rates. Empty periods have no samples.")}</p>
    </>}
  </section></Card>;
}
