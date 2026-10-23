import type { AxiosRequestConfig } from 'axios';
import type { VerificationOperation } from '../features/auth/secure-verification/types';

// Called only after the server explicitly requires a proof. The server also
// checks the scope and normalized context before consuming its one-time grant.
export function operationForRequest(config: AxiosRequestConfig, hasPassword = true): VerificationOperation | null {
  const path = (config.url || '').split('?')[0].replace(/\/$/, '');
  const method = (config.method || 'get').toUpperCase();
  let body: Record<string, unknown> = {};
  try { body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {}); } catch { return null; }
  const match = (pattern: RegExp) => path.match(pattern);
  const userID = Number(body.id);
  let found: RegExpMatchArray | null;
  if (method === 'POST' && (found = match(/^\/api\/channel\/(\d+)\/key$/))) return { scope: 'channel.key.read', context: { channel_id: Number(found[1]) } };
  if (method === 'POST' && path === '/api/user/passkey/register/begin') return { scope: 'passkey.register' };
  if (method === 'DELETE' && path === '/api/user/passkey') return { scope: 'passkey.delete' };
  if (method === 'POST' && path === '/api/user/2fa/setup') return { scope: '2fa.setup' };
  if (method === 'POST' && path === '/api/user/2fa/disable') return { scope: '2fa.disable' };
  if (method === 'POST' && path === '/api/user/2fa/backup_codes') return { scope: '2fa.backup_codes.regenerate' };
  if (method === 'PUT' && path === '/api/user/self' && body.password) return { scope: hasPassword ? 'account.password.change' : 'account.password.set' };
  if (method === 'DELETE' && path === '/api/user/self') return { scope: 'account.delete' };
  if (method === 'POST' && path === '/api/oauth/email/bind/start') return { scope: 'account.binding.bind', context: { provider: 'email', email: String(body.email || '').trim().toLowerCase() } };
  if (method === 'POST' && path === '/api/oauth/state' && body.intent === 'bind') return { scope: 'account.binding.bind', context: { provider: String(body.provider || '') } };
  if (method === 'POST' && path === '/api/oauth/wechat/bind') return { scope: 'account.binding.bind', context: { provider: 'wechat', code: String(body.code || '') } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/oauth\/bindings\/(\d+)$/))) return { scope: 'account.binding.unbind', context: { provider_id: Number(found[1]) } };
  if (method === 'POST' && path === '/api/user/access_tokens') return { scope: 'access_token.generate', context: { scopes: (body.scopes || []) as string[], expires_at: Number(body.expires_at || 0) } };
  if (method === 'PATCH' && (found = match(/^\/api\/user\/access_tokens\/(\d+)$/))) return { scope: 'access_token.update', context: { token_id: Number(found[1]), scopes: (body.scopes || []) as string[] } };
  if (method === 'DELETE' && path === '/api/user/access_tokens/legacy') return { scope: 'access_token.revoke', context: { legacy: true } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/access_tokens\/(\d+)$/))) return { scope: 'access_token.revoke', context: { token_id: Number(found[1]) } };
  if (method === 'POST' && path === '/api/user') return { scope: 'admin.user.create', context: { role: Number(body.role) } };
  if (method === 'PUT' && path === '/api/user') return { scope: 'admin.user.update', context: { user_id: userID } };
  if (method === 'PUT' && (found = match(/^\/api\/authz\/user\/(\d+)\/permissions$/))) return { scope: 'admin.user.update', context: { user_id: Number(found[1]) } };
  if (method === 'POST' && path === '/api/user/manage') {
    if (body.action === 'delete') return { scope: 'admin.user.delete', context: { user_id: userID } };
    if (['disable', 'enable', 'promote', 'demote', 'support'].includes(String(body.action))) return { scope: 'admin.user.manage', context: { user_id: userID, action: body.action as 'disable' | 'enable' | 'promote' | 'demote' | 'support' } };
  }
  if (method === 'DELETE' && (found = match(/^\/api\/user\/(\d+)$/))) return { scope: 'admin.user.delete', context: { user_id: Number(found[1]) } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/(\d+)\/reset_passkey$/))) return { scope: 'admin.user.passkey.reset', context: { user_id: Number(found[1]) } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/(\d+)\/2fa$/))) return { scope: 'admin.user.2fa.disable', context: { user_id: Number(found[1]) } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/(\d+)\/bindings\/([^/]+)$/))) return { scope: 'admin.user.binding.clear', context: { user_id: Number(found[1]), binding_type: decodeURIComponent(found[2]) } };
  if (method === 'DELETE' && (found = match(/^\/api\/user\/(\d+)\/oauth\/bindings\/(\d+)$/))) return { scope: 'admin.user.binding.clear', context: { user_id: Number(found[1]), provider_id: Number(found[2]) } };
  return null;
}
