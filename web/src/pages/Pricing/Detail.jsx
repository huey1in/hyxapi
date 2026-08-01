import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Copy } from 'lucide-react';
import {
  PageShell, Card, Tag, Table, Button, Divider, Loading, EmptyState,
} from '../../components/ui';
import { useModelPricingData } from '../../hooks/model-pricing/useModelPricingData';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { API, calculateModelPrice, getModelPriceItems, getLobeHubIcon, getModelIcon } from '../../helpers';
import { QuotaTag, VendorTag } from './tags';
import StatusBar from './StatusBar';

const HEAT_MIN_CALLS = 5; // 近窗口调用数低于此值视为热度不高
const STATE_META = {
  up: { tone: 'success', label: '正常' },
  degraded: { tone: 'warning', label: '波动' },
  down: { tone: 'danger', label: '异常' },
};

const summarizeHistory = (entry) => {
  const hist = entry?.history || [];
  let calls = 0, errs = 0, latSum = 0, latN = 0, promptTokens = 0, cacheTokens = 0;
  hist.forEach((r) => {
    calls += r.total || 0;
    errs += r.errors || 0;
    if ((r.total || 0) > 0 && r.latency > 0) { latSum += r.latency; latN++; }
    promptTokens += r.prompt_tokens || 0;
    cacheTokens += r.cache_tokens || 0;
  });
  return {
    calls,
    errs,
    successRate: calls > 0 ? 1 - errs / calls : null,
    avgLatency: latN > 0 ? Math.round(latSum / latN) : null,
    promptTokens,
    cacheTokens,
    cacheRate: promptTokens > 0 ? cacheTokens / promptTokens : null,
  };
};


const SectionLabel = ({ children }) => (
  <div className='text-xs font-medium uppercase tracking-wide text-ui-text-3'>{children}</div>
);

