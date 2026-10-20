export type Summary = { avg_latency_ms: number; success_rate: number; avg_tps: number };
export type SuccessPoint = { ts: number; success_rate: number };
export type SeriesPoint = SuccessPoint & { avg_ttft_ms: number; avg_latency_ms: number; avg_tps: number };
export type ModelSummary = Summary & { model_name: string; recent_success_series?: SuccessPoint[] };
export type SummaryResult = {
  models: ModelSummary[];
  recent_success_series?: Record<string, SuccessPoint[]>;
  window_start: number;
  window_end: number;
};
export type ModelResult = {
  model_name: string;
  series_schema: string;
  summary: Summary | null;
  series: SeriesPoint[];
  groups: (Summary & { group: string; avg_ttft_ms: number; series: SeriesPoint[] })[];
  window_start: number;
  window_end: number;
};
import { z } from 'zod';


const value = z.number().finite().nonnegative();
const success = z.number().finite().min(0).max(100);
const summary = z.object({ avg_latency_ms: value, success_rate: success, avg_tps: value });
const successPoint = z.object({ ts: value, success_rate: success });
const seriesPoint = successPoint.extend({ avg_ttft_ms: value, avg_latency_ms: value, avg_tps: value });
const series = z.array(seriesPoint).nullable().transform((rows) => rows ?? []);
const recent = z.array(successPoint).nullish().transform((rows) => rows ?? []);
export const summaryResultSchema: z.ZodType<SummaryResult> = z.object({ window_start: value, window_end: value, models: z.array(summary.extend({ model_name: z.string(), recent_success_series: recent })).nullable().transform((rows) => rows ?? []), recent_success_series: z.record(z.string(), recent).optional() });
export const modelResultSchema: z.ZodType<ModelResult> = z.object({ model_name: z.string(), series_schema: z.string(), summary: summary.nullable(), series, window_start: value, window_end: value, groups: z.array(summary.extend({ group: z.string(), avg_ttft_ms: value, series })).nullable().transform((rows) => rows ?? []) });
