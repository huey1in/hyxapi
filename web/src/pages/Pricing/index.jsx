import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, LayoutGrid, List } from 'lucide-react';
import {
  PageShell, Card, Input, Select, Table, Pagination, Tag,
  EmptyState, Loading, IconButton, Divider,
} from '../../components/ui';
import { useModelPricingData } from '../../hooks/model-pricing/useModelPricingData';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { calculateModelPrice, getModelPriceItems, getLobeHubIcon, getModelIcon } from '../../helpers';
import { QuotaTag, VendorTag } from './tags';

const PREVIEW_MODELS = [
  { model_name: 'gpt-4.1', vendor_name: 'OpenAI', vendor_icon: 'OpenAI', quota_type: 0, model_ratio: 1, completion_ratio: 4, enable_groups: ['default', 'production'] },
  { model_name: 'gpt-4o-mini', vendor_name: 'OpenAI', vendor_icon: 'OpenAI', quota_type: 0, model_ratio: 0.075, completion_ratio: 4, enable_groups: ['default'] },
  { model_name: 'claude-sonnet-4', vendor_name: 'Anthropic', vendor_icon: 'Claude.Color', quota_type: 0, model_ratio: 1.5, completion_ratio: 5, enable_groups: ['default', 'production'] },
  { model_name: 'claude-3.5-haiku', vendor_name: 'Anthropic', vendor_icon: 'Claude.Color', quota_type: 0, model_ratio: 0.4, completion_ratio: 5, enable_groups: ['default'] },
  { model_name: 'gemini-2.5-pro', vendor_name: 'Google', vendor_icon: 'Gemini.Color', quota_type: 0, model_ratio: 0.625, completion_ratio: 5, enable_groups: ['default'] },
  { model_name: 'gemini-2.5-flash', vendor_name: 'Google', vendor_icon: 'Gemini.Color', quota_type: 0, model_ratio: 0.15, completion_ratio: 4, enable_groups: ['default', 'production'] },
  { model_name: 'deepseek-chat', vendor_name: 'DeepSeek', vendor_icon: 'DeepSeek.Color', quota_type: 0, model_ratio: 0.14, completion_ratio: 2, enable_groups: ['default'] },
  { model_name: 'deepseek-reasoner', vendor_name: 'DeepSeek', vendor_icon: 'DeepSeek.Color', quota_type: 0, model_ratio: 0.275, completion_ratio: 8, enable_groups: ['production'] },
  { model_name: 'grok-4', vendor_name: 'xAI', vendor_icon: 'XAI', quota_type: 0, model_ratio: 1.5, completion_ratio: 5, enable_groups: ['production'] },
  { model_name: 'grok-3-mini', vendor_name: 'xAI', vendor_icon: 'XAI', quota_type: 0, model_ratio: 0.15, completion_ratio: 3.3, enable_groups: ['default'] },
  { model_name: 'mistral-large', vendor_name: 'Mistral AI', vendor_icon: 'Mistral.Color', quota_type: 0, model_ratio: 1, completion_ratio: 3, enable_groups: ['default'] },
  { model_name: 'mistral-small', vendor_name: 'Mistral AI', vendor_icon: 'Mistral.Color', quota_type: 0, model_ratio: 0.05, completion_ratio: 3, enable_groups: ['default', 'production'] },
];

