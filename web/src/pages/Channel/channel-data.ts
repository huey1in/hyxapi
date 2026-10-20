import { z } from 'zod';
import { buildChannelPatch } from './channel-patch';

const integer = z.number().int().safe();
const count = integer.nonnegative();
const text = z
  .string()
  .nullish()
  .transform((value) => value ?? '');
export const channelSettingSchema = z.looseObject({
  task_plugin_key: z.string().optional(),
  task_extend_plugin_keys: z.array(z.string()).nullable().optional(),
  force_format: z.boolean().optional(),
  thinking_to_content: z.boolean().optional(),
  pass_through_body_enabled: z.boolean().optional(),
  responses_websocket_enabled: z.boolean().optional(),
  system_prompt: z.string().optional(),
  system_prompt_override: z.boolean().optional(),
  proxy: z.string().optional(),
  http_protocol: z.string().optional(),
  http2_connection_shards: count.optional(),
  tls_insecure_skip_verify: z.boolean().optional(),
});
export const channelOtherSchema = z.looseObject({
  aws_api_type: z.string().optional(),
  aws_key_type: z.string().optional(),
  vertex_key_type: z.string().optional(),
  vertex_project_id: z.string().optional(),
  azure_responses_version: z.string().optional(),
  tool_loss_policy: z.string().optional(),
  openrouter_enterprise: z.boolean().nullish(),
  upstream_model_update_check_enabled: z.boolean().optional(),
  upstream_model_update_auto_sync_enabled: z.boolean().optional(),
  upstream_model_update_ignored_models: z
    .array(z.string())
    .nullable()
    .optional(),
  advanced_custom: z.record(z.string(), z.unknown()).nullable().optional(),
  ollama_openai_chat: z.boolean().optional(),
  allow_service_tier: z.boolean().optional(),
  disable_store: z.boolean().optional(),
  allow_safety_identifier: z.boolean().optional(),
  allow_include_obfuscation: z.boolean().optional(),
  claude_beta_query: z.boolean().optional(),
  allow_inference_geo: z.boolean().optional(),
  allow_speed: z.boolean().optional(),
});
export const channelSchema = z.looseObject({
  id: count.positive(),
  type: count.positive(),
  name: z.string(),
  key: z.string(),
  status: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  priority: integer.nullable(),
  weight: count.nullable(),
  models: z.string(),
  group: z.string(),
  balance: z.number(),
  used_quota: count,
  base_url: text,
  other: text,
  openai_organization: text,
  test_model: text,
  tag: text,
  remark: text,
  model_mapping: text,
  status_code_mapping: text,
  param_override: text,
  header_override: text,
  setting: text,
  settings: text,
  auto_ban: z.union([z.literal(0), z.literal(1)]).nullable(),
  channel_info: z.looseObject({
    is_multi_key: z.boolean(),
    multi_key_mode: z.enum(['', 'random', 'polling']),
    multi_key_size: count,
  }),
});
export const channelPageSchema = z.object({
  items: z
    .array(channelSchema)
    .nullable()
    .transform((rows) => rows ?? []),
  total: count,
});
export const priorityOrderSchema = z.object({
  revision: z.string().min(1),
  items: z.array(
    z.object({ id: count.positive(), priority: integer.nullable() }),
  ),
  changes: z.array(
    z.object({
      id: count.positive(),
      previous: integer.nullable(),
      priority: integer.nullable(),
    }),
  ),
});
export const pluginOptionsSchema = z
  .array(
    z.looseObject({
      key: z.string().min(1),
      name: z.string(),
      baseUrl: z.string().optional(),
      models: z.array(z.string()).nullable().optional(),
      upstreams: z.array(z.string()).nullable().optional(),
    }),
  )
  .nullable()
  .transform((rows) => rows ?? []);
export type Channel = z.infer<typeof channelSchema>;
export type ChannelSetting = z.infer<typeof channelSettingSchema>;
export type ChannelOther = z.infer<typeof channelOtherSchema>;
type KnownChannel = z.infer<z.ZodObject<typeof channelSchema.shape>>;
export type ChannelDraft = Partial<
  Omit<KnownChannel, 'setting' | 'settings' | 'priority' | 'weight'>
> & {
  name: string;
  type: number;
  key: string;
  setting: ChannelSetting;
  other_settings: ChannelOther;
  priority: number | '';
  weight: number | '';
  multi_key_mode: 'random' | 'polling';
  key_mode?: string;
};
export type EditingChannel = Partial<Channel> & {
  name: string;
  type: number;
  fetchModelsOnOpen?: boolean;
};

export function parseChannelObject(
  value: string | undefined,
): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value?.trim() || '{}'); }
  catch { throw new Error('Channel configuration must be a JSON object'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
    throw new Error('Channel configuration must be a JSON object');
  return parsed as Record<string, unknown>;
}
export function createChannelDraft(channel: EditingChannel): ChannelDraft {
  return {
    ...channel,
    key: '',
    setting: channelSettingSchema.parse(parseChannelObject(channel.setting)),
    other_settings: channelOtherSchema.parse(
      parseChannelObject(channel.settings),
    ),
    priority: channel.priority ?? 0,
    weight: channel.weight ?? 0,
    multi_key_mode: channel.channel_info?.multi_key_mode || 'random',
  };
}
export function serializeChannelDraft(
  form: ChannelDraft,
  original: EditingChannel,
  advancedRoutes: string,
): Record<string, unknown> {
  if (!form.name.trim()) throw new Error('Enter a channel name');
  if (
    form.priority === '' ||
    !Number.isSafeInteger(form.priority) ||
    form.weight === '' ||
    !Number.isSafeInteger(form.weight) ||
    form.weight < 0
  )
    throw new Error(
      'Enter an integer priority and a nonnegative integer weight',
    );
  for (const field of [
    'param_override',
    'header_override',
    'status_code_mapping',
  ] as const)
    parseChannelObject(form[field]);
  const other = { ...form.other_settings };
  if (form.type === 58) {
    if (advancedRoutes.trim())
      other.advanced_custom = parseChannelObject(advancedRoutes);
    else delete other.advanced_custom;
  }
  const payload = buildChannelPatch(
    {
      ...form,
      name: form.name.trim(),
      setting: JSON.stringify(form.setting),
      settings: JSON.stringify(other),
    },
    original,
  );
  if (!original.id && form.status) payload.status = form.status;
  return payload;
}

export type OverridePair = {
  k: string;
  v: string;
  original: unknown;
  changed: boolean;
};
export function readOverridePairs(value: string): OverridePair[] {
  return Object.entries(parseChannelObject(value)).map(([k, original]) => ({
    k,
    v: typeof original === 'string' ? original : JSON.stringify(original),
    original,
    changed: false,
  }));
}
export function writeOverridePairs(
  pairs: OverridePair[],
  jsonValues: boolean,
): string {
  const entries = pairs
    .filter((pair) => pair.k.trim())
    .map(({ k, v, original, changed }) => {
      let value: unknown = changed ? v : original;
      if (changed && jsonValues) {
        try {
          value = JSON.parse(v);
        } catch {
          value = v;
        }
      }
      return [k.trim(), value];
    });
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : '';
}
