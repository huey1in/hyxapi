/*
 * Single KPI card: label + big number + sparkline (or action).
 */
import React from 'react';
import { VChart } from '@visactor/react-vchart';
import { sparkSpec } from './vchartTheme';

const Skeleton = ({ width, height }) => (
  <div
    className='bg-ui-bg-subtle animate-pulse rounded'
    style={{ width, height }}
  />
);

const KPICard = ({
  label,
  value,
  trendData,
  trendColor,
  loading,
  action,
  onClick,
}) => {
  const hasSpark = !loading && Array.isArray(trendData) && trendData.length > 0;

  return (
    <div
      className={`relative bg-ui-bg-elevated border border-ui-border rounded-xl p-5 transition-colors ${onClick ? 'cursor-pointer hover:border-ui-text-3' : ''}`}
      onClick={onClick}
    >
      <div className='flex items-start justify-between gap-2 mb-2'>
        <span className='text-[11px] uppercase tracking-wider font-medium text-ui-text-3'>
          {label}
        </span>
        {action}
      </div>
      <div className='text-3xl font-medium text-ui-text leading-tight tabular-nums'>
        {loading ? <Skeleton width={88} height={32} /> : value}
      </div>
      <div className='h-9 mt-3 -mx-1'>
        {hasSpark && (
          <VChart spec={sparkSpec(trendData, trendColor)} option={{ mode: 'desktop-browser' }} />
        )}
      </div>
    </div>
  );
};

export default KPICard;
