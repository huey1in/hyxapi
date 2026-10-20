import type { DynamicPriceEntry } from './dynamic-price.ts';
import { resolveLocalizedText } from './localized-text.ts';

export function applyRechargePrice(usd: number, enabled: boolean, priceRate: unknown, usdExchangeRate: unknown): number {
  if (!enabled) return usd;
  const rate = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(value, 0.001) : fallback;
  const recharge = rate(priceRate, 1);
  return usd * recharge / rate(usdExchangeRate, recharge);
}

export function priceEntryLabel(entry: DynamicPriceEntry, language: string, t: (value: string) => string): string {
  return entry.labelKind === 'schema'
    ? resolveLocalizedText(entry.description, language) || entry.field
    : t(entry.label);
}

export function priceEntryUnit(entry: DynamicPriceEntry, tokenUnit: 'M' | 'K', language: string): string {
  if (entry.variable) return `1${tokenUnit} Tokens`;
  if (entry.unit === 'token') return '1M Tokens';
  const dictionaries: Record<string, Record<string, string>> = {
    en: { second: 'second', credit: 'credit', image: 'image', request: 'request', count: 'unit' },
    'zh-CN': { second: '秒', credit: '积分', image: '张', request: '次', count: '次' },
    'zh-TW': { second: '秒', credit: '積分', image: '張', request: '次', count: '次' },
    fr: { second: 'seconde', credit: 'crédit', image: 'image', request: 'requête', count: 'unité' },
    ru: { second: 'секунда', credit: 'кредит', image: 'изображение', request: 'запрос', count: 'единица' },
    ja: { second: '秒', credit: 'クレジット', image: '枚', request: '回', count: '単位' },
    vi: { second: 'giây', credit: 'điểm', image: 'ảnh', request: 'yêu cầu', count: 'đơn vị' },
  };
  const locale = language.toLowerCase().replace('_', '-');
  const key = locale.startsWith('zh') ? /tw|hk|hant/.test(locale) ? 'zh-TW' : 'zh-CN' : locale.split('-')[0];
  const units = dictionaries[key] ?? dictionaries.en;
  if (entry.unit === 'count') return resolveLocalizedText(entry.unitLabel, language) || units.count;
  return units[entry.unit] || entry.unit;
}

export function decodeBillingExpression(encoded: unknown): string | null {
  if (typeof encoded !== 'string' || !encoded || encoded.length > 131072) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))); } catch { return null; }
}
