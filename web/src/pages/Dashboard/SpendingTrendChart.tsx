import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrencyConfig, renderQuota } from '../../helpers';
import ContentSkeleton from '../../components/ui/feedback/ContentSkeleton';
import Skeleton from '../../components/ui/feedback/Skeleton';
import type { DashboardUsage } from './dashboard-data';

const HEIGHT = 240;

export default function SpendingTrendChart({ usage, loading = false }: { usage?: DashboardUsage; loading?: boolean }) {
  const { t, i18n } = useTranslation();
  const titleId = useId(); const hintId = useId(); const fillId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  const points = usage?.trend.points ?? [];
  const showPlot = Boolean(usage);
  useLayoutEffect(() => {
    const node = plotRef.current;
    if (!node) return;
    setWidth(Math.max(1, node.clientWidth));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, showPlot]);
  useEffect(() => setActive(null), [points[0]?.timestamp, points.length]);
  const interval = usage?.trend.interval ?? 'day';
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
  const axisWidth = Math.max(44, Math.min(80, Math.max(...ticks.map((value) => money(value).length)) * 6 + 12));
  const left = 8;
  const right = Math.max(left + 1, width - axisWidth); const top = 16; const bottom = HEIGHT - 36;
  const x = (index: number) => points.length > 1 ? left + index * (right - left) / (points.length - 1) : (left + right) / 2;
  const y = (amount: number) => bottom - (amount - lower) / (upper - lower) * (bottom - top);
  // Horizontal control handles soften each segment while keeping the curve
  // between its observed endpoints, without introducing peaks or negative spend.
  const path = values.map((value, index) => {
    if (!index) return `M ${x(index)} ${y(value)}`;
    const handle = (x(index) - x(index - 1)) * 0.36;
    return `C ${x(index - 1) + handle} ${y(values[index - 1])}, ${x(index) - handle} ${y(value)}, ${x(index)} ${y(value)}`;
  }).join(' ');
  const area = points.length > 1 ? `${path} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z` : '';
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
    {loading ? <ContentSkeleton variant='dashboard'><div className='dashboard-trend-placeholder'><div className='dashboard-trend-placeholder-grid'>{[0, 1, 2].map((index) => <div key={index}><span /><Skeleton width={32} height={10} /></div>)}</div><div className='dashboard-trend-placeholder-dates'>{[0, 1, 2].map((index) => <Skeleton key={index} width={36} height={10} />)}</div></div></ContentSkeleton>
      : !usage ? <div className='dashboard-trend-message'>{t('Unable to load overview')}</div>
        : <div ref={plotRef} className='dashboard-trend-plot' data-empty={usage.requests === 0 || undefined} role='group' aria-label={t('Spending trend')} aria-describedby={hintId} tabIndex={0}
          onPointerMove={(event) => {
            const position = event.clientX - event.currentTarget.getBoundingClientRect().left;
            setActive(Math.max(0, Math.min(points.length - 1, Math.round((position - left) / (right - left) * (points.length - 1)))));
          }}
          onPointerLeave={() => { if (document.activeElement !== plotRef.current) setActive(null); }}
          onFocus={() => setActive(points.length - 1)} onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Escape') setActive(null);
            else setActive((current) => event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))));
          }}>
          <p id={hintId} className='sr-only'>{t('Use arrow keys to inspect spending by date')}</p>
          <svg width='100%' height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden='true'>
            <defs><linearGradient id={fillId} x1='0' y1='0' x2='0' y2='1'><stop offset='0%' className='dashboard-trend-fill-start' /><stop offset='100%' className='dashboard-trend-fill-end' /></linearGradient></defs>
            {ticks.map((value, index) => <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className='dashboard-trend-grid' /><text x={width - 2} y={y(value)} textAnchor='end' dominantBaseline='middle' className='dashboard-trend-axis'>{money(value)}</text></g>)}
            {labels.map((index, position) => <text key={index} x={x(index)} y={HEIGHT - 10} textAnchor={position === 0 && points.length > 1 ? 'start' : position === labels.length - 1 && points.length > 1 ? 'end' : 'middle'} className='dashboard-trend-axis'>{date(points[index].timestamp)}</text>)}
            {area && <path d={area} fill={`url(#${fillId})`} className='dashboard-trend-area' />}
            <path d={path} fill='none' className='dashboard-trend-line' strokeWidth={1.75} strokeLinecap='round' strokeLinejoin='round' />
            {points.length === 1 && <circle cx={x(0)} cy={y(values[0])} r={3} className='dashboard-trend-dot' />}
            {selected && <><line x1={x(active!)} x2={x(active!)} y1={top} y2={bottom} className='dashboard-trend-crosshair' /><circle cx={x(active!)} cy={y(values[active!])} r={8} className='dashboard-trend-halo' /><circle cx={x(active!)} cy={y(values[active!])} r={4} className='dashboard-trend-dot' /></>}
          </svg>
          {usage.requests === 0 && <div className='dashboard-trend-empty'>{t('No data')}</div>}
          {selected && <div className='dashboard-trend-tooltip' role='status' style={{ left: Math.max(0, Math.min(width - 168, x(active!) < width / 2 ? x(active!) + 14 : x(active!) - 182)), top: y(values[active!]) < 80 ? y(values[active!]) + 16 : y(values[active!]) - 72 }}><span>{date(selected.timestamp, true)}</span><strong>{renderQuota(selected.quota)}</strong></div>}
          <div className='sr-only'><table><caption>{t('Spending trend')}</caption><thead><tr><th>{t('Date')}</th><th>{t('Spending amount')}</th></tr></thead><tbody>{points.map((point) => <tr key={point.timestamp}><td>{date(point.timestamp, true)}</td><td>{renderQuota(point.quota)}</td></tr>)}</tbody></table></div>
        </div>}
  </section>;
}
