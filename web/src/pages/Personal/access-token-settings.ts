import { z } from 'zod';

const personalTokenSchema = z.object({
  id: z.number().int().positive(), name: z.string(), token_ref: z.string(), token_hint: z.string(),
  scopes: z.array(z.string()), expires_at: z.number(), last_used_at: z.number(),
  last_used_ip: z.string().nullish().transform((value) => value ?? ''), created_at: z.number(),
});
export const personalTokensSchema = z.object({
  items: z.array(personalTokenSchema),
  legacy: z.object({ token_hint: z.string(), token_ref: z.string().optional(), retire_at: z.number() }).nullish(),
});
export const tokenScopeCatalogSchema = z.object({
  groups: z.array(z.object({ group: z.string(), resources: z.array(z.object({
    resource: z.string(), label_key: z.string(),
    actions: z.array(z.object({ action: z.string(), label_key: z.string(), description_key: z.string() })),
  })) })),
  max_tokens: z.number().int().positive(), default_expiry_days: z.number().int().positive(),
});
export type PersonalToken = z.infer<typeof personalTokenSchema>;
export type AccessTokenForm = { name: string; scopes: string[]; expiry: string; customExpiry: string };

const normalizedScopes = (scopes: string[]) => [...new Set(scopes)].sort();
export function personalTokenPayload(form: AccessTokenForm, original: PersonalToken | null, now = Date.now()) {
  const name = form.name.trim();
  if (!name || [...name].length > 64) throw new Error('Access token name must contain 1 to 64 characters');
  const scopes = normalizedScopes(form.scopes);
  const changed = !original || JSON.stringify(scopes) !== JSON.stringify(normalizedScopes(original.scopes));
  if (changed && !scopes.length) throw new Error('Select at least one permission');
  const payload: { name: string; scopes?: string[]; expires_at?: number } = { name };
  if (changed) payload.scopes = scopes;
  if (!original) {
    const days = Number(form.expiry);
    const expiry = form.expiry === 'custom' ? new Date(form.customExpiry).getTime()
      : form.expiry === 'never' ? 0 : now + days * 86_400_000;
    if (form.expiry !== 'never' && (!Number.isFinite(expiry) || expiry < now + 3_600_000 || (form.expiry !== 'custom' && (!Number.isInteger(days) || days < 1)))) throw new Error('Choose an expiry at least one hour from now');
    payload.expires_at = form.expiry === 'never' ? 0 : Math.floor(expiry / 1000);
  }
  return payload;
}

export function localExpiryInput(now = Date.now()) {
  const date = new Date(now + 86_400_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
