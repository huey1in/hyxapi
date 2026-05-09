/*
 * Charts card: tab pills + summary KPI + single full-width VChart.
 */
import React, { useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { Inbox } from 'lucide-react';
import Card from './Card';
import { applyTheme } from './vchartTheme';

const isSpecEmpty = (spec) => {
  if (!spec) return true;
  if (Array.isArray(spec.data)) {
    const hasValues = spec.data.some(
      (d) => Array.isArray(d.values) && d.values.length > 0 && !(
        d.values.length === 1 &&
        (d.values[0]?.value === '0' || d.values[0]?.value === 0 || d.values[0]?.type === 'null')
      ),
    );
    return !hasValues;
  }
  return false;
};

const extractSubtext = (spec) => {
  const t = spec?.title;
  if (!t) return '';
  if (typeof t.subtext === 'string') return t.subtext;
  if (Array.isArray(t.subtext)) return t.subtext.join(' ');
  return '';
};

const stripChartChrome = (spec) => {
  if (!spec) return spec;
  return {
    ...spec,
    title: { ...(spec.title || {}), visible: false },
    padding: spec.padding ?? { top: 8, right: 8, bottom: 4, left: 8 },
  };
};

const ChartsCard = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_user_rank,
  isAdminUser,
  t,
}) => {
  const tabs = useMemo(() => {
    const base = [
      { key: '1', label: t('消耗分布'), spec: spec_line },
      { key: '2', label: t('调用趋势'), spec: spec_model_line },
      { key: '3', label: t('调用次数分布'), spec: spec_pie },
      { key: '4', label: t('调用次数排行'), spec: spec_rank_bar },
    ];
    if (isAdminUser) {
      base.push({ key: '5', label: t('用户消耗排行'), spec: spec_user_rank });
    }
    return base;
  }, [t, spec_line, spec_model_line, spec_pie, spec_rank_bar, spec_user_rank, isAdminUser]);

  const active = tabs.find((tb) => tb.key === activeChartTab) || tabs[0];
  const subtext = extractSubtext(active?.spec);
  const empty = isSpecEmpty(active?.spec);

  const themedSpec = useMemo(() => {
    if (!active?.spec) return null;
    return applyTheme(stripChartChrome(active.spec));
  }, [active]);

  return (
    <Card
      className='h-full w-full'
      title={
        <span className='text-sm font-semibold text-ui-text'>
          {t('模型数据分析')}
        </span>
      }
      bodyClass='p-0'
    >
      {/* Tab pill bar */}
      <div className='border-b border-ui-divider px-3 py-2 overflow-x-auto scrollbar-hide'>
        <div className='flex items-center gap-1 min-w-max'>
          {tabs.map((tb) => {
            const isActive = activeChartTab === tb.key;
            return (
              <button
                key={tb.key}
                onClick={() => setActiveChartTab(tb.key)}
                className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-ui-accent text-ui-accent-fg shadow-sm'
                    : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                }`}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab heading + KPI */}
      <div className='flex items-center justify-between gap-3 px-5 pt-4 pb-2'>
        <div className='min-w-0'>
          <div className='text-sm font-semibold text-ui-text truncate'>
            {active?.label}
          </div>
          {subtext && (
            <div className='text-[11px] text-ui-text-3 mt-0.5 truncate'>
              {subtext}
            </div>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className='flex-1 min-h-[420px] px-3 pb-3 relative'>
        {empty ? (
          <div className='absolute inset-0 flex flex-col items-center justify-center text-ui-text-3'>
            <div className='w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-2'>
              <Inbox size={20} />
            </div>
            <div className='text-xs'>{t('暂无数据')}</div>
            <div className='text-[11px] mt-0.5'>{t('当前时间范围内没有调用记录')}</div>
          </div>
        ) : (
          themedSpec && <VChart spec={themedSpec} option={{ mode: 'desktop-browser' }} />
        )}
      </div>
    </Card>
  );
};

export default ChartsCard;
