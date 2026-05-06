/*
 * Top models breakdown — clean horizontal bar list, no chart library.
 */
import React from 'react';
import { renderNumber } from '../../../helpers';

const ModelBreakdown = ({ items = [], loading, t }) => {
  if (loading && items.length === 0) {
    return <div className='h-32 animate-pulse bg-ui-bg-subtle rounded-lg' />;
  }

  if (items.length === 0) {
    return (
      <div className='h-full min-h-[180px] flex items-center justify-center text-ui-text-3 text-sm'>
        {t('暂无数据')}
      </div>
    );
  }

  const total = items.reduce((s, it) => s + (it.count || 0), 0) || 1;
  const max = Math.max(...items.map((it) => it.count || 0), 1);

  return (
    <ul className='space-y-2.5'>
      {items.map((item) => {
        const pct = (item.count / max) * 100;
        const sharePct = ((item.count / total) * 100).toFixed(1);
        return (
          <li key={item.model} className='group'>
            <div className='flex items-baseline justify-between gap-2 mb-1'>
              <span className='text-[13px] text-ui-text font-medium truncate' title={item.model}>
                {item.model}
              </span>
              <span className='text-[11px] text-ui-text-3 tabular-nums shrink-0'>
                {renderNumber(item.count)} <span className='text-ui-text-3/60'>· {sharePct}%</span>
              </span>
            </div>
            <div className='relative h-1.5 rounded-full bg-ui-bg-subtle overflow-hidden'>
              <div
                className='absolute inset-y-0 left-0 rounded-full transition-all duration-500'
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || 'var(--ui-text)',
                  opacity: item.color ? 0.85 : 0.85,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default ModelBreakdown;
