import type { SeriesPoint, SuccessPoint } from './types';

export const formatLatency = (value?: number | null, language = 'en-US'): string => typeof value !== 'number' || !Number.isFinite(value) || value <= 0
  ? '—' : value < 1000 ? `${new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(value)} ms` : `${new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 1000)} s`;
export const formatThroughput = (value?: number | null, language = 'en-US'): string => typeof value !== 'number' || !Number.isFinite(value) || value <= 0
  ? '—' : `${new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} token/s`;
export const formatSuccessRate = (value?: number | null, language = 'en-US'): string => typeof value !== 'number' || !Number.isFinite(value)
  ? '—' : new Intl.NumberFormat(language, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.min(100, Math.max(0, value)) / 100);
export const successTone = (value: number): 'success' | 'warning' | 'danger' => value >= 99 ? 'success' : value >= 95 ? 'warning' : 'danger';

// Empty hours and missing TTFT are not zero-latency samples or outages.
export function trendSamples<T extends SuccessPoint>(points: T[], metric: keyof T): T[] {
  return points.filter((point) => Number.isFinite(point.ts) && Number.isFinite(point[metric]) &&
    (metric === 'success_rate' || Number(point[metric]) > 0)).sort((left, right) => left.ts - right.ts);
}

export const ttftSamples = (points: SeriesPoint[]) => trendSamples(points, 'avg_ttft_ms');
