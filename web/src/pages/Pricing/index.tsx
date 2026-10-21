import { PricingCardsSkeleton } from '../../components/layout/PageSkeletons';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, LayoutGrid, List, SlidersHorizontal, PackageOpen } from 'lucide-react';
import { Card, Input, Table, Pagination, Tag, EmptyState, IconButton, Divider, Button } from '../../components/ui';
import { useModelPricingData } from '../../hooks/model-pricing/useModelPricingData';
import { calculateModelPrice, getModelPriceItems, getLobeHubIcon, getModelIcon } from '../../helpers';
import { QuotaTag, VendorTag } from './tags';
import { usePerformanceSummary } from '../../features/performance-metrics/api';
import { PerformanceBadge } from '../../features/performance-metrics/PerformancePanel';
import { DynamicPricingSummary } from '../../features/pricing/DynamicPricingDetails';
import PricingFiltersDialog from './PricingFiltersDialog';
import type { PricingFilterValues } from './PricingFiltersDialog';

import type { PricingModel } from '../../features/pricing/types';
import type { TableColumn } from '../../components/ui/layout/Table';
import { parsePricingSort } from '../../features/pricing/catalog-data';

const Pricing = () => {
  const { t } = useTranslation();

  const {
    loading, error, filteredModels, models,
    searchValue, handleChange,
    selectedGroup, setSelectedGroup, setFilterGroup,
    filterQuotaType, setFilterQuotaType,
    filterVendor, setFilterVendor,
    groupRatio, usableGroup,
    tokenUnit, displayPrice, showRechargePrice, setShowRechargePrice,
    currentPage, setCurrentPage, pageSize,
    refresh, sortBy, setSortBy, setTokenUnit, pricingNow,
  } = useModelPricingData();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const activeFilters = [selectedGroup !== 'all', filterQuotaType !== 'all', filterVendor !== 'all', sortBy !== 'name', tokenUnit !== 'M', showRechargePrice].filter(Boolean).length;
  const updateQuery = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams); if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has('endpointType') || query.has('currency') || query.has('tag')) {
      query.delete('endpointType'); query.delete('currency'); query.delete('tag');
      setSearchParams(query, { replace: true });
    }
    const vendor = query.get('vendor'); setFilterVendor(vendor === 'Unknown' ? 'unknown' : vendor || 'all');
    const group = query.get('group') || 'all'; setSelectedGroup(group); setFilterGroup(group);
    const billing = query.get('quotaType'); setFilterQuotaType(billing === 'token' ? 'tokens' : ['tokens', 'request', 'task', 'expression'].includes(billing ?? '') ? billing! : 'all');
    setSortBy(parsePricingSort(query.get('sort'))); setTokenUnit(query.get('tokenUnit') === 'K' ? 'K' : 'M');
    setShowRechargePrice(query.get('rechargePrice') === 'true');
    handleChange(query.get('search') || ''); setViewMode(query.get('view') === 'table' ? 'table' : 'card');
  }, [location.search, setSearchParams, setFilterVendor, setSelectedGroup, setFilterGroup, setFilterQuotaType, setSortBy, setTokenUnit, setShowRechargePrice, handleChange]);
  const applyFilters = (values: PricingFilterValues) => {
    setSelectedGroup(values.group); setFilterGroup(values.group); setFilterQuotaType(values.billing); setFilterVendor(values.vendor); setSortBy(values.sort);
    setTokenUnit(values.tokenUnit); setShowRechargePrice(values.priceBasis === 'recharge'); setCurrentPage(1);
    const next = new URLSearchParams(searchParams);
    const parameters = { group: values.group, quotaType: values.billing, vendor: values.vendor, sort: values.sort === 'name' ? 'all' : values.sort, tokenUnit: values.tokenUnit === 'M' ? 'all' : values.tokenUnit, rechargePrice: values.priceBasis === 'recharge' ? 'true' : 'all' };
    for (const [key, value] of Object.entries(parameters)) { if (value === 'all') next.delete(key); else next.set(key, value); }
    setSearchParams(next, { replace: true });
    setFiltersOpen(false);
  };

  const goDetail = (row: PricingModel) => {
    navigate('/pricing/model/' + encodeURIComponent(row.model_name) + location.search);
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

  const total = filteredModels.length;
  const pagedRows = useMemo(
    () => filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredModels, currentPage, pageSize],
  );

  const performance = usePerformanceSummary(pagedRows.map((row: PricingModel) => row.model_name), !loading && !error && models.length > 0);
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
      <Card key={row.model_name} data-pricing-model={row.model_name} interactive='lift' onClick={() => goDetail(row)}>
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

          <div className='mt-3'>{renderPerformance(row)}</div>

          {row.description && (
            <p className='mt-4 mb-0 min-h-10 text-xs leading-5 text-ui-text-3 line-clamp-2'>
              {row.description}
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
    { key: 'performance', title: t("Performance"), render: renderPerformance },
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
    <div className='console-content-page'>
      <ConsolePageHeader title={t('Models')} />
      <div>
        <div className='pricing-filter-panel flex flex-wrap items-center gap-2 rounded-2xl border border-ui-border bg-[var(--page-bg)] p-4'>
          <div className='min-w-0 basis-full sm:w-[320px] sm:basis-auto'>
            <Input value={searchValue} aria-label={t('Search models, vendors or tags')} onChange={(value) => { handleChange(value); updateQuery('search', value); }} placeholder={t('Search models, vendors or tags')} prefix={<Search size={15} />} clearable width='full' />
          </div>
          <div className='ml-auto flex shrink-0 items-center gap-1 sm:gap-2'>
            <div className='flex shrink-0 items-center gap-1 sm:gap-3'>
              <Button ref={filtersButton} variant='toggle' icon={SlidersHorizontal} shrink={false} selected={activeFilters > 0} aria-label={t('Filters')} aria-haspopup='dialog' aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
                {t('Filters')}{activeFilters > 0 && <span className='text-xs tabular-nums'>{activeFilters}</span>}
              </Button>
              {activeFilters > 0 && <Button variant='link' size='sm' onClick={() => {
                applyFilters({ group: 'all', billing: 'all', vendor: 'all', sort: 'name', tokenUnit: 'M', priceBasis: 'standard' });
                filtersButton.current?.focus();
              }}>{t('Reset filters')}</Button>}
            </div>
            <div className='inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-ui-border p-0.5'>
              <IconButton icon={LayoutGrid} size='sm' shape='square' selected={viewMode === 'card'} title={t("Card view")} onClick={() => { setViewMode('card'); updateQuery('view', 'card'); }} />
              <IconButton icon={List} size='sm' shape='square' selected={viewMode === 'table'} title={t("Table view")} onClick={() => { setViewMode('table'); updateQuery('view', 'table'); }} />
            </div>
          </div>
        </div>

        {filtersOpen && <PricingFiltersDialog initialValues={{ group: selectedGroup, billing: filterQuotaType, vendor: filterVendor, sort: sortBy, tokenUnit, priceBasis: showRechargePrice ? 'recharge' : 'standard' }} groupOptions={groupOptions} vendorOptions={vendorOptions} onApply={applyFilters} onClose={() => setFiltersOpen(false)} />}

        <div className='pricing-results mt-4' style={{ minHeight: 'calc(100vh - 320px)' }}>
          {loading ? (
            viewMode === 'card' ? <PricingCardsSkeleton /> : <Table loading columns={columns} rows={[]} />
          ) : error ? (<Card><div role='alert' className='space-y-3'><p>{t('Unable to load model pricing')}</p><Button onClick={() => void refresh()}>{t('Retry')}</Button></div></Card>) : total === 0 ? (
            <Card className='pricing-empty-state flex min-h-[max(480px,65dvh)] items-center justify-center sm:min-h-[max(560px,65dvh)]'>
              <EmptyState
                icon={PackageOpen}
                iconVariant='plain'
                title={t("No models")}
                description={t("No models match the current filters")}
              />
            </Card>
          ) : (
            <div>
              {viewMode === 'card' ? (
                <div className='pricing-model-grid grid'>
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
      </div>
    </div>
  );
};

export default Pricing;
