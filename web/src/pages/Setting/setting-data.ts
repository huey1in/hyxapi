import { z } from 'zod';
import {
  NUMBER_KEYS,
  BOOL_KEYS,
  JSON_ARRAY_TAG_KEYS,
  SELECT_OPTIONS,
} from './setting-fields';
import { invalidPaymentSettings } from '../../features/payments/payment-setup-data';
import { invalidConsoleContentChanges } from '../../features/dashboard-content/content';
import { invalidGroupPricingChanges } from './group-pricing-rules';

export type Settings = Record<string, string>;
const count = z.number().int().nonnegative().safe();
const name = z.string().refine((value) => value.trim().length > 0);
export const stringMap = z.record(name, z.string());
export const numericMap = z.record(name, z.number().finite().nonnegative());
export const jsonObject = z.record(z.string(), z.unknown());
export const affinityRuleSchema = z.looseObject({
  name: z.string().optional(),
  model_regex: z.array(z.string()).nullish(),
  path_regex: z.array(z.string()).nullish(),
  user_agent_include: z.array(z.string()).nullish(),
  key_sources: z.array(
    z.looseObject({
      type: z.enum([
        'context_int',
        'context_string',
        'request_header',
        'gjson',
      ]),
      key: z.string().optional(),
      path: z.string().optional(),
    }),
  ),
  ttl_seconds: count,
  value_regex: z.string().optional(),
  session_mode: z.enum(['', 'inherit', 'off', 'prefer', 'strict']).optional(),
  param_override_template: jsonObject.nullish(),
  skip_retry_on_failure: z.boolean().optional(),
  include_using_group: z.boolean().optional(),
  include_model_name: z.boolean().optional(),
  include_rule_name: z.boolean().optional(),
});
export type AffinityRule = z.output<typeof affinityRuleSchema>;
export const settingJSON: Record<string, z.ZodType> = {
  GroupRatio: numericMap,
  UserUsableGroups: stringMap,
  'claude.default_max_tokens': z.record(name, count),
  'claude.model_headers_settings': z.record(
    name,
    z.record(name, z.array(z.string())),
  ),
  'gemini.safety_settings': z.record(
    name,
    z.enum([
      '',
      'OFF',
      'BLOCK_NONE',
      'BLOCK_ONLY_HIGH',
      'BLOCK_MEDIUM_AND_ABOVE',
      'BLOCK_LOW_AND_ABOVE',
      'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
    ]),
  ),
  'gemini.version_settings': stringMap,
  'global.chat_completions_to_responses_policy': z.looseObject({
    enabled: z.boolean().optional(),
    all_channels: z.boolean().optional(),
  }),
  'channel_affinity_setting.rules': z.array(affinityRuleSchema),
  'console_setting.announcements': z.array(
    z.looseObject({
      content: name,
      type: z.string(),
      extra: z.string().optional(),
      publishDate: z.string().optional(),
    }),
  ),
  PayMethods: z.array(
    z.looseObject({
      name,
      type: name,
      color: z.string().optional(),
      min_topup: z
        .union([z.string(), z.number()])
        .optional()
        .refine(
          (value) =>
            value === undefined ||
            value === '' ||
            (Number.isFinite(Number(value)) && Number(value) >= 0),
        ),
    }),
  ),
  HeaderNavModules: jsonObject,
};
export function parseJSON<T extends z.ZodType>(
  raw: string,
  schema: T,
): z.output<T> | null {
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function parseSettingReply<T extends z.ZodType>(
  raw: unknown,
  schema: T,
): z.output<T> {
  const envelope = z
    .object({
      success: z.boolean(),
      message: z.string().optional(),
      data: z.unknown().optional(),
    })
    .safeParse(raw);
  if (!envelope.success) throw new Error('Invalid settings response');
  if (!envelope.data.success)
    throw new Error(envelope.data.message || 'Unable to complete operation');
  const result = schema.safeParse(envelope.data.data);
  if (!result.success) throw new Error('Invalid settings response');
  return result.data;
}
export const optionsSchema = z
  .array(z.object({ key: z.string().min(1), value: z.string() }))
  .transform((rows) =>
    Object.fromEntries(rows.map(({ key, value }) => [key, value])),
  );
export const policySchema = z.object({
  options: z.record(z.string(), z.string()),
});
export const domainKeys = [
  'passkey.rp_id',
  'passkey.legacy_rp_ids',
  'passkey.origins',
  'ServerAddress',
];
export const domainImpactSchema = z
  .object({
    rp_id: z.string(),
    legacy_rp_ids: z.string(),
    origins: z.string(),
    previous_rp_id: z.string(),
    effective_rp_id: z.string(),
    removed_rp_ids: z
      .array(z.string())
      .nullable()
      .transform((value) => value ?? []),
    affected_credentials: count,
    unknown_credentials: count,
    confirmation_required: z.boolean(),
    removal_confirmation: z.string(),
  })
  .refine(
    (value) =>
      !value.confirmation_required || value.removal_confirmation.length > 0,
  );
export type DomainImpact = z.output<typeof domainImpactSchema>;
const fractional = new Set([
  'ChannelDisableThreshold',
  'monitor_setting.auto_test_channel_minutes',
  'monitor_setting.model_health_interval_minutes',
  'grok.violation_deduction_amount',
  'Price',
]);
export function validNumericSetting(key: string, value: string): boolean {
  if (!value.trim()) return false;
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (!fractional.has(key) && !Number.isSafeInteger(number))
  )
    return false;
  if (key === 'SMTPPort') return number >= 1 && number <= 65535;
  if (key === 'monitor_setting.channel_test_concurrency')
    return number >= 1 && number <= 32;
  if (key === 'perf_metrics_setting.flush_interval') return number >= 1;
  if (
    key.includes('budget_tokens_percentage') ||
    /monitor_(cpu|memory|disk)_threshold$/.test(key)
  )
    return number <= 100;
  return true;
}
// Validate the captured changes, including fields hidden by another tab or toggle.
export function invalidSettingKeys(
  changes: Settings,
  stored: Settings,
): string[] {
  const merged = { ...stored, ...changes };
  const invalid = Object.keys(changes).filter((key) => {
    const value = changes[key];
    if (key === 'WorkerUrl' && value !== value.trim()) return true;
    if (NUMBER_KEYS.has(key) && !validNumericSetting(key, value)) return true;
    if (BOOL_KEYS.has(key) && !['true', 'false', '1', '0'].includes(value))
      return true;
    if (
      JSON_ARRAY_TAG_KEYS.has(key) &&
      parseJSON(value, z.array(z.string())) === null
    )
      return true;
    if (settingJSON[key] && parseJSON(value, settingJSON[key]) === null)
      return true;
    if (
      SELECT_OPTIONS[key] &&
      !SELECT_OPTIONS[key].some((option) => option.value === value)
    )
      return true;
    if (
      (key === 'general_setting.docs_link' || key === 'WorkerUrl') &&
      value.trim()
    ) {
      try {
        const url = new URL(value.trim());
        return (
          !/^https?:$/.test(url.protocol) ||
          !url.hostname ||
          !!url.username ||
          !!url.password ||
          (key === 'WorkerUrl' && (!!url.hash || value !== value.trim())) ||
          /[\u0000-\u0020\u007f]/.test(value.trim())
        );
      } catch {
        return true;
      }
    }
    return false;
  });
  if (Object.keys(changes).some((key) => key.startsWith('checkin_setting.'))) {
    const min = merged['checkin_setting.min_quota'];
    const max = merged['checkin_setting.max_quota'];
    if (
      !min?.trim() ||
      !max?.trim() ||
      !count.safeParse(Number(min)).success ||
      !count.safeParse(Number(max)).success ||
      Number(max) < Number(min)
    )
      invalid.push('checkin_setting.min_quota', 'checkin_setting.max_quota');
  }
  if (invalidPaymentSettings(changes)) invalid.push('payment');
  if (invalidConsoleContentChanges(changes)) invalid.push('console');
  if (invalidGroupPricingChanges(changes)) invalid.push('groups');
  return [...new Set(invalid)];
}

export type Pair = { key: string; value: string };
export function serializePairs(rows: Pair[], numeric: boolean): string | null {
  const keys = rows.map((row) => row.key.trim());
  if (
    keys.some((key) => !key) ||
    new Set(keys).size !== keys.length ||
    (numeric &&
      rows.some(
        (row) =>
          !row.value.trim() ||
          !Number.isFinite(Number(row.value)) ||
          Number(row.value) < 0,
      ))
  )
    return null;
  return JSON.stringify(
    Object.fromEntries(
      rows.map((row) => [
        row.key.trim(),
        numeric ? Number(row.value) : row.value,
      ]),
    ),
    null,
    2,
  );
}
