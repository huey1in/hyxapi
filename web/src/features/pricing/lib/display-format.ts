import type { PricingModel } from '../types.ts';

// Public callers supply the site's selected currency formatter. The fallback
// also serves isolated expression tests without requiring browser state.
export function formatBillingCurrencyFromUSD(value: number, options: { showSymbol?: boolean; digitsLarge: number; digitsSmall: number; abbreviate?: boolean }): string {
  const digits = Math.abs(value) >= 1 ? options.digitsLarge : options.digitsSmall;
  return `${options.showSymbol === false ? '' : '$'}${Number(value.toFixed(digits))}`;
}

export function getDisplayGroupRatio(model: PricingModel, selectedGroup?: string): number {
  const groups = model.enable_groups || [];
  const ratios = model.group_ratio || {};
  if (selectedGroup && selectedGroup !== 'all' && groups.includes(selectedGroup)) return ratios[selectedGroup] ?? 1;
  const values = groups.map((group) => ratios[group]).filter((value) => Number.isFinite(value));
  return values.length ? Math.min(...values) : 1;
}

export function toIntlLocale(language: string): string {
  if (language.toLowerCase() === 'zhcn') return 'zh-CN';
  if (language.toLowerCase() === 'zhtw') return 'zh-TW';
  try { return Intl.getCanonicalLocales(language.replaceAll('_', '-'))[0] || 'en'; } catch { return 'en'; }
}
