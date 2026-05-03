/*
 * Charts card: tab bar + single full-width VChart.
 */
import React, { useMemo } from 'react';
import { VChart } from '@visactor/react-vchart';
import { PieChart } from 'lucide-react';
import Card from './Card';
import { applyTheme } from './vchartTheme';

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
  const themedSpec = useMemo(
    () => (active?.spec ? applyTheme(active.spec) : null),
    [active],
  );

  return (
    <Card
      className='h-full w-full'
      title={
        <>
          <PieChart size={15} className='text-ui-text-3' />
          {t('模型数据分析')}
        </>
      }
      action={
        <div className='flex items-center gap-0.5 -mr-1 flex-nowrap overflow-x-auto scrollbar-hide max-w-full'>
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setActiveChartTab(tb.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeChartTab === tb.key
                  ? 'bg-ui-bg-subtle text-ui-text font-medium'
                  : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      }
      bodyClass='p-2'
    >
      <div className='h-full min-h-[420px]'>
        {themedSpec && <VChart spec={themedSpec} option={{ mode: 'desktop-browser' }} />}
      </div>
    </Card>
  );
};

export default ChartsCard;
