/*
 * Bar chart styled like the BAI overview chart — pure flex/div implementation.
 */
import React, { useMemo, useState } from 'react';
import { renderQuota } from '../../../helpers';

const PLOT_HEIGHT = 240;
const Y_AXIS_WIDTH = 40;
const Y_TICKS = 6; // 7 labels (top..bottom)

const MonthlyBarChart = ({ data = [], loading, t, valueLabel = 'quota' }) => {
  const [hoverIdx, setHoverIdx] = useState(null);

  const max = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);
  const niceMax = useMemo(() => niceCeil(max), [max]);

  const tickValues = useMemo(
    () =>
      Array.from({ length: Y_TICKS + 1 }, (_, i) => (niceMax * (Y_TICKS - i)) / Y_TICKS),
    [niceMax],
  );

  if (loading && data.length === 0) {
    return (
      <div
        className='animate-pulse bg-ui-bg-subtle rounded-lg'
        style={{ height: PLOT_HEIGHT + 26 }}
      />
    );
  }

  if (data.length === 0) {
    return (
      <div
        className='flex items-center justify-center text-ui-text-3 text-sm'
        style={{ height: PLOT_HEIGHT + 26 }}
      >
        {t('暂无数据')}
      </div>
    );
  }

  const tooltipFor = (v) =>
    valueLabel === 'count' ? formatAxis(v, v) : renderQuota(v, 4);

  return (
    <div className='w-full select-none'>
      <div className='flex' style={{ height: PLOT_HEIGHT }}>
        {/* Y 轴刻度 */}
        <div
          className='flex flex-col justify-between text-[11px] text-ui-text-3 tabular-nums text-right'
          style={{ width: Y_AXIS_WIDTH, paddingRight: 10 }}
        >
          {tickValues.map((v, i) => (
            <div key={i} style={{ lineHeight: 1 }}>
              {formatAxis(v, niceMax)}
            </div>
          ))}
        </div>

        {/* 柱体区 */}
        <div
          className='relative flex-1 flex items-end gap-1.5'
          style={{
            borderLeft: '1px solid var(--ui-border)',
            borderBottom: '1px solid var(--ui-border)',
            paddingInline: 4,
          }}
        >
          {data.map((d, i) => {
            const pct = niceMax > 0 ? (d.value / niceMax) * 100 : 0;
            const isHover = hoverIdx === i;
            return (
              <div
                key={i}
                className='relative flex-1 h-full flex items-end justify-center cursor-pointer'
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <div
                  className='rounded-t-md transition-all duration-150'
                  style={{
                    width: '40%',
                    height: `${pct}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                    backgroundColor: 'var(--ui-text)',
                    opacity: isHover ? 1 : 0.85,
                  }}
                />
                {isHover && (
                  <div
                    className='absolute z-10 px-2 py-1 rounded-xl bg-ui-text text-ui-bg text-[11px] font-medium tabular-nums whitespace-nowrap shadow-md pointer-events-none'
                    style={{
                      bottom: `calc(${pct}% + 8px)`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className='text-[10px] opacity-70 mb-0.5'>{d.time}</div>
                    {tooltipFor(d.value)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X 轴标签 */}
      <div className='flex' style={{ marginTop: 8 }}>
        <div style={{ width: Y_AXIS_WIDTH }} />
        <div
          className='flex-1 flex gap-1.5 min-w-0'
          style={{ paddingInline: 4 }}
        >
          {data.map((d, i) => (
            <div
              key={i}
              className='flex-1 min-w-0 text-center text-[11px] text-ui-text-3 tabular-nums truncate'
            >
              {d.time}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function niceCeil(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const norm = v / base;
  let nice;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

function formatAxis(v, max) {
  if (v === 0) return '0';
  if (max >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (max >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (max >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  if (max >= 10) return v.toFixed(0);
  if (max >= 1) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2);
}

export default MonthlyBarChart;
