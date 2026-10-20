import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, Table } from '../../components/ui';
import { historyMatrix } from './rankings-data';
import type { HistoryPoint } from './rankings-data';

const colors = ['#354d40', '#6d8577', '#9eaea1', '#b8bba5', '#8e7868', '#b7a592', '#78858c', '#a6adb4', '#5d6268', '#c6c7bd', '#d7d4c5'];
export default function RankingHistory({ title, points, order, share = false }: { title: string; points: HistoryPoint[]; order: string[]; share?: boolean }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState('');
  const container = useRef<HTMLElement>(null);
  const [chartWidth, setChartWidth] = useState(960);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const resize = () => setChartWidth(Math.max(260, Math.round(element.getBoundingClientRect().width)));
    resize(); const observer = new ResizeObserver(resize); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { entities, buckets } = useMemo(() => historyMatrix(points, order), [points, order]);
  const selectedBucket = buckets.find((bucket) => bucket.ts === selected) ?? buckets.at(-1);
  const number = (value: number) => new Intl.NumberFormat(i18n.language, share ? { style: 'percent', maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(value);
  const label = (timestamp: string, fallback: string) => {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) : fallback;
  };
  const max = share ? 1 : Math.max(1, ...buckets.map((bucket) => bucket.total));
  const plotWidth = chartWidth - 60;
  const bucketX = (index: number) => buckets.length === 1 ? 45 + plotWidth / 2 : 45 + index * plotWidth / (buckets.length - 1);
  const axisLabel = (timestamp: string, fallback: string) => {
    const date = new Date(timestamp);
    const sameDay = buckets.length > 1 && buckets[0].ts.slice(0, 10) === buckets.at(-1)?.ts.slice(0, 10);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(i18n.language, sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(date) : fallback;
  };
  const area = (name: string, index: number) => {
    const upper = buckets.map((bucket, x) => `${bucketX(x)},${180 - entities.slice(0, index + 1).reduce((sum, entity) => sum + (bucket.values[entity] ?? 0), 0) / max * 155}`);
    const lower = [...buckets].reverse().map((bucket, reversed) => `${bucketX(buckets.length - reversed - 1)},${180 - entities.slice(0, index).reduce((sum, entity) => sum + (bucket.values[entity] ?? 0), 0) / max * 155}`);
    if (buckets.length === 1) {
      const before = entities.slice(0, index).reduce((sum, entity) => sum + (buckets[0].values[entity] ?? 0), 0);
      const value = buckets[0].values[name] ?? 0;
      return <rect key={name} x='45' y={180 - (before + value) * 155} width={plotWidth} height={value * 155} fill={colors[index % colors.length]}><title>{name}</title></rect>;
    }
    return <polygon key={name} points={[...upper, ...lower].join(' ')} fill={colors[index % colors.length]}><title>{name}</title></polygon>;
  };
  return <section ref={container} className='space-y-4' aria-label={title}>
    <div className='flex flex-wrap items-center justify-between gap-3'><h3 className='text-sm font-medium'>{title}</h3>{selectedBucket && <Select aria-label={t('History interval')} value={selectedBucket.ts} onChange={(value) => setSelected(String(value))} width='auto' options={buckets.map((bucket) => ({ value: bucket.ts, label: label(bucket.ts, bucket.label) }))} />}</div>
    {!buckets.length ? <p className='py-8 text-center text-sm text-ui-text-3'>{t('No traffic data for this period')}</p> : <>
      <div><svg viewBox={`0 0 ${chartWidth} 215`} className='w-full h-auto' role='group' aria-label={title}>
        {[0, 0.5, 1].map((ratio) => <g key={ratio}><line x1='45' x2={chartWidth - 15} y1={180 - ratio * 155} y2={180 - ratio * 155} stroke='currentColor' opacity='.12' strokeDasharray='3 3' /><text x='40' y={184 - ratio * 155} textAnchor='end' fill='currentColor' fontSize='11'>{share ? number(ratio) : new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 }).format(max * ratio)}</text></g>)}
        {share ? <>{entities.map(area)}{buckets.map((bucket, index) => {
          const start = index === 0 ? 45 : (bucketX(index - 1) + bucketX(index)) / 2;
          const end = index === buckets.length - 1 ? chartWidth - 15 : (bucketX(index) + bucketX(index + 1)) / 2;
          return <rect key={bucket.ts} x={start} y='22' width={end - start} height='160' fill='transparent' tabIndex={0} role='button' aria-label={label(bucket.ts, bucket.label)} onFocus={() => setSelected(bucket.ts)} onClick={() => setSelected(bucket.ts)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(bucket.ts); } }} />;
        })}</> : buckets.map((bucket, index) => {
          let offset = 0; const width = plotWidth / Math.max(1, buckets.length); const x = 45 + index * width;
          return <g key={bucket.ts} tabIndex={0} role='button' aria-label={`${label(bucket.ts, bucket.label)}: ${number(bucket.total)}`} onFocus={() => setSelected(bucket.ts)} onClick={() => setSelected(bucket.ts)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(bucket.ts); } }}>
            <rect x={x} y='22' width={width} height='160' fill='transparent' />
            {entities.map((name, entityIndex) => { const value = bucket.values[name] ?? 0; const height = value / max * 155; offset += height; return <rect key={name} x={x + 1} y={180 - offset} width={Math.max(1, width - 2)} height={height} fill={colors[entityIndex % colors.length]}><title>{`${name}: ${number(value)}`}</title></rect>; })}
          </g>;
        })}
        {buckets.filter((_, index) => index % Math.ceil(buckets.length / (chartWidth < 600 ? 3 : 6)) === 0).map((bucket) => <text key={bucket.ts} x={share ? bucketX(buckets.indexOf(bucket)) : 45 + (buckets.indexOf(bucket) + 0.5) * plotWidth / buckets.length} y='202' textAnchor={share && buckets.indexOf(bucket) === 0 ? 'start' : share && buckets.indexOf(bucket) === buckets.length - 1 ? 'end' : 'middle'} fill='currentColor' fontSize='11'>{axisLabel(bucket.ts, bucket.label)}</text>)}
      </svg></div>
      <div className='flex flex-wrap gap-x-4 gap-y-2 text-xs text-ui-text-2'>{entities.map((name, index) => <span key={name} className='inline-flex items-center gap-2'><i className='h-2 w-2 rounded-full' style={{ background: colors[index % colors.length] }} />{name === 'Others' ? t('Others') : name}</span>)}</div>
      {selectedBucket && <div className='space-y-2' aria-live='polite'><p className='text-xs text-ui-text-3'>{label(selectedBucket.ts, selectedBucket.label)}</p><Table size='sm' rows={entities.map((name) => ({ name, value: selectedBucket.values[name] ?? 0 }))} rowKey='name' columns={[{ key: 'name', title: t(share ? 'Vendor' : 'Model'), render: (row) => row.name === 'Others' ? t('Others') : row.name }, { key: 'value', title: t(share ? 'Token share' : 'Tokens'), align: 'right', render: (row) => number(row.value) }]} /></div>}
    </>}
  </section>;
}
