import Skeleton from '../../components/ui/feedback/Skeleton';
import { useRef, useState } from 'react';
import { Boxes } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { API } from '../../helpers';
import { Button, ContentSkeleton, EmptyState, Modal, Switch } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { metricMean, metricRatio, metricValue, recentMetrics } from './inference-status';
import type { InferenceMetric, InferenceStatus } from './inference-status';

type Channel = { id: number; type: number; name: string };
type Props = { channel: Channel; onClose: () => void; onSyncModels: () => void; onTestChannel: () => void };
type MetricRow = { label: string; value: number | undefined; unit?: 'percent' | 'seconds' | 'rate'; details?: string };
type MetricGroup = { title: string; hint?: string; rows: MetricRow[] };

function inferenceMetricGroups(provider: string, metrics: InferenceMetric[], recent: ReturnType<typeof recentMetrics> | undefined, t: TFunction): MetricGroup[] {
  const sglang = provider === 'sglang';
  const value = (name: string) => metricValue(metrics, `${provider}:${name}`);
  const mean = (name: string) => metricMean(metrics, `${provider}:${name}`);
  const groups: MetricGroup[] = [
    { title: t('Current load'), rows: [
      { label: t('Running requests'), value: value(sglang ? 'num_running_reqs' : 'num_requests_running') },
      { label: t('Waiting requests'), value: value(sglang ? 'num_queue_reqs' : 'num_requests_waiting') },
      { label: sglang ? t('Peak token pool usage') : t('Peak KV cache usage'), value: sglang
        ? metricValue(metrics, 'sglang:token_usage', {}, 'max')
        : metricValue(metrics, 'vllm:kv_cache_usage_perc', {}, 'max') ?? metricValue(metrics, 'vllm:gpu_cache_usage_perc', {}, 'max'), unit: 'percent' },
      sglang ? { label: t('Output token rate'), value: value('gen_throughput'), unit: 'rate' }
        : { label: t('Awake engines'), value: metricValue(metrics, 'vllm:engine_sleep_state', { sleep_state: 'awake' }) },
    ] },
    { title: t('Cumulative usage'), hint: t('Counts and averages accumulate since upstream metrics were initialized or reset.'), rows: [
      { label: t('Processed requests'), value: value(sglang ? 'num_requests_total' : 'request_success_total') },
      { label: t('Input tokens'), value: value('prompt_tokens_total') },
      { label: t('Output tokens'), value: value('generation_tokens_total') },
      ...(sglang ? [{ label: t('Cached tokens'), value: value('cached_tokens_total') }] : [
        { label: t('Prefix cache hit rate'), value: metricRatio(value('prefix_cache_hits_total'), value('prefix_cache_queries_total')), unit: 'percent' as const },
        { label: t('Speculative decoding acceptance rate'), value: metricRatio(value('spec_decode_num_accepted_tokens_total'), value('spec_decode_num_draft_tokens_total')), unit: 'percent' as const },
      ]),
      { label: t('Mean time to first token'), value: mean('time_to_first_token_seconds'), unit: 'seconds' },
      { label: t('Mean request latency'), value: mean('e2e_request_latency_seconds'), unit: 'seconds' },
      { label: t('Mean queue time'), value: mean(sglang ? 'queue_time_seconds' : 'request_queue_time_seconds'), unit: 'seconds' },
      { label: t('Mean time per output token'), value: sglang
        ? mean('inter_token_latency_seconds') ?? mean('time_per_output_token_seconds')
        : mean('request_time_per_output_token_seconds'), unit: 'seconds' },
    ] },
    { title: t('Recent sampling interval'), hint: recent ? t('Sample interval: {{seconds}} seconds', { seconds: recent.seconds.toFixed(2) })
      : t('Waiting for two comparable samples; sampling restarts after counters reset.'), rows: [
      { label: t('Input token rate'), value: metricRatio(metricValue(recent?.metrics ?? [], `${provider}:prompt_tokens_total`), recent?.seconds), unit: 'rate' },
      { label: t('Output token rate'), value: metricRatio(metricValue(recent?.metrics ?? [], `${provider}:generation_tokens_total`), recent?.seconds), unit: 'rate' },
      { label: t('Mean time to first token'), value: metricMean(recent?.metrics ?? [], `${provider}:time_to_first_token_seconds`), unit: 'seconds' },
      { label: t('Mean request latency'), value: metricMean(recent?.metrics ?? [], `${provider}:e2e_request_latency_seconds`), unit: 'seconds' },
    ] },
  ];
  if (sglang) {
    const workers = metrics.filter((metric) => ['sglang:cache_hit_rate', 'sglang:spec_accept_rate'].includes(metric.name));
    if (workers.length) groups.push({ title: t('Worker metrics'), rows: workers.map((metric) => ({
      label: metric.name === 'sglang:cache_hit_rate' ? t('Prefix cache hit rate') : t('Speculative decoding acceptance rate'),
      value: metric.value, details: JSON.stringify(metric.labels), unit: 'percent',
    })) });
  }
  return groups;
}

