/*
 * SVG-based bar chart with guaranteed L-axis alignment.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderQuota } from '../../../helpers';

const HEIGHT = 220;
const PAD_TOP = 12;
const PAD_RIGHT = 8;
const PAD_BOTTOM = 28;
const PAD_LEFT = 52;
const Y_TICKS = 5;

const MonthlyBarChart = ({ data = [], loading, t, valueLabel = 'quota' }) => {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 600;
      setWidth(Math.max(300, w));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const max = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);
  const niceMax = useMemo(() => niceCeil(max), [max]);

  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baselineY = HEIGHT - PAD_BOTTOM;
  const barCount = data.length;
  const slotW = barCount > 0 ? innerW / barCount : 0;
  const barW = Math.max(slotW * 0.6, 2);

  const yTicks = useMemo(
    () =>
      Array.from({ length: Y_TICKS + 1 }, (_, i) => ({
        value: (niceMax * (Y_TICKS - i)) / Y_TICKS,
        y: PAD_TOP + (innerH * i) / Y_TICKS,
      })),
    [niceMax, innerH],
  );

  const tooltipFor = (v) =>
    valueLabel === 'count' ? formatAxis(v, v) : renderQuota(v, 4);

  if (loading && data.length === 0) {
    return <div ref={ref} className='h-[220px] animate-pulse bg-ui-bg-subtle rounded-lg' />;
  }

  if (data.length === 0) {
    return (
      <div ref={ref} className='h-[220px] flex items-center justify-center text-ui-text-3 text-sm'>
        {t('暂无数据')}
      </div>
    );
  }

  return (
    <div ref={ref} className='relative w-full' style={{ height: HEIGHT }}>
      <svg width={width} height={HEIGHT} className='block'>
        {/* Y 轴刻度 */}
        {yTicks.map(({ value, y }, i) => (
          <text
            key={i}
            x={PAD_LEFT - 8}
            y={y}
            textAnchor='end'
            dominantBaseline='middle'
            style={{ fill: 'var(--ui-text-3)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatAxis(value, niceMax)}
          </text>
        ))}

        {/* Y 轴线 */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={baselineY}
          stroke='var(--ui-border)'
          strokeWidth='1'
        />

        {/* X 轴线 */}
        <line
          x1={PAD_LEFT}
          y1={baselineY}
          x2={width - PAD_RIGHT}
          y2={baselineY}
          stroke='var(--ui-border)'
          strokeWidth='1'
        />

        {/* 柱体 */}
        {data.map((d, i) => {
          const h = niceMax > 0 ? (d.value / niceMax) * innerH : 0;
          const slotX = PAD_LEFT + i * slotW;
          const cx = slotX + slotW / 2;
          const x = cx - barW / 2;
          const y = baselineY - h;
          const isHover = hoverIdx === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={slotX}
                y={PAD_TOP}
                width={slotW}
                height={innerH}
                fill='transparent'
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.value > 0 ? 2 : 0)}
                rx='3'
                ry='3'
                style={{
                  fill: 'var(--ui-text)',
                  opacity: isHover ? 1 : 0.85,
                  transition: 'opacity 0.15s',
                }}
              />
            </g>
          );
        })}

        {/* X 轴标签 */}
        {data.map((d, i) => {
          const cx = PAD_LEFT + i * slotW + slotW / 2;
          const skip = barCount > 12 && barCount > 0 && i % Math.ceil(barCount / 12) !== 0;
          if (skip) return null;
          return (
            <text
              key={i}
              x={cx}
              y={baselineY + 16}
              textAnchor='middle'
              style={{ fill: 'var(--ui-text-3)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            >
              {d.time}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx != null && (
        <div
          className='absolute pointer-events-none px-2 py-1 rounded-md bg-ui-text text-ui-bg text-[11px] font-medium tabular-nums whitespace-nowrap shadow-md'
          style={{
            left: PAD_LEFT + hoverIdx * slotW + slotW / 2,
            top: PAD_TOP - 4,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className='text-[10px] opacity-70 mb-0.5'>{data[hoverIdx].time}</div>
          {tooltipFor(data[hoverIdx].value)}
        </div>
      )}
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