const PricingDetail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const modelName = decodeURIComponent(params['*'] || '');

  const {
    loading, models,
    selectedGroup, groupRatio, usableGroup, tokenUnit, displayPrice,
    copyText,
  } = useModelPricingData();

  const model = useMemo(() => {
    if (location.state?.model) return location.state.model;
    return models.find((m) => m.model_name === modelName) || null;
  }, [location.state, models, modelName]);

  usePageTitle(model ? model.model_name : t('模型详情'));

  const [statusByGroup, setStatusByGroup] = useState({});
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (!model?.model_name) return;
    let cancelled = false;
    setStatusLoaded(false);
    (async () => {
      try {
        const res = await API.get('/api/model-health/status/' + encodeURIComponent(model.model_name));
        if (cancelled) return;
        const list = res?.data?.data || [];
        const map = {};
        list.forEach((entry) => { if (entry?.group) map[entry.group] = entry; });
        setStatusByGroup(map);
      } catch {
        if (!cancelled) setStatusByGroup({});
      } finally {
        if (!cancelled) setStatusLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [model?.model_name]);

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

  const priceColumns = [
    {
      key: 'item',
      title: t('价格项'),
      render: (row) => (
        <span className='text-ui-text-2'>
          {row.label}
          {row.suffix && <span className='text-ui-text-3 text-xs'>{row.suffix}</span>}
        </span>
      ),
    },
    ...groupPricing.map((pg) => ({
      key: pg.group,
      align: 'right',
      title: (
        <div className='text-right leading-tight'>
          <div className='text-ui-text'>{pg.group}</div>
          <div className='text-ui-text-3 font-normal text-[11px] tabular-nums'>×{pg.ratio}</div>
        </div>
      ),
      render: (row) => {
        const it = pg.items.find((x) => x.key === row.key);
        return <span className='tabular-nums text-ui-text font-medium'>{it ? it.value : '-'}</span>;
      },
    })),
  ];

  const metaSections = model ? [
    model.enable_groups?.length > 0 && { key: 'groups', label: t('可用分组'), items: model.enable_groups },
    model.supported_endpoint_types?.length > 0 && { key: 'endpoints', label: t('可用端点类型'), items: model.supported_endpoint_types },
    model.tags && {
      key: 'tags',
      label: t('标签'),
      items: model.tags.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean),
    },
  ].filter(Boolean) : [];

  const back = () => navigate(location.pathname.startsWith('/console') ? '/console/pricing' : '/pricing');

  return (
    <PageShell maxWidth='960px'>
      <div style={{ minHeight: 'calc(100vh - 220px)' }}>
        <div className='mb-4'>
          <Button variant='link' icon={ArrowLeft} onClick={back}>{t('返回模型广场')}</Button>
        </div>
        {loading && !model ? (
          <Card><div className='py-10'><Loading /></div></Card>
        ) : !model ? (
          <Card>
            <EmptyState
              icon={null}
              title={t('未找到模型')}
              description={modelName}
              action={<Button variant='secondary' onClick={back}>{t('返回模型广场')}</Button>}
            />
          </Card>
        ) : (
          <div className='flex flex-col gap-4'>
            {/* 概览 */}
            <Card>
              <div className='flex flex-col gap-4'>
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-14 h-14 rounded-2xl bg-ui-bg-subtle flex items-center justify-center'>
                    {getLobeHubIcon(getModelIcon(model.model_name, model.vendor_icon), 30)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='text-xl font-medium text-ui-text break-all leading-tight'>{model.model_name}</div>
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      <VendorTag name={model.vendor_name} icon={model.vendor_icon} />
                      <QuotaTag type={model.billing_type} t={t} />
                    </div>
                  </div>
                  <Button variant='secondary' icon={Copy} onClick={() => copyText(model.model_name)}>
                    {t('复制模型名')}
                  </Button>
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
                  <SectionLabel>{t('价格明细')}</SectionLabel>
                  {groupPricing.length > 1 && (
                    <span className='text-xs text-ui-text-3'>{t('共 {{count}} 个分组', { count: groupPricing.length })}</span>
                  )}
                </div>

                {priceRows.length === 0 ? (
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
                    size='sm'
                    hoverable={false}
                    columns={priceColumns}
                    rows={priceRows}
                    rowKey='key'
                  />
                )}
              </div>
            </Card>

            {/* 服务状态（按分组，基于真实调用日志被动聚合） */}
            {model.enable_groups?.length > 0 && (
              <Card>
                <div className='flex flex-col gap-4'>
                  <div className='flex items-center justify-between gap-2'>
                    <SectionLabel>{t('服务状态')}</SectionLabel>
                    <span className='text-xs text-ui-text-3'>{t('近期调用')}</span>
                  </div>
                  {!statusLoaded ? (
                    <div className='py-2'><Loading /></div>
                  ) : (
                    <div className='flex flex-col gap-5'>
                      {model.enable_groups.map((g) => {
                        const entry = statusByGroup[g];
                        const sum = summarizeHistory(entry);
                        const lowHeat = sum.calls < HEAT_MIN_CALLS;
                        const meta = STATE_META[entry?.current?.status] || null;
                        return (
                          <div key={g} className='flex flex-col gap-2'>
                            <div className='flex items-center justify-between gap-2'>
                              <div className='flex items-center gap-2'>
                                <Tag>{g}</Tag>
                                {!lowHeat && meta && <Tag tone={meta.tone}>{t(meta.label)}</Tag>}
                              </div>
                              {!lowHeat && (
                                <span className='text-xs text-ui-text-3 tabular-nums'>
                                  {sum.successRate !== null && <>{t('成功率')} {Math.round(sum.successRate * 100)}%</>}
                                  {sum.avgLatency !== null && <>{sum.successRate !== null ? ' · ' : ''}{t('延迟')} {(sum.avgLatency / 1000).toFixed(2)}s</>}
                                  {sum.cacheRate !== null && <>{(sum.successRate !== null || sum.avgLatency !== null) ? ' · ' : ''}{t('缓存率')} {(sum.cacheRate * 100).toFixed(1)}%</>}
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
                        <div className='sm:w-32 sm:flex-shrink-0 sm:pt-1'>
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
