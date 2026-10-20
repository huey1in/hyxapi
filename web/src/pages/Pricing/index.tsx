import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, LayoutGrid, List } from 'lucide-react';
import {
  PageShell, Card, Input, Select, Table, Pagination, Tag,
  EmptyState, Loading, IconButton, Divider, Button,
} from '../../components/ui';
import { useModelPricingData } from '../../hooks/model-pricing/useModelPricingData';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { calculateModelPrice, getModelPriceItems, getLobeHubIcon, getModelIcon } from '../../helpers';
import { QuotaTag, VendorTag } from './tags';
import { usePerformanceSummary } from '../../features/performance-metrics/api';
import { PerformanceBadge } from '../../features/performance-metrics/PerformancePanel';
import { DynamicPricingSummary } from '../../features/pricing/DynamicPricingDetails';

import type { PricingModel } from '../../features/pricing/types';
import type { PricingCurrency } from '../../hooks/model-pricing/useModelPricingData';
import type { TableColumn } from '../../components/ui/layout/Table';
import { parsePricingSort, pricingSorts, pricingTags } from '../../features/pricing/catalog-data';

const PREVIEW_MODELS: PricingModel[] = [
  { quota_type: 0, model_name: 'gpt-4.1', vendor_name: 'OpenAI', vendor_icon: 'OpenAI', description: "A general model for complex reasoning, coding and long-context tasks.", billing_type: 'tokens', input_price: 2, output_price: 8, cache_read_price: 0.5, enable_groups: ['default', 'production'] },
  { quota_type: 0, model_name: 'gpt-4o-mini', vendor_name: 'OpenAI', vendor_icon: 'OpenAI', description: "Balances speed and cost for high-volume, lightweight tasks.", billing_type: 'tokens', input_price: 0.15, output_price: 0.6, cache_read_price: 0.075, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'claude-sonnet-4', vendor_name: 'Anthropic', vendor_icon: 'Anthropic', description: "A capable model for coding, agents and specialized work.", billing_type: 'tokens', input_price: 3, output_price: 15, cache_read_price: 0.3, enable_groups: ['default', 'production'] },
  { quota_type: 0, model_name: 'claude-3.5-haiku', vendor_name: 'Anthropic', vendor_icon: 'Anthropic', billing_type: 'tokens', input_price: 0.8, output_price: 4, cache_read_price: 0.08, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'gemini-2.5-pro', vendor_name: 'Google', vendor_icon: 'Gemini.Color', billing_type: 'tokens', input_price: 1.25, output_price: 10, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'gemini-2.5-flash', vendor_name: 'Google', vendor_icon: 'Gemini.Color', billing_type: 'tokens', input_price: 0.3, output_price: 2.5, enable_groups: ['default', 'production'] },
  { quota_type: 0, model_name: 'deepseek-chat', vendor_name: 'DeepSeek', vendor_icon: 'DeepSeek.Color', billing_type: 'tokens', input_price: 0.27, output_price: 1.1, cache_read_price: 0.07, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'deepseek-reasoner', vendor_name: 'DeepSeek', vendor_icon: 'DeepSeek.Color', billing_type: 'tokens', input_price: 0.55, output_price: 2.19, cache_read_price: 0.14, enable_groups: ['production'] },
  { quota_type: 0, model_name: 'grok-4', vendor_name: 'xAI', vendor_icon: 'XAI', billing_type: 'tokens', input_price: 3, output_price: 15, enable_groups: ['production'] },
  { quota_type: 0, model_name: 'grok-3-mini', vendor_name: 'xAI', vendor_icon: 'XAI', billing_type: 'tokens', input_price: 0.3, output_price: 0.5, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'mistral-large', vendor_name: 'Mistral AI', vendor_icon: 'Mistral.Color', billing_type: 'tokens', input_price: 2, output_price: 6, enable_groups: ['default'] },
  { quota_type: 0, model_name: 'mistral-small', vendor_name: 'Mistral AI', vendor_icon: 'Mistral.Color', billing_type: 'tokens', input_price: 0.1, output_price: 0.3, enable_groups: ['default', 'production'] },
];

