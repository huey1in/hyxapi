import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { API, renderQuota } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { Button, Card, Checkbox, Loading, MultiSelect, Select } from '../../components/ui';
import { flowRowsSchema, flowTimeRange } from './data';
import { buildDashboardFlowData, getFlowStages } from './flow';
import { layoutFlow } from './layout';
import type { FlowLinkSelection, FlowMetric, FlowNodeFilter, FlowNodeKind, FlowOverflowMode, FlowRole } from './types';

const stageLabels: Record<FlowNodeKind, string> = { user: 'User', node: 'Node', token: 'Token', group: 'Group', model: 'Model', channel: 'Channel' };
const otherLabels: Record<FlowNodeKind, string> = { user: 'Other users', node: 'Other nodes', token: 'Other tokens', group: 'Other groups', model: 'Other models', channel: 'Other channels' };

function UsageFlowContent() {
  const { t, i18n } = useTranslation();
  const [status] = useContext(StatusContext);
  const auth = useAuthStore((state) => state.auth);
  const role: FlowRole = (auth.user?.role ?? 0) >= 100 ? 'root' : (auth.user?.role ?? 0) >= 10 ? 'admin' : 'user';
  const stages = useMemo(() => getFlowStages(role), [role]);
  const [visibleStages, setVisibleStages] = useState(stages);
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<FlowMetric>('quota');
  const [top, setTop] = useState(50);
  const [overflow, setOverflow] = useState<FlowOverflowMode>('aggregate');
  const [masked, setMasked] = useState(false);
  const [filters, setFilters] = useState<FlowNodeFilter[]>([]);
  const [activeNode, setActiveNode] = useState<FlowNodeFilter>();
  const [activeLink, setActiveLink] = useState<FlowLinkSelection>();
  const enabled = status.status?.enable_data_export !== false;
  const query = useQuery({
    queryKey: ['usage-flow', auth.user?.id, auth.session?.sid, role, days], enabled, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>(role === 'user' ? '/api/data/flow/self' : '/api/data/flow', { signal, params: flowTimeRange(days), disableDuplicate: true, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error('Unable to load usage flow');
      return flowRowsSchema.parse(data.data);
    },
  });
  const result = useMemo(() => buildDashboardFlowData(query.isError ? [] : query.data ?? [], metric, {
    role, visibleStages, selectedNodes: filters, topNodeLimit: top, overflowMode: overflow,
    maskSensitive: masked, activeNode, activeLink,
    deletedTokenLabel: (id) => t('Deleted token ({{id}})', { id }), otherNodeLabel: (kind) => t(otherLabels[kind]),
  }), [query.data, query.isError, metric, role, visibleStages, filters, top, overflow, masked, activeNode, activeLink, t]);
  const diagram = useMemo(() => layoutFlow(result.flow, visibleStages), [result.flow, visibleStages]);
  const value = (amount: number) => metric === 'quota' ? renderQuota(amount) : new Intl.NumberFormat(i18n.language).format(amount);
  const reset = () => { setFilters([]); setActiveNode(undefined); setActiveLink(undefined); };
  return <Card><section aria-label={t('Usage flow')} className='min-w-0 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-sm font-medium text-ui-text'>{t('Usage flow')}</h2><Button size='sm' variant='toggle' icon={RefreshCw} loading={query.isFetching} disabled={!enabled} onClick={() => void query.refetch()}>{t('Refresh')}</Button></div>
    <p className='text-xs text-ui-text-3'>{t('Hourly usage grouped by the dimensions available to your role. Historical totals without routing details remain in the usage charts.')}</p>
    <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4'>
      <Select aria-label={t('Flow period')} value={days} onChange={setDays} options={[{ value: 1, label: t('Today') }, { value: 7, label: t('Past 7 days') }, { value: 30, label: t('Past 30 days') }]} />
      <Select<FlowMetric> aria-label={t('Flow metric')} value={metric} onChange={setMetric} options={[{ value: 'quota', label: t('By quota') }, { value: 'tokens', label: t('By tokens') }, { value: 'requests', label: t('By requests') }]} />
      <Select aria-label={t('Nodes per stage')} value={top} onChange={setTop} options={[10, 20, 50, 100]} />
      <Select<FlowOverflowMode> aria-label={t('Overflow nodes')} value={overflow} onChange={setOverflow} options={[{ value: 'aggregate', label: t('Aggregate other nodes') }, { value: 'hide', label: t('Hide other nodes') }]} />
    </div>
    <Checkbox checked={masked} onChange={setMasked} label={t('Mask sensitive labels')} />
    <div className='flex flex-wrap gap-x-4 gap-y-2' role='group' aria-label={t('Visible flow stages')}>
      {stages.map((stage) => <Checkbox key={stage} checked={visibleStages.includes(stage)} disabled={visibleStages.length <= 2 && visibleStages.includes(stage)} label={t(stageLabels[stage])} onChange={(checked) => { setVisibleStages(stages.filter((item) => item === stage ? checked : visibleStages.includes(item))); reset(); }} />)}
    </div>
    <details className='rounded-xl border border-ui-border p-3'><summary className='cursor-pointer text-xs text-ui-text-2'>{t('Filter flow nodes')}</summary><div className='mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
      {visibleStages.map((stage) => <div key={stage} role='group' aria-label={t(stageLabels[stage])} className='min-w-0 space-y-1'>
        <span className='text-xs text-ui-text-3'>{t(stageLabels[stage])}</span>
        <MultiSelect value={filters.filter((item) => item.kind === stage).map((item) => item.id)} onChange={(ids) => { setFilters((current) => [...current.filter((item) => item.kind !== stage), ...ids.map((id) => ({ kind: stage, id }))]); setActiveNode(undefined); setActiveLink(undefined); }} options={result.filterOptions.nodes.filter((item) => item.kind === stage).map((item) => ({ value: item.value, label: item.label }))} placeholder={t('All')} />
      </div>)}
    </div></details>
    {(filters.length > 0 || activeNode || activeLink) && <Button size='sm' variant='link' onClick={reset}>{t('Clear flow selection')}</Button>}
    {!enabled ? <p className='text-sm text-ui-text-3'>{t('Usage data collection is disabled.')}</p> : query.isPending ? <Loading /> : query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-text-2'><p>{t('Unable to load usage flow')}</p><Button size='sm' variant='toggle' onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <>
      <div className='flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-ui-text-2' aria-label={t('Flow totals')}>
        <span>{t('Quota')}: {renderQuota(result.summary.quota)}</span><span>{t('Tokens')}: {new Intl.NumberFormat(i18n.language).format(result.summary.tokens)}</span><span>{t('Requests')}: {new Intl.NumberFormat(i18n.language).format(result.summary.requests)}</span>
      </div>
      {!diagram.links.length ? <p className='py-8 text-center text-sm text-ui-text-3'>{t('No usage flow data for this period.')}</p> : <div className='max-h-[640px] overflow-auto rounded-xl border border-ui-border'>
        <svg width={diagram.width} height={diagram.height} role='group' aria-label={t('Usage flow diagram')} className='block text-ui-text-2'>
          {visibleStages.map((stage, index) => <text key={stage} x={22 + index * (diagram.width - 130) / Math.max(1, visibleStages.length - 1)} y={20} fontSize={12} fill='currentColor'>{t(stageLabels[stage])}</text>)}
          {diagram.links.map((link) => <path key={`${link.source}:${link.target}`} d={link.path} fill='none' stroke={link.color} strokeWidth={Math.max(0.5, link.thickness)} opacity={link.dimmed ? 0.08 : link.highlighted ? 0.65 : 0.22} tabIndex={0} role='button' aria-label={`${link.sourceLabel} → ${link.targetLabel}: ${value(link.value)}`} onClick={() => { setActiveNode(undefined); setActiveLink((current) => current?.source === link.source && current.target === link.target ? undefined : { source: link.source, target: link.target }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true })); } }}>
            <title>{`${link.sourceLabel} → ${link.targetLabel}: ${value(link.value)} (${new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(link.share)})`}</title>
          </path>)}
          {diagram.nodes.map((node) => <g key={node.id} tabIndex={0} role='button' aria-label={`${t(stageLabels[node.kind])}: ${node.label}, ${value(node.value)}`} aria-pressed={node.highlighted === true} opacity={node.dimmed ? 0.25 : 1} className='cursor-pointer outline-ui-text' onClick={() => { setActiveLink(undefined); setActiveNode((current) => current?.id === node.id ? undefined : { kind: node.kind, id: node.id }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true })); } }}>
            <rect x={node.x} y={node.y} width={12} height={node.height} rx={2} fill={node.color} /><text x={node.x + 18} y={node.y + Math.min(node.height / 2 + 4, 14)} fontSize={11} fill='currentColor'>{node.label.length > 17 ? `${node.label.slice(0, 15)}…` : node.label}</text><title>{`${node.label}: ${value(node.value)}`}</title>
          </g>)}
        </svg>
      </div>}
    </>}
  </section></Card>;
}

export default function UsageFlow() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <UsageFlowContent key={identity} />;
}
