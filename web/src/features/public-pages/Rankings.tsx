import Skeleton from '../../components/ui/feedback/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import type { ApiEnvelope } from '../../types/api';
import { Button, Card, PageShell, Select, Table, ContentSkeleton } from '../../components/ui';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { modelPricingLink, vendorPricingLink, rankingPeriod, rankingPeriods, rankingsSchema } from './rankings-data';
import type { RankingsSnapshot } from './rankings-data';
import RankingHistory from './RankingHistory';

export default function Rankings() {
  const { t, i18n } = useTranslation();
  usePageTitle(t('Rankings'));
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const [search, setSearch] = useSearchParams();
  const period = rankingPeriod(search.get('period'));
  const query = useQuery({
    queryKey: ['public-rankings', user?.id ?? 'anonymous', sid, period], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await API.get<ApiEnvelope<unknown>>('/api/rankings', { params: { period }, signal, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || 'Unable to load rankings data');
      return rankingsSchema.parse(response.data.data);
    },
  });
  const number = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(value);
  const percent = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1 }).format(value);
  const growth = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value / 100);
  const modelLink = (name: string) => <Link to={modelPricingLink(name)} className='underline break-all'>{name}</Link>;
  const vendorLink = (name: string) => <Link to={vendorPricingLink(name)} className='underline break-all'>{name === 'Unknown' ? t('Unknown') : name}</Link>;
  const movements = (title: string, rows: RankingsSnapshot['top_movers']) => <Card><div className='space-y-4'><h2 className='font-medium'>{title}</h2><Table loading={query.isPending} size='sm' rows={rows} rowKey='model_name' minWidth={400} emptyText={t('No rank changes for this period')} columns={[
    { key: 'model_name', title: t('Model'), render: (row) => <div className='space-y-1'>{modelLink(row.model_name)}<p className='text-xs text-ui-text-3'>{vendorLink(row.vendor)}</p></div> },
    { key: 'current_rank', title: t('Rank'), align: 'right' },
    { key: 'rank_delta', title: t('Rank change'), align: 'right', render: (row) => `${row.rank_delta > 0 ? '+' : ''}${row.rank_delta}` },
    { key: 'growth_pct', title: t('Growth'), align: 'right', render: (row) => growth(row.growth_pct) },
  ]} /></div></Card>;
  const snapshot = query.data;
  return <PageShell title={t('Rankings')} actions={<div className='flex flex-wrap gap-2'><Select aria-label={t('Ranking period')} width='auto' value={period} options={rankingPeriods.map((item) => ({ value: item.value, label: t(item.label) }))} onChange={(value) => { const next = new URLSearchParams(search); next.set('period', String(value)); setSearch(next); }} /><Button variant='secondary' loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh')}</Button></div>}>
    <p className='mb-6 text-sm text-ui-text-2'>{t('Model and vendor rankings based on actual token usage')}</p>
    {query.isError ? <Card><div role='alert' className='space-y-3'><p>{t('Unable to load rankings data')}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div></Card> : <div className='space-y-6'>
      <Card><div className='space-y-6'><h2 className='text-base font-medium'>{t('Top Models')}</h2>{query.isPending ? <ContentSkeleton variant='cards'><div className='space-y-4'><Skeleton width={180} height={24} /><Skeleton height={215} /><Skeleton width='60%' height={20} /></div></ContentSkeleton> : <RankingHistory key={`${period}-models`} title={t('Model token history')} points={snapshot?.models_history.points.map((point) => ({ ts: point.ts, label: point.label, name: point.model, value: point.tokens })) ?? []} order={snapshot?.models_history.models.map((model) => model.name) ?? []} />}
        <Table loading={query.isPending} rows={snapshot?.models ?? []} rowKey='model_name' minWidth={650} emptyText={t('No traffic data for this period')} columns={[
          { key: 'rank', title: t('Rank'), width: 60 },
          { key: 'model_name', title: t('Model'), render: (row) => modelLink(row.model_name) },
          { key: 'vendor', title: t('Vendor'), render: (row) => vendorLink(row.vendor) },
          { key: 'total_tokens', title: t('Tokens'), align: 'right', render: (row) => number(row.total_tokens) },
          { key: 'share', title: t('Token share'), align: 'right', render: (row) => percent(row.share) },
          { key: 'growth_pct', title: t('Growth'), align: 'right', render: (row) => growth(row.growth_pct) },
          { key: 'previous_rank', title: t('Previous rank'), align: 'right', render: (row) => row.previous_rank ?? t('New') },
        ]} />
      </div></Card>
      <Card><div className='space-y-6'><h2 className='text-base font-medium'>{t('Vendor market share')}</h2>{query.isPending ? <ContentSkeleton variant='cards'><div className='space-y-4'><Skeleton width={180} height={24} /><Skeleton height={215} /><Skeleton width='60%' height={20} /></div></ContentSkeleton> : <RankingHistory key={`${period}-vendors`} title={t('Vendor share history')} share points={snapshot?.vendor_share_history.points.map((point) => ({ ts: point.ts, label: point.label, name: point.vendor, value: point.share })) ?? []} order={snapshot?.vendor_share_history.vendors.map((vendor) => vendor.name) ?? []} />}
        <Table loading={query.isPending} rows={snapshot?.vendors ?? []} rowKey='vendor' minWidth={650} emptyText={t('No traffic data for this period')} columns={[
          { key: 'rank', title: t('Rank'), width: 60 }, { key: 'vendor', title: t('Vendor'), render: (row) => vendorLink(row.vendor) },
          { key: 'total_tokens', title: t('Tokens'), align: 'right', render: (row) => number(row.total_tokens) },
          { key: 'share', title: t('Token share'), align: 'right', render: (row) => percent(row.share) },
          { key: 'growth_pct', title: t('Growth'), align: 'right', render: (row) => growth(row.growth_pct) },
          { key: 'models_count', title: t('Models'), align: 'right' }, { key: 'top_model', title: t('Top model'), render: (row) => row.top_model ? modelLink(row.top_model) : '—' },
        ]} />
      </div></Card>
      <div className='grid grid-cols-1 xl:grid-cols-2 gap-6'>{movements(t('Trending up'), snapshot?.top_movers ?? [])}{movements(t('Trending down'), snapshot?.top_droppers ?? [])}</div>
    </div>}
  </PageShell>;
}