const Pricing = ({ preview = false }: { preview?: boolean }) => {
  const { t } = useTranslation();
  usePageTitle(preview ? '' : t("Model Marketplace"));

  const {
    loading, error, filteredModels, models,
    searchValue, handleChange,
    selectedGroup, setSelectedGroup, setFilterGroup,
    filterQuotaType, setFilterQuotaType,
    filterVendor, setFilterVendor,
    groupRatio, usableGroup,
    currency, setCurrency, tokenUnit, displayPrice, siteDisplayType, showRechargePrice, setShowRechargePrice,
    currentPage, setCurrentPage, pageSize,
    refresh, filterEndpoint, setFilterEndpoint, filterTag, setFilterTag, sortBy, setSortBy, setTokenUnit, pricingNow,
  } = useModelPricingData(preview ? PREVIEW_MODELS : null);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const basePath = location.pathname.startsWith('/console') ? '/console/pricing' : '/pricing';
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const updateQuery = (key: string, value: string) => {
    if (preview) return;
    const next = new URLSearchParams(searchParams); if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    if (preview) return;
    const query = new URLSearchParams(location.search);
    const vendor = query.get('vendor'); setFilterVendor(vendor === 'Unknown' ? 'unknown' : vendor || 'all');
    const group = query.get('group') || 'all'; setSelectedGroup(group); setFilterGroup(group);
    const billing = query.get('quotaType'); setFilterQuotaType(billing === 'token' ? 'tokens' : ['tokens', 'request', 'task', 'expression'].includes(billing ?? '') ? billing! : 'all');
    setFilterEndpoint(query.get('endpointType') || 'all'); setFilterTag(query.get('tag') || 'all');
    setSortBy(parsePricingSort(query.get('sort'))); setTokenUnit(query.get('tokenUnit') === 'K' ? 'K' : 'M');
    setShowRechargePrice(query.get('rechargePrice') === 'true');
    handleChange(query.get('search') || ''); setViewMode(query.get('view') === 'table' ? 'table' : 'card');
    const nextCurrency = query.get('currency'); if (nextCurrency === 'USD' || nextCurrency === 'CNY' || nextCurrency === 'CUSTOM') setCurrency(nextCurrency);
  }, [location.search, preview, siteDisplayType, setCurrency, setFilterVendor, setSelectedGroup, setFilterGroup, setFilterQuotaType, setFilterEndpoint, setFilterTag, setSortBy, setTokenUnit, setShowRechargePrice, handleChange]);
  const clearFilters = () => {
    handleChange(''); setSelectedGroup('all'); setFilterGroup('all'); setFilterQuotaType('all'); setFilterVendor('all'); setFilterEndpoint('all'); setFilterTag('all'); setSortBy('name');
    if (!preview) { const next = new URLSearchParams(searchParams); for (const key of ['search', 'group', 'quotaType', 'vendor', 'endpointType', 'tag', 'sort']) next.delete(key); setSearchParams(next, { replace: true }); }
  };

  const goDetail = (row: PricingModel) => {
    if (!preview) navigate(basePath + '/model/' + encodeURIComponent(row.model_name) + location.search);
  };

  const priceOf = (record: PricingModel) =>
    calculateModelPrice({
      record, selectedGroup, groupRatio, tokenUnit, displayPrice,
    });

  // 选项
  const groupOptions = useMemo(() => {
    const opts = [{ value: 'all', label: t("Best group rate") }];
    Object.entries(usableGroup || {}).forEach(([key, desc]) => {
      if (!key) return;
      const ratio = groupRatio?.[key];
      const label = ratio !== undefined ? `${desc || key} (×${ratio})` : (desc || key);
      opts.push({ value: key, label });
    });
    return opts;
  }, [usableGroup, groupRatio, t]);

  const vendorOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: 'all', label: t("All vendors") }];
    models.forEach((m) => {
      if (m.vendor_name && !seen.has(m.vendor_name)) {
        seen.add(m.vendor_name);
        opts.push({ value: m.vendor_name, label: m.vendor_name });
      }
    });
    if (models.some((m) => !m.vendor_name)) {
      opts.push({ value: 'unknown', label: t("Unknown") });
    }
    return opts;
  }, [models, t]);

  const endpointOptions = [{ value: 'all', label: t('All protocols') }, ...[...new Set(models.flatMap((model) => model.supported_endpoint_types ?? []))].sort().map((endpoint) => ({ value: endpoint, label: endpoint }))];
  const tagOptions = [{ value: 'all', label: t('All tags') }, ...[...new Set(models.flatMap((model) => pricingTags(model.tags)))].sort().map((tag) => ({ value: tag, label: tag }))];
  const quotaOptions = [
    { value: 'all', label: t("All billing types") },
    { value: 'tokens', label: t("Pay as you go") },
    { value: 'request', label: t("Pay per request") },
    { value: 'expression', label: t("Expression billing") },
    { value: 'task', label: t('Task billing') },
  ];

  const currencyOptions: { value: PricingCurrency; label: string }[] = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'CNY', label: 'CNY (¥)' },
    { value: 'CUSTOM', label: t("Custom currency") },
  ];

  const total = filteredModels.length;
  const pagedRows = useMemo(
    () => filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredModels, currentPage, pageSize],
  );

  const performance = usePerformanceSummary(pagedRows.map((row: PricingModel) => row.model_name), !preview && !loading && !error && models.length > 0);
  const performanceModels = new Map((performance.data?.models || []).map((model) => [model.model_name, model]));
  const renderPerformance = (row: PricingModel) => <PerformanceBadge model={performanceModels.get(row.model_name)}
    history={performance.data?.recent_success_series?.[row.model_name] || performanceModels.get(row.model_name)?.recent_success_series} />;

  const renderPriceCell = (row: PricingModel) => {
    const pd = priceOf(row);
    if (pd.isExpression) return <DynamicPricingSummary model={row} tokenUnit={tokenUnit} groupRatioMultiplier={pd.usedGroupRatio} formatUSD={displayPrice} now={pricingNow} />;
    if (pd.configured === false) {
      return <span className='text-ui-text-3'>{t("Price not configured")}</span>;
    }
    if (!pd.isPerToken) {
      return <span className='tabular-nums text-ui-text'>{pd.price}</span>;
    }
    const items = getModelPriceItems(pd, t).slice(0, 2);
    if (items.length === 0) return <span className='text-ui-text-3'>-</span>;
    return (
      <div className='flex flex-col gap-0.5'>
        {items.map((it) => (
          <span key={it.key} className='text-xs text-ui-text-2 tabular-nums whitespace-nowrap'>
            <span className='text-ui-text-3'>{it.label}: </span>
            <span className='text-ui-text font-medium'>{it.value}</span>
          </span>
        ))}
      </div>
    );
  };

  const renderModelCard = (row: PricingModel) => {
    const pd = priceOf(row);
    const priceItems = pd.isPerToken ? getModelPriceItems(pd, t) : [];
    return (
      <Card key={row.model_name} interactive={preview ? undefined : 'lift'} onClick={preview ? undefined : () => goDetail(row)}>
        <div className='flex flex-col'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2 min-w-0'>
              <span className='shrink-0'>{getLobeHubIcon(getModelIcon(row.model_name, row.vendor_icon), 22)}</span>
              <div className='min-w-0'>
                <div className='font-medium text-ui-text truncate'>{row.model_name}</div>
                {row.vendor_name && <div className='text-xs text-ui-text-3 truncate'>{row.vendor_name}</div>}
              </div>
            </div>
            <div className='flex items-center gap-1.5'>
              <QuotaTag type={pd.isExpression ? 'expression' : row.billing_type} t={t} />
              {pd.configured === false && <Tag tone='warning'>{t("Price not configured")}</Tag>}
            </div>
          </div>

          {!preview && <div className='mt-3'>{renderPerformance(row)}</div>}

          {row.description && (
            <p className='mt-4 mb-0 min-h-10 text-xs leading-5 text-ui-text-3 line-clamp-2'>
              {preview ? t(row.description) : row.description}
            </p>
          )}

          <Divider />

          <div className='mt-3'>
          {pd.isExpression ? (
            <DynamicPricingSummary model={row} tokenUnit={tokenUnit} groupRatioMultiplier={pd.usedGroupRatio} formatUSD={displayPrice} now={pricingNow} />
          ) : !pd.isPerToken ? (
            <div className='flex items-baseline justify-between'>
              <span className='text-xs text-ui-text-3'>{t("Pricing")}</span>
              <span className='tabular-nums text-ui-text font-medium'>{pd.price}</span>
            </div>
          ) : priceItems.length === 0 ? (
            <span className='text-sm text-ui-text-3'>-</span>
          ) : (
            <div className='flex flex-col gap-1'>
              {priceItems.slice(0, 2).map((it) => (
                <div key={it.key} className='flex items-center justify-between text-xs'>
                  <span className='text-ui-text-3'>{it.label}</span>
                  <span className='tabular-nums text-ui-text font-medium'>
                    {it.value}<span className='text-ui-text-3 font-normal'>{it.suffix}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          </div>

        </div>
      </Card>
    );
  };

  const columns: TableColumn<PricingModel>[] = [
    {
      key: 'model_name',
      title: t("Model Name"),
      render: (row: PricingModel) => <span className='font-medium text-ui-text'>{row.model_name}</span>,
    },
    {
      key: 'vendor',
      title: t("Provider"),
      render: (row: PricingModel) => <VendorTag name={row.vendor_name} icon={row.vendor_icon} />,
    },
    {
      key: 'billing_type',
      title: t("Billing Mode"),
      render: (row: PricingModel) => <QuotaTag type={row.billing_plugin_variants?.length ? 'expression' : row.billing_type} t={t} />,
    },
    {
      key: 'price',
      title: t("Pricing"),
      render: renderPriceCell,
    },
    ...(!preview ? [{ key: 'performance', title: t("Performance"), render: renderPerformance }] : []),
    {
      key: 'groups',
      title: t("Available groups"),
      render: (row: PricingModel) => {
        const gs = row.enable_groups || [];
        if (gs.length === 0) return <span className='text-ui-text-3'>-</span>;
        return (
          <div className='flex flex-wrap gap-1'>
            {gs.slice(0, 3).map((g) => <Tag key={g}>{g}</Tag>)}
            {gs.length > 3 && <span className='text-[11px] text-ui-text-3'>+{gs.length - 3}</span>}
          </div>
        );
      },
    },
  ];

  return (
    <PageShell
      title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{t("Model Marketplace")}</span>}
      actions={preview ? null :
        <>
          <div className='inline-flex items-center gap-0.5 rounded-xl border border-ui-border p-0.5'>
            <IconButton icon={LayoutGrid} size='sm' shape='square' selected={viewMode === 'card'} title={t("Card view")} onClick={() => { setViewMode('card'); updateQuery('view', 'card'); }} />
            <IconButton icon={List} size='sm' shape='square' selected={viewMode === 'table'} title={t("Table view")} onClick={() => { setViewMode('table'); updateQuery('view', 'table'); }} />
          </div>
          <IconButton icon={RefreshCw} variant='outline' shape='square' title={t("Refresh")} disabled={loading} onClick={() => void refresh()} />
        </>
      }
    >
      {/* 筛选栏（用普通容器而非 Card，避免 overflow-hidden 裁剪下拉菜单） */}
      <div className='pricing-filter-panel border border-ui-border bg-[var(--page-bg)] rounded-2xl p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2'>
          {/* 搜索框：移动端单独占一行 */}
          <div className='w-full sm:w-[280px]'>
            <Input
              value={searchValue}
              aria-label={t('Search models, vendors or tags')}
              onChange={(value) => { handleChange(value); updateQuery('search', value); }}
              placeholder={t("Search models, vendors or tags")}
              prefix={<Search size={15} />}
              clearable
              width='full'
            />
          </div>
          {/* 下拉菜单：移动端两列，sm 及以上回到行内单行 */}
          <div className='grid grid-cols-2 gap-2 sm:contents'>
            <div className='sm:w-[200px]'>
              <Select
                aria-label={t('Group')}
                options={groupOptions}
                value={selectedGroup}
                onChange={(v) => { setSelectedGroup(v); setFilterGroup(v); updateQuery('group', v); }}
                width='full'
              />
            </div>
            <div className='sm:w-[160px]'>
              <Select
                aria-label={t('Billing type')}
                options={quotaOptions}
                value={String(filterQuotaType)}
                onChange={(v) => { setFilterQuotaType(v || 'all'); updateQuery('quotaType', v); }}
                width='full'
              />
            </div>
            <div className='sm:w-[170px]'>
              <Select
                aria-label={t('Vendor')}
                options={vendorOptions}
                value={filterVendor}
                onChange={(value) => { setFilterVendor(value); updateQuery('vendor', value); }}
                width='full'
              />
            </div>
            <div className='sm:w-[150px]'>
              <Select
                aria-label={t('Currency')}
                options={currencyOptions}
                value={currency}
                onChange={(value) => { setCurrency(value); updateQuery('currency', value); }}
                width='full'
              />
            </div>
          </div>
          <div className='grid w-full grid-cols-2 gap-2 sm:contents'>
            <div className='min-w-0 sm:w-[170px]'><Select aria-label={t('Protocol')} width='full' value={filterEndpoint} options={endpointOptions} onChange={(value) => { setFilterEndpoint(value); updateQuery('endpointType', value); }} /></div>
            <div className='min-w-0 sm:w-[170px]'><Select aria-label={t('Tag')} width='full' value={filterTag} options={tagOptions} onChange={(value) => { setFilterTag(value); updateQuery('tag', value); }} /></div>
            <div className='min-w-0 sm:w-[200px]'><Select aria-label={t('Sort models')} width='full' value={sortBy} options={pricingSorts.map((item) => ({ value: item.value, label: t(item.label) }))} onChange={(value) => { setSortBy(value); updateQuery('sort', value); }} /></div>
            <div className='min-w-0 sm:w-[150px]'><Select aria-label={t('Token price unit')} width='full' value={tokenUnit} options={[{ value: 'M' as const, label: t('Per 1M tokens') }, { value: 'K' as const, label: t('Per 1K tokens') }]} onChange={(value) => { setTokenUnit(value); updateQuery('tokenUnit', value); }} /></div>
            {!preview && <div className='min-w-0 sm:w-[170px]'><Select aria-label={t('Price basis')} width='full' value={showRechargePrice ? 'recharge' : 'standard'} options={[{ value: 'standard', label: t('Standard price') }, { value: 'recharge', label: t('Recharge price') }]} onChange={(value) => { setShowRechargePrice(value === 'recharge'); updateQuery('rechargePrice', value === 'recharge' ? 'true' : 'all'); }} /></div>}
          </div>
          <Button variant='link' onClick={clearFilters}>{t('Reset filters')}</Button>
          <span className='text-sm text-ui-text-3 tabular-nums sm:ml-auto'>
            {t("{{count}} models", { count: total })}
          </span>
        </div>
      </div>

      <div className='pricing-results mt-4' style={{ minHeight: 'calc(100vh - 320px)' }}>
        {loading ? (
          <Card><div className='py-10'><Loading /></div></Card>
        ) : error ? (<Card><div role='alert' className='space-y-3'><p>{t('Unable to load model pricing')}</p><Button onClick={() => void refresh()}>{t('Retry')}</Button></div></Card>) : total === 0 ? (
          <Card>
            <EmptyState
              icon={null}
              title={t("No models")}
              description={t("No models match the current filters")}
            />
          </Card>
        ) : (
          <div>
            {viewMode === 'card' ? (
              <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4'>
                {pagedRows.map((row: PricingModel) => renderModelCard(row))}
              </div>
            ) : (
              <Table
                columns={columns}
                rows={pagedRows}
                rowKey={(row: PricingModel) => row.model_name}
                onRowClick={(row: PricingModel) => goDetail(row)}
              />
            )}
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default Pricing;
