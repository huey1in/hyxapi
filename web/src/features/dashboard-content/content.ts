import { z } from 'zod';

export const consoleColors = ['blue', 'green', 'cyan', 'purple', 'pink', 'red', 'orange', 'amber', 'yellow', 'lime', 'light-green', 'teal', 'light-blue', 'indigo', 'violet', 'grey', 'slate'] as const;
const unsafeContent = /<script|<iframe|javascript:|onload=|onerror=|onclick=/i;
export function safeApiURL(value: string): boolean {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password && !value.includes('\\');
  } catch { return false; }
}
// The server and browser form limits count UTF16 code units, including emoji pairs.
const requiredText = (max: number) => z.string().refine((value) => value.trim().length > 0 && value.length <= max);
const apiShape = z.object({ url: z.string(), route: z.string(), description: z.string(), color: z.string() });
const faqShape = z.object({ question: z.string(), answer: z.string() });
export const apiInfoSchema = apiShape.extend({
  url: requiredText(500).refine(safeApiURL),
  route: requiredText(100).refine((value) => !unsafeContent.test(value)),
  description: requiredText(200).refine((value) => !unsafeContent.test(value)),
  color: z.enum(consoleColors),
});
export const faqSchema = faqShape.extend({ question: requiredText(200), answer: requiredText(1000) });
export type ApiInfo = z.infer<typeof apiShape>;
export type FAQ = z.infer<typeof faqShape>;
export type ConsoleListKind = 'api_info' | 'faq';
export function parseConsoleDraft(kind: ConsoleListKind, value: string) {
  let raw: unknown;
  try { raw = JSON.parse(value || '[]'); } catch { return { rows: null, valid: false }; }
  if (kind === 'api_info') {
    const result = z.array(apiShape).safeParse(raw);
    return { rows: result.success ? result.data : null, valid: z.array(apiInfoSchema).max(50).safeParse(raw).success };
  }
  const result = z.array(faqShape).safeParse(raw);
  return { rows: result.success ? result.data : null, valid: z.array(faqSchema).max(100).safeParse(raw).success };
}
export function parseApiInfo(value: unknown): ApiInfo[] {
  return Array.isArray(value) ? value.flatMap((item) => { const result = apiInfoSchema.safeParse(item); return result.success ? [result.data] : []; }).slice(0, 50) : [];
}
export function parseFAQ(value: unknown): FAQ[] {
  return Array.isArray(value) ? value.flatMap((item) => { const result = faqSchema.safeParse(item); return result.success ? [result.data] : []; }).slice(0, 100) : [];
}
export function invalidConsoleContentChanges(changes: Record<string, unknown>): boolean {
  return (['api_info', 'faq'] as const).some((kind) => {
    const key = `console_setting.${kind}`;
    return Object.hasOwn(changes, key) && (typeof changes[key] !== 'string' || !parseConsoleDraft(kind, changes[key]).valid);
  });
}
