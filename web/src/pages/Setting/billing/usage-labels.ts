import type { BillingUsageFieldSchema } from '../../../features/pricing/types';
import { resolveLocalizedText } from '../../../features/pricing/lib/localized-text';

export function usageLabel(value: string | Record<string, string> | undefined, fallback: string, language: string) {
  return resolveLocalizedText(value, language) || fallback;
}

export function usageUnit(definition: BillingUsageFieldSchema, language: string, translate: (key: string) => string) {
  if (definition.unit === 'token') return '1M tokens';
  const custom = resolveLocalizedText(definition.unitLabel, language);
  if (custom) return custom;
  const units: Record<string, string> = { second: 'Seconds', count: 'Calls', credit: 'Credits' };
  return translate(units[definition.unit || ''] || 'Unit');
}