const Pricing = ({ preview = false }) => {
  const { t } = useTranslation();
  usePageTitle(preview ? '' : t('模型广场'));

  const {
    loading, filteredModels, models,
    searchValue, handleChange,
    selectedGroup, setSelectedGroup, setFilterGroup,
    filterQuotaType, setFilterQuotaType,
    filterVendor, setFilterVendor,
    groupRatio, usableGroup,
    currency, setCurrency, siteDisplayType, tokenUnit, displayPrice,
    currentPage, setCurrentPage, pageSize,
    refresh,
  } = useModelPricingData(preview ? PREVIEW_MODELS : null);

  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/console') ? '/console/pricing' : '/pricing';
  const isTokens = siteDisplayType === 'TOKENS';
  const [viewMode, setViewMode] = useState('card');

  const goDetail = (row) => {
    if (!preview) navigate(basePath + '/model/' + encodeURIComponent(row.model_name), { state: { model: row } });
  };

  const priceOf = (record) =>
    calculateModelPrice({
      record, selectedGroup, groupRatio, tokenUnit, displayPrice,
      currency, quotaDisplayType: siteDisplayType,
    });

  // 选项
  const groupOptions = useMemo(() => {
    const opts = [{ value: 'all', label: t('最优倍率') }];
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
    const opts = [{ value: 'all', label: t('全部供应商') }];
    models.forEach((m) => {
      if (m.vendor_name && !seen.has(m.vendor_name)) {
        seen.add(m.vendor_name);
        opts.push({ value: m.vendor_name, label: m.vendor_name });
      }
    });
    if (models.some((m) => !m.vendor_name)) {
      opts.push({ value: 'unknown', label: t('未知供应商') });
    }
    return opts;
  }, [models, t]);

  const quotaOptions = [
    { value: 'all', label: t('全部计费方式') },
    { value: '0', label: t('按量计费') },
    { value: '1', label: t('按次计费') },
  ];

  const currencyOptions = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'CNY', label: 'CNY (¥)' },
    { value: 'CUSTOM', label: t('自定义货币') },
  ];

  const total = filteredModels.length;
  const pagedRows = useMemo(
    () => filteredModels.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredModels, currentPage, pageSize],
  );

  const renderPriceCell = (row) => {
    const pd = priceOf(row);
    if (!pd.isPerToken) {
      return <span className='tabular-nums text-ui-text'>{pd.price}</span>;
    }
    const items = getModelPriceItems(pd, t, siteDisplayType).slice(0, 2);
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

  const renderModelCard = (row) => {
    const pd = priceOf(row);
    const priceItems = pd.isPerToken ? getModelPriceItems(pd, t, siteDisplayType) : [];
    const gs = row.enable_groups || [];
    return (
      <Card key={row.model_name} interactive={preview ? undefined : 'lift'} onClick={preview ? undefined : () => goDetail(row)}>
        <div className='flex flex-col gap-3'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-2 min-w-0'>
              <span className='flex-shrink-0'>{getLobeHubIcon(getModelIcon(row.model_name, row.vendor_icon), 22)}</span>
              <div className='min-w-0'>
                <div className='font-medium text-ui-text truncate'>{row.model_name}</div>
                {row.vendor_name && <div className='text-xs text-ui-text-3 truncate'>{row.vendor_name}</div>}
              </div>
            </div>
            <QuotaTag type={row.quota_type} t={t} />
          </div>

          <Divider />

          {!pd.isPerToken ? (
            <div className='flex items-baseline justify-between'>
              <span className='text-xs text-ui-text-3'>{isTokens ? t('倍率') : t('价格')}</span>
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

          {gs.length > 0 && (
            <div className='flex flex-wrap gap-1'>
              {gs.slice(0, 3).map((g) => <Tag key={g}>{g}</Tag>)}
              {gs.length > 3 && <span className='text-[11px] text-ui-text-3 self-center'>+{gs.length - 3}</span>}
            </div>
          )}
        </div>
      </Card>
    );
  };

  const columns = [
    {
      key: 'model_name',
      title: t('模型名称'),
      render: (row) => <span className='font-medium text-ui-text'>{row.model_name}</span>,
    },
    {
      key: 'vendor',
      title: t('供应商'),
      render: (row) => <VendorTag name={row.vendor_name} icon={row.vendor_icon} />,
    },
    {
      key: 'quota_type',
      title: t('计费方式'),
      render: (row) => <QuotaTag type={row.quota_type} t={t} />,
    },
    {
      key: 'price',
      title: isTokens ? t('倍率') : t('价格'),
      render: renderPriceCell,
    },
    {
      key: 'groups',
      title: t('可用分组'),
      render: (row) => {
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
      title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{t('模型广场')}</span>}
      actions={preview ? null :
        <>
          <div className='inline-flex items-center gap-0.5 rounded-xl border border-ui-border p-0.5'>
            <IconButton icon={LayoutGrid} size='sm' shape='square' selected={viewMode === 'card'} title={t('卡片视图')} onClick={() => setViewMode('card')} />
            <IconButton icon={List} size='sm' shape='square' selected={viewMode === 'table'} title={t('列表视图')} onClick={() => setViewMode('table')} />
          </div>
          <IconButton icon={RefreshCw} variant='outline' shape='square' title={t('刷新')} onClick={refresh} />
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
              onChange={handleChange}
              placeholder={t('搜索模型 / 供应商 / 标签')}
              prefix={<Search size={15} />}
              clearable
              width='full'
            />
          </div>
          {/* 下拉菜单：移动端两列，sm 及以上回到行内单行 */}
          <div className='grid grid-cols-2 gap-2 sm:contents'>
            <div className='sm:w-[200px]'>
              <Select
                options={groupOptions}
                value={selectedGroup}
                onChange={(v) => { setSelectedGroup(v); setFilterGroup(v); }}
                width='full'
              />
            </div>
            <div className='sm:w-[160px]'>
              <Select
                options={quotaOptions}
                value={String(filterQuotaType)}
                onChange={(v) => setFilterQuotaType(v === 'all' ? 'all' : parseInt(v, 10))}
                width='full'
              />
            </div>
            <div className='sm:w-[170px]'>
              <Select
                options={vendorOptions}
                value={filterVendor}
                onChange={setFilterVendor}
                width='full'
              />
            </div>
            {!isTokens && (
              <div className='sm:w-[150px]'>
                <Select
                  options={currencyOptions}
                  value={currency}
                  onChange={setCurrency}
                  width='full'
                />
              </div>
            )}
          </div>
          <span className='text-sm text-ui-text-3 tabular-nums sm:ml-auto'>
            {t('共 {{count}} 个模型', { count: total })}
          </span>
        </div>
      </div>

      <div className='pricing-results mt-4' style={{ minHeight: 'calc(100vh - 320px)' }}>
        {loading ? (
          <Card><div className='py-10'><Loading /></div></Card>
        ) : total === 0 ? (
          <Card>
            <EmptyState
              icon={null}
              title={t('暂无模型')}
              description={t('当前筛选条件下没有可展示的模型')}
            />
          </Card>
        ) : (
          <div>
            {viewMode === 'card' ? (
              <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4'>
                {pagedRows.map((row) => renderModelCard(row))}
              </div>
            ) : (
              <Table
                columns={columns}
                rows={pagedRows}
                rowKey={(row) => row.model_name}
                onRowClick={(row) => goDetail(row)}
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
