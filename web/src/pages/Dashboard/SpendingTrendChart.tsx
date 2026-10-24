import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrencyConfig, renderQuota } from '../../helpers';
import ContentSkeleton from '../../components/ui/feedback/ContentSkeleton';
import Skeleton from '../../components/ui/feedback/Skeleton';
import type { DashboardUsage } from './dashboard-data';

export default function SpendingTrendChart({ usage, loading = false }: { usage?: DashboardUsage; loading?: boolean }) {
  const { t, i18n } = useTranslation();
  const titleId = useId(); const hintId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [{ width, height }, setSize] = useState({ width: 600, height: 240 });
  const [active, setActive] = useState<number | null>(null);
  const points = usage?.trend.points ?? [];
  const showPlot = Boolean(usage);
  useLayoutEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    setSize({ width: Math.max(1, node.clientWidth), height: Math.max(1, node.clientHeight) });
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, showPlot]);
  useEffect(() => setActive(null), [points[0]?.timestamp, points.length]);
  const interval = usage?.trend.interval ?? 'day';
  const scale = height / 240;
  // Scale the axis in the same configured currency as the summary cards.
  const currency = getCurrencyConfig();
  const perUnit = Number(localStorage.getItem('quota_per_unit')) || 500000;
  const divisor = currency.type === 'TOKENS' ? 1 : perUnit / currency.rate;
  const values = points.map((point) => point.quota / divisor);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(minimum), maximum) || 1))) / 2;
  const lower = Math.floor(minimum * 1.12 / magnitude) * magnitude;
  const upper = Math.ceil(maximum * 1.12 / magnitude) * magnitude || 1;
  const axisPrecision = Math.max(2, Math.min(6, 1 - Math.floor(Math.log10(upper - lower))));
  const money = (amount: number) => `${currency.type === 'TOKENS' ? '' : currency.symbol}${new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: axisPrecision }).format(amount)}`;
  const ticks = [lower, (lower + upper) / 2, upper];
  const axisWidth = Math.max(44, Math.min(80, Math.max(...ticks.map((value) => money(value).length)) * 6 + 12)) * scale;
  const left = 8 * scale;
  const right = Math.max(left + 1, width - axisWidth); const top = 16 * scale; const bottom = height - 36 * scale;
  const slotWidth = (right - left) / Math.max(1, points.length);
  const barWidth = Math.min(32 * scale, slotWidth * 0.68);
  const x = (index: number) => left + (index + 0.5) * slotWidth;
  const y = (amount: number) => bottom - (amount - lower) / (upper - lower) * (bottom - top);
  const baseline = y(0);
  const labelCount = Math.min(points.length, width < 420 ? 3 : 5);
  const labels = Array.from({ length: labelCount }, (_, index) => labelCount === 1 ? 0 : Math.round(index * (points.length - 1) / (labelCount - 1)));
  const date = (timestamp: number, full = false) => new Intl.DateTimeFormat(i18n.language, full
    ? { year: 'numeric', month: 'short', day: 'numeric', ...(interval === 'hour' ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}) }
    : interval === 'hour' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : interval === 'year' ? { year: 'numeric' } : interval === 'month' ? { year: 'numeric', month: 'short' } : { month: 'numeric', day: 'numeric' }
  ).format(timestamp * 1000);
  const selected = active === null ? undefined : points[active];

  return <section className='dashboard-spending-trend' aria-labelledby={titleId} data-spending-trend>
    <div className='dashboard-trend-heading'>
      <h2 id={titleId}>{t('Spending trend')}</h2>
    </div>
    {loading ? <ContentSkeleton variant='dashboard'><div className='dashboard-trend-placeholder'><div className='dashboard-trend-placeholder-grid'>{[0, 1, 2].map((index) => <div key={index}><span /><Skeleton width='calc(32 * var(--dashboard-unit, 1px))' height='calc(10 * var(--dashboard-unit, 1px))' /></div>)}</div><div className='dashboard-trend-placeholder-dates'>{[0, 1, 2].map((index) => <Skeleton key={index} width='calc(36 * var(--dashboard-unit, 1px))' height='calc(10 * var(--dashboard-unit, 1px))' />)}</div></div></ContentSkeleton>
      : !usage ? <div className='dashboard-trend-message'>{t('Unable to load overview')}</div>
        : <div ref={plotRef} className='dashboard-trend-plot' data-empty={usage.requests === 0 || undefined} role='group' aria-label={t('Spending trend')} aria-describedby={hintId} tabIndex={0}
          onPointerMove={(event) => {
            if (!points.length) return;
            const position = event.clientX - event.currentTarget.getBoundingClientRect().left;
            setActive(Math.max(0, Math.min(points.length - 1, Math.floor((position - left) / slotWidth))));
          }}
          onPointerLeave={() => { if (document.activeElement !== plotRef.current) setActive(null); }}
          onFocus={() => { if (points.length) setActive(points.length - 1); }} onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (!points.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Escape') setActive(null);
            else setActive((current) => event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
          }}>
          <p id={hintId} className='sr-only'>{t('Use arrow keys to inspect spending by date')}</p>
          <svg width='100%' height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden='true'>
            {ticks.map((value, index) => <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className='dashboard-trend-grid' /><text x={width - 2 * scale} y={y(value)} textAnchor='end' dominantBaseline='middle' className='dashboard-trend-axis'>{money(value)}</text></g>)}
            {labels.map((index, position) => <text key={index} x={x(index)} y={height - 10 * scale} textAnchor={position === 0 && points.length > 1 ? 'start' : position === labels.length - 1 && points.length > 1 ? 'end' : 'middle'} className='dashboard-trend-axis'>{date(points[index].timestamp)}</text>)}
            <line x1={left} x2={right} y1={baseline} y2={baseline} className='dashboard-trend-baseline' />
            <g key={`${interval}:${points[0]?.timestamp}:${points.length}`} className='dashboard-trend-bars' style={{ transformOrigin: `0px ${baseline}px` }}>
              {values.map((value, index) => {
                const barHeight = Math.abs(y(value) - baseline);
                return <rect key={points[index].timestamp} x={x(index) - barWidth / 2} y={Math.min(y(value), baseline)} width={barWidth} height={barHeight} rx={Math.min(3 * scale, barWidth / 2, barHeight / 2)} className='dashboard-trend-bar' data-active={active === index || undefined} />;
              })}
            </g>
          </svg>
          {usage.requests === 0 && <div className='dashboard-trend-empty'>{t('No data')}</div>}
          {selected && <div className='dashboard-trend-tooltip' role='status' style={{ left: Math.max(0, Math.min(width - 168 * scale, x(active!) < width / 2 ? x(active!) + 14 * scale : x(active!) - 182 * scale)), top: y(values[active!]) < 80 * scale ? y(values[active!]) + 16 * scale : y(values[active!]) - 72 * scale }}><span>{date(selected.timestamp, true)}</span><strong>{renderQuota(selected.quota)}</strong></div>}
          <div className='sr-only'><table><caption>{t('Spending trend')}</caption><thead><tr><th>{t('Date')}</th><th>{t('Spending amount')}</th></tr></thead><tbody>{points.map((point) => <tr key={point.timestamp}><td>{date(point.timestamp, true)}</td><td>{renderQuota(point.quota)}</td></tr>)}</tbody></table></div>
        </div>}
  </section>;
}
