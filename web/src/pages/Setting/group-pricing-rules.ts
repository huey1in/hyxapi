import { z } from 'zod';

const group = z.string().refine((key) => key.trim().length > 0);
const target = group.refine((key) => key.replace(/^[+-]:/, '').trim().length > 0);
const ratios = z.record(group, z.record(group, z.number().finite().nonnegative()));
const usable = z.record(group, z.record(target, z.string()));
export const groupPricingRuleKeys = ['GroupGroupRatio', 'group_ratio_setting.group_special_usable_group'] as const;
export type GroupPricingRuleKey = typeof groupPricingRuleKeys[number];

export function validGroupPricingRule(key: GroupPricingRuleKey, raw: string): boolean {
  try { return (key === 'GroupGroupRatio' ? ratios : usable).safeParse(JSON.parse(raw)).success; }
  catch { return false; }
}

export function invalidGroupPricingChanges(changes: Record<string, unknown>): boolean {
  return groupPricingRuleKeys.some((key) => key in changes && !validGroupPricingRule(key, String(changes[key] ?? '')));
}