export default function InferenceStatusDialog({ channel, onClose, onSyncModels, onTestChannel }: Props) {
  const { t, i18n } = useTranslation();
  const provider = channel.type === 63 ? 'sglang' : 'vllm';
  const [autoRefresh, setAutoRefresh] = useState(true);
  const previous = useRef<InferenceStatus | undefined>(undefined);
  const user = useAuthStore((state) => state.auth.user);
  const canOperate = hasPermission(user, 'channel', 'operate');
  const canSync = canOperate && hasPermission(user, 'channel', 'write');
  const query = useQuery({
    queryKey: ['inference-status', channel.id, provider],
    queryFn: async ({ signal }) => {
      const { data } = await API.get(`/api/channel/${channel.id}/${provider}/status`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to fetch inference service status'));
      const snapshot = data.data as InferenceStatus;
      const recent = recentMetrics(snapshot, previous.current);
      previous.current = snapshot;
      return { snapshot, recent };
    },
    refetchInterval: autoRefresh ? 5000 : false,
    refetchIntervalInBackground: false, refetchOnWindowFocus: false, retry: false, gcTime: 0,
  });
  const snapshot = query.data?.snapshot;
  const groups = inferenceMetricGroups(provider, snapshot?.metrics ?? [], query.data?.recent, t);
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const format = (row: MetricRow) => row.value === undefined ? t('Unavailable')
    : row.unit === 'percent' ? `${number.format(row.value * 100)}%`
    : `${number.format(row.value)}${row.unit === 'seconds' ? t(' seconds') : row.unit === 'rate' ? ' tokens/s' : ''}`;
  const exportSnapshot = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${provider}-${channel.id}-${snapshot.sampled_at}.json`;
    link.click(); URL.revokeObjectURL(url);
  };
  return <Modal open title={`${t('{{provider}} status', { provider: provider === 'vllm' ? 'vLLM' : 'SGLang' })} · ${channel.name}`} width={800} onClose={onClose}
    onConfirm={onClose} footer={<Button onClick={onClose}>{t('Close')}</Button>}>
    <div className='flex flex-wrap items-center gap-2'>
      <Button size='sm' disabled={query.isFetching} onClick={() => query.refetch()}>{t('Refresh')}</Button>
      <Button size='sm' disabled={!canSync} onClick={onSyncModels}>{t('Sync models')}</Button>
      <Button size='sm' disabled={!canOperate} onClick={onTestChannel}>{t('Test connection')}</Button>
      <Button size='sm' disabled={!snapshot} onClick={exportSnapshot}>{t('Export snapshot')}</Button>
      <label className='flex items-center gap-2 text-xs text-ui-text-2'>
        <Switch size='sm' checked={autoRefresh} onChange={setAutoRefresh} />{t('Auto refresh (5 seconds)')}
      </label>
    </div>
    {query.isPending && <ContentSkeleton variant='cards'><div className='space-y-4'><div className='flex flex-wrap gap-6'><Skeleton width={120} height={20} /><Skeleton width={200} height={20} /></div><div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>{[0, 1, 2, 3].map((index) => <div key={index} className='border border-ui-border rounded-lg p-3 space-y-2'><Skeleton height={16} /><Skeleton width='65%' height={16} /></div>)}</div><h4 className='text-sm font-medium'>{t('Served models')}</h4><div className='border border-ui-border rounded-lg p-3 space-y-2'><Skeleton width={180} height={20} /><Skeleton width='60%' height={20} /><Skeleton width='45%' height={20} /></div><div className='grid sm:grid-cols-2 gap-2'>{[0, 1].map((index) => <div key={index} className='border border-ui-border rounded-lg p-3'><Skeleton height={20} /></div>)}</div></div></ContentSkeleton>}
    {query.isError && <p role='alert' className='text-sm text-ui-danger'>
      {snapshot ? t('Refresh failed. Showing the last successful snapshot.') : query.error.message}
    </p>}
    {snapshot && <>
      <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-ui-text-2'>
        <span>{t('Version:')}<strong className='break-all'>{snapshot.version || t('Unavailable')}</strong></span>
        <span>{t('Sampled at:')}{new Date(snapshot.sampled_at).toLocaleString(i18n.resolvedLanguage)}</span>
      </div>
      <dl className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs'>
        {Object.entries(snapshot.endpoints).map(([path, endpoint]) => <div key={path} className='border border-ui-border rounded-lg p-3 min-w-0'>
          <dt className='font-mono break-all'>{path}</dt>
          <dd className={endpoint.error ? 'text-ui-danger' : 'text-ui-text-2'}>
            {endpoint.error ? t('Unavailable') : t('Available')}{endpoint.status > 0 && ` · HTTP ${endpoint.status}`}
            {endpoint.error === 'invalid_response' && t(' · Invalid response')}
            {endpoint.error === 'response_too_large' && t(' · Response too large')}
          </dd>
        </div>)}
      </dl>
      {provider === 'sglang' && snapshot.endpoints['/metrics']?.error &&
        <p className='text-xs text-ui-text-2'>{t('Start SGLang with --enable-metrics to expose metrics.')}</p>}
      <section aria-label={t('Served models')} className='space-y-2'>
        <h4 className='text-sm font-medium'>{t('Served models')}</h4>
        {!snapshot.models.length && (snapshot.endpoints['/v1/models']?.error ? <p className='text-xs text-ui-text-3'>{t('Unavailable')}</p> : <EmptyState icon={Boxes} padding='sm' title={t('No models available')} />)}
        {snapshot.models.map((model) => <div key={model.id} className='border border-ui-border rounded-lg p-3 text-sm space-y-1 break-all'>
          <strong>{model.id}</strong><p className='text-ui-text-2'>{t('Model source:')}{model.root || t('Unavailable')}</p>
          <p className='text-ui-text-2'>{t('Maximum context tokens:')}{model.max_model_len == null ? t('Unavailable') : number.format(model.max_model_len)}</p>
        </div>)}
      </section>
      {groups.map((group) => <section key={group.title} aria-label={group.title} className='space-y-2'>
        <h4 className='text-sm font-medium'>{group.title}</h4>
        {group.hint && <p className='text-xs text-ui-text-3'>{group.hint}</p>}
        <dl className='grid sm:grid-cols-2 gap-2'>
          {group.rows.map((row) => <div key={`${row.label}:${row.details ?? ''}`} className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border border-ui-border rounded-lg p-3 text-sm'>
            <dt className='text-ui-text-2 break-words'>{row.label}</dt><dd className='tabular-nums'>{format(row)}</dd>
            {row.details && <dd className='col-span-2 text-xs text-ui-text-3 break-all'>{row.details}</dd>}
          </div>)}
        </dl>
      </section>)}
    </>}
  </Modal>;
}
