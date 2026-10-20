import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const text = z.string();
export const pluginMetaSchema = z.looseObject({ key: text.min(1), name: text, version: text.min(1), apiVersion: count.positive() });
export const pluginListSchema = z.array(z.object({ meta: pluginMetaSchema, source: z.enum(['factory', 'override', 'override_over_factory']), enabled: z.boolean(), active: z.boolean(), source_hash: text, has_icon: z.boolean(), remark: text, runtime_status: z.enum(['registered', 'disabled', 'disabled_fallback', 'compile_failed', 'not_registered']), runtime_error: text.optional(), channel_count: count, in_flight_count: count })).nullable().transform((rows) => rows ?? []);
export const pluginVersionSchema = z.object({ id: count.positive(), key: text.min(1), version: text.min(1), api_version: count.positive(), source: text, source_hash: text, enabled: z.boolean(), active: z.boolean(), created_at: count, remark: text });
export const pluginVersionsSchema = z.array(pluginVersionSchema).nullable().transform((rows) => rows ?? []);
export const pluginDetailSchema = z.object({ meta: pluginMetaSchema, source: text.min(1), layer: z.enum(['factory', 'override']), has_icon: z.boolean(), plugin: pluginVersionSchema.optional() });
export const pluginRuntimeSchema = z.object({ current_generation: count, generation_published_at: text, database_revision: text, database_error: text.optional(), last_rebuild: z.object({ status: text.min(1), attempted_at: text, generation: count, plugin_error_count: count, error: text.optional() }), plugin_errors: z.record(text, text).nullable().transform((errors) => errors ?? {}) });
export const pluginSourcesSchema = z.array(z.object({ name: text.min(1), index_url: text.min(1) })).nullable().transform((rows) => rows ?? []);
export const pluginUsageSchema = z.object({ channels: z.array(z.object({ id: count.positive(), name: text, type: count })).nullable().transform((rows) => rows ?? []), in_flight_count: count });
export type PluginListItem = z.infer<typeof pluginListSchema>[number];
export type PluginVersion = z.infer<typeof pluginVersionSchema>;
export type PluginMeta = z.infer<typeof pluginMetaSchema>;
export type PluginSource = z.infer<typeof pluginSourcesSchema>[number];
export type PluginUsage = z.infer<typeof pluginUsageSchema>;
export type PluginDraft = { key?: string; source: string; enabled: boolean; remark: string; icon: string; sourceSha256?: string; marketName?: string; meta?: PluginMeta };
export type PluginAction = { kind: 'status'; key: string; enabled: boolean } | { kind: 'delete'; key: string; version: string };
export class PluginUsageError extends Error {
  readonly usage: PluginUsage;
  constructor(usage: PluginUsage) { super('Plugin is still in use'); this.usage = usage; }
}
export const pluginBase = '/api/plugin/task';
export const pluginPath = (key: string) => `${pluginBase}/${encodeURIComponent(key)}`;
export function validPluginSources(sources: PluginSource[]): boolean {
  return sources.every((source) => {
    if (!source.name.trim()) return false;
    try { const url = new URL(source.index_url.trim()); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  });
}
