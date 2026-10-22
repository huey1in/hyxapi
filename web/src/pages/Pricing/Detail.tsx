import { ParagraphSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import { PricingDetailSkeleton } from '../../components/layout/PageSkeletons';
import React, { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { healthSchema, summarizeHealth as summarizeHistory } from '../../features/pricing/health-data';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Coins, Copy, SearchX } from 'lucide-react';
import { PageShell, Card, Tag, Table, Button, Divider, EmptyState, Select } from '../../components/ui';
import { useModelPricingData } from '../../hooks/model-pricing/useModelPricingData';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { API, calculateModelPrice, getModelPriceItems, getLobeHubIcon, getModelIcon } from '../../helpers';
import { QuotaTag, VendorTag } from './tags';
import StatusBar from './StatusBar';
import { ModelPerformance } from '../../features/performance-metrics/PerformancePanel';
import { DynamicPricingDetails } from '../../features/pricing/DynamicPricingDetails';
import { modelNameFromPricingPath } from '../../lib/model-pricing-route';
import ModelApiExamples from '../../features/pricing/ModelApiExamples';

const HEAT_MIN_CALLS = 5; // 近窗口调用数低于此值视为热度不高
const STATE_META: Record<string, { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  up: { tone: 'success', label: "Normal" },
  degraded: { tone: 'warning', label: "Degraded" },
  down: { tone: 'danger', label: "Abnormal" },
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className='text-xs font-medium uppercase tracking-wide text-ui-text-3'>{children}</div>
);

const PricingDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const modelName = modelNameFromPricingPath(location.pathname) ?? '';

  const {
    loading, error, refresh, models, currency, setCurrency, setTokenUnit, siteDisplayType,
    selectedGroup, groupRatio, usableGroup, tokenUnit, displayPrice,
    copyText, showRechargePrice, setShowRechargePrice, supportedEndpoints, autoGroups,
  } = useModelPricingData();

  const model = useMemo(() => {
    return models.find((m) => m.model_name === modelName) ?? null;
  }, [models, modelName]);
  const autoChain = autoGroups.filter((group) => model?.enable_groups.includes(group));

  usePageTitle(model ? model.model_name : t("Model details"));

  const [expressionGroup, setExpressionGroup] = useState('');
  const userId = useAuthStore((state) => state.auth.user?.id);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const health = useQuery({
    queryKey: ['model-health', userId, sid, modelName], enabled: !!model, gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await API.get('/api/model-health/status', { params: { model: modelName }, signal, disableDuplicate: true, skipErrorHandler: true });
      signal.throwIfAborted(); if (!response.data.success) throw new Error('Unable to load service status');
      return healthSchema.parse(response.data.data);
    },
  });
  const statusByGroup = new Map((health.isError ? [] : health.data ?? []).map((entry) => [entry.group, entry]));
  useEffect(() => {
    setExpressionGroup('');
    const query = new URLSearchParams(location.search); setTokenUnit(query.get('tokenUnit') === 'K' ? 'K' : 'M');
    setShowRechargePrice(query.get('rechargePrice') === 'true');
    const nextCurrency = query.get('currency'); if (nextCurrency === 'USD' || nextCurrency === 'CNY' || nextCurrency === 'CUSTOM') setCurrency(nextCurrency);
  }, [modelName, location.search, siteDisplayType, setTokenUnit, setCurrency, setShowRechargePrice]);

  // 同一模型在其各可用分组下的价格（按分组倍率分别计算）
  const groupPricing = useMemo(() => {
    if (!model) return [];
    const withRatio = (model.enable_groups || []).filter((g) => groupRatio?.[g] !== undefined);
    const targets = withRatio.length ? withRatio : [selectedGroup];
    return targets.map((g) => {
      const pd = calculateModelPrice({
        record: model, selectedGroup: g, groupRatio, tokenUnit, displayPrice,
      });
      return {
        group: pd.usedGroup || g,
        ratio: pd.usedGroupRatio,
        desc: usableGroup?.[pd.usedGroup || g],
        items: getModelPriceItems(pd, t),
      };
    });
  }, [model, groupRatio, usableGroup, selectedGroup, tokenUnit, displayPrice, t]);

  const priceRows = groupPricing[0]?.items.map((it) => ({ key: it.key, label: it.label, suffix: it.suffix })) || [];
  const activeExpressionGroup = groupPricing.find((entry) => entry.group === expressionGroup) || groupPricing[0];

  const priceColumns: TableColumn<{ key: string; label: string; suffix?: string }>[] = [
    {
      key: 'item',
      title: t("Price item"),
      render: (row) => (
        <span className='text-ui-text-2'>
          {row.label}
          {row.suffix && <span className='text-ui-text-3 text-xs'>{row.suffix}</span>}
        </span>
      ),
    },
    ...groupPricing.map((pg) => ({
      key: pg.group,
      align: 'right' as const,
      title: (
        <div className='text-right leading-tight'>
          <div className='text-ui-text'>{pg.group}</div>
          <div className='text-ui-text-3 font-normal text-[11px] tabular-nums'>×{pg.ratio}</div>
        </div>
      ),
      render: (row: { key: string; label: string; suffix?: string }) => {
        const it = pg.items.find((x) => x.key === row.key);
        return <span className='tabular-nums text-ui-text font-medium'>{it ? it.value : '-'}</span>;
      },
    })),
  ];

  const metaSections = useMemo(() => {
    const sections: { key: string; label: string; items: string[] }[] = [];
    if (model?.enable_groups.length) sections.push({ key: 'groups', label: t('Available groups'), items: model.enable_groups });
    if (model?.supported_endpoint_types?.length) sections.push({ key: 'endpoints', label: t('Available endpoint types'), items: model.supported_endpoint_types });
    if (model?.tags) sections.push({ key: 'tags', label: t('Tags'), items: model.tags.split(/[,;|]+/).map((tag) => tag.trim()).filter(Boolean) });
    return sections;
  }, [model, t]);

  const back = () => navigate('/pricing' + location.search);

  return (
    <PageShell maxWidth='960px'>
      <div style={{ minHeight: 'calc(100vh - 220px)' }}>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <Button variant='link' icon={ArrowLeft} onClick={back}>{t('Back to models')}</Button>
          <div className='flex flex-wrap gap-2'>
            <Select aria-label={t('Currency')} value={currency} options={[{ value: 'USD' as const, label: 'USD ($)' }, { value: 'CNY' as const, label: 'CNY (¥)' }, { value: 'CUSTOM' as const, label: t('Custom currency') }]} onChange={setCurrency} />
            <Select aria-label={t('Token price unit')} value={tokenUnit} options={[{ value: 'M' as const, label: t('Per 1M tokens') }, { value: 'K' as const, label: t('Per 1K tokens') }]} onChange={setTokenUnit} />
            <Select aria-label={t('Price basis')} value={showRechargePrice ? 'recharge' : 'standard'} options={[{ value: 'standard', label: t('Standard price') }, { value: 'recharge', label: t('Recharge price') }]} onChange={(value) => setShowRechargePrice(value === 'recharge')} />
          </div>
        </div>
        {error ? (<Card><div role='alert' className='space-y-3'><p>{t('Unable to load model pricing')}</p><Button onClick={() => void refresh()}>{t('Retry')}</Button></div></Card>) : loading && !model ? (
          <PricingDetailSkeleton />
        ) : !model ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title={t("Model not found")}
              description={modelName}
              action={<Button variant='secondary' onClick={back}>{t('Back to models')}</Button>}
            />
          </Card>
        ) : (
          <div className='flex flex-col gap-4'>
            {/* 概览 */}
            <Card>
              <div className='flex flex-col gap-4'>
                <div className='flex flex-wrap items-start gap-4'>
                  <div className='shrink-0 w-14 h-14 rounded-2xl bg-ui-bg-subtle flex items-center justify-center'>
                    {getLobeHubIcon(getModelIcon(model.model_name, model.vendor_icon), 30)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h1 className='text-xl font-medium text-ui-text break-all leading-tight'>{model.model_name}</h1>
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      <VendorTag name={model.vendor_name} icon={model.vendor_icon} />
                      <QuotaTag type={model.billing_plugin_variants?.length ? 'expression' : model.billing_type} t={t} />
                    </div>
                  </div>
                  <div className='w-full sm:w-auto'><Button variant='secondary' icon={Copy} onClick={() => copyText(model.model_name)}>
                    {t("Copy model name")}
                  </Button></div>
                </div>
                {model.description && (
                  <>
                    <Divider />
                    <p className='text-sm leading-relaxed text-ui-text-2'>{model.description}</p>
                  </>
                )}
              </div>
            </Card>

            {/* 价格（按分组） */}
            <Card>
              <div className='flex flex-col gap-3'>
                <div className='flex items-center justify-between gap-2'>
                  <SectionLabel>{t("Price details")}</SectionLabel>
                  {groupPricing.length > 1 && (
                    <span className='text-xs text-ui-text-3'>{t("{{count}} groups", { count: groupPricing.length })}</span>
                  )}
                </div>

                {autoChain.length > 0 && <div aria-label={t('Auto group chain')} className='flex flex-wrap items-center gap-2 text-xs text-ui-text-3'>
                  <span>{t('Auto group chain')}</span>
                  {autoChain.map((group, index) => <React.Fragment key={group}>{index > 0 && <span aria-hidden='true'>→</span>}<Tag>{group}</Tag></React.Fragment>)}
                </div>}

                {model.billing_mode === 'tiered_expr' || model.billing_plugin_variants?.length ? (
                  <>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Select aria-label={t('Pricing group')} value={activeExpressionGroup?.group || ''} options={groupPricing.map((entry) => ({ value: entry.group, label: `${entry.group} ×${entry.ratio}` }))} onChange={setExpressionGroup} />
                      <span className='text-xs text-ui-text-3'>{t("Selected group multiplier applied")}</span>
                    </div>
                    <p className='text-xs text-ui-text-3'>{t('Prices depend on actual usage, request parameters and the matched tier. The group multiplier applies at settlement.')}</p>
                    <DynamicPricingDetails model={model} tokenUnit={tokenUnit} groupRatioMultiplier={activeExpressionGroup?.ratio ?? 1} formatUSD={displayPrice} />
                  </>
                ) : priceRows.length === 0 ? (
                  <span className='text-sm text-ui-text-3'>-</span>
                ) : groupPricing.length === 1 ? (
                  <>
                    <div className='flex items-center gap-2'>
                      <Tag>{groupPricing[0].group}</Tag>
                      <span className='text-xs text-ui-text-3 tabular-nums'>×{groupPricing[0].ratio}</span>
                    </div>
                    <div className={`grid gap-3 ${groupPricing[0].items.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {groupPricing[0].items.map((it) => (
                        <div key={it.key} className='rounded-xl bg-ui-bg-subtle px-4 py-3'>
                          <div className='text-xs text-ui-text-3'>{it.label}</div>
                          <div className='mt-1 flex items-baseline gap-1'>
                            <span className='text-lg font-medium text-ui-text tabular-nums'>{it.value}</span>
                            {it.suffix && <span className='text-xs text-ui-text-3 truncate'>{it.suffix}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Table
                    emptyIcon={Coins}
                    size='sm'
                    hoverable={false}
                    columns={priceColumns}
                    rows={priceRows}
                    rowKey='key'
                  />
                )}
              </div>
            </Card>

            <ModelApiExamples model={model} endpoints={supportedEndpoints} />
            <ModelPerformance model={model.model_name} />

            {/* 服务状态（按分组，基于真实调用日志被动聚合） */}
            {model.enable_groups?.length > 0 && (
              <Card>
                <div className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between gap-2'>
                    <SectionLabel>{t("Service status")}</SectionLabel>
                    <span className='text-xs text-ui-text-3'>{t("Recent calls")}</span>
                  </div>
                  {health.isError ? (<div role='alert' className='flex flex-wrap items-center gap-3 text-xs text-ui-text-3'>{t('Unable to load service status')}<Button variant='link' onClick={() => void health.refetch()}>{t('Retry')}</Button></div>) : health.isPending ? (
                    <ParagraphSkeleton lines={2} />
                  ) : (
                    <div className='flex flex-col gap-5'>
                      {model.enable_groups.map((g) => {
                        const entry = statusByGroup.get(g);
                        const sum = summarizeHistory(entry);
                        const lowHeat = sum.calls < HEAT_MIN_CALLS;
                        const meta = STATE_META[entry?.current?.status ?? ''] || null;
                        return (
                          <div key={g} className='flex flex-col gap-2'>
                            <div className='flex items-center justify-between gap-2'>
                              <div className='flex items-center gap-2'>
                                <Tag>{g}</Tag>
                                {!lowHeat && meta && <Tag tone={meta.tone}>{t(meta.label)}</Tag>}
                              </div>
                              {!lowHeat && (
                                <span className='text-xs text-ui-text-3 tabular-nums'>
                                  {sum.successRate !== null && <>{t("Success rate")} {Math.round(sum.successRate * 100)}%</>}
                                  {sum.avgLatency !== null && <>{sum.successRate !== null ? ' · ' : ''}{t("Latency")} {(sum.avgLatency / 1000).toFixed(2)}s</>}
                                  {sum.cacheRate !== null && <>{(sum.successRate !== null || sum.avgLatency !== null) ? ' · ' : ''}{t("Cache rate")} {(sum.cacheRate * 100).toFixed(1)}%</>}
                                </span>
                              )}
                            </div>
                            <StatusBar history={entry?.history || []} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* 分组 / 端点 / 标签 */}
            {metaSections.length > 0 && (
              <Card>
                <div className='flex flex-col'>
                  {metaSections.map((sec, i) => (
                    <React.Fragment key={sec.key}>
                      {i > 0 && <Divider spacing='sm' />}
                      <div className='flex flex-col gap-2 sm:flex-row sm:gap-4'>
                        <div className='sm:w-32 sm:shrink-0 sm:pt-1'>
                          <SectionLabel>{sec.label}</SectionLabel>
                        </div>
                        <div className='flex flex-wrap gap-1.5'>
                          {sec.items.map((item) => <Tag key={item}>{item}</Tag>)}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default PricingDetail;
