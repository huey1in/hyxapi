import { API } from '../helpers/api';
import { authResult } from './secure-verification';

interface OAuthState { flow_token: string; authorization_url?: string }

export function authorizationURL(provider: string, state: string, status: Record<string, unknown>): string {
  const redirect = `${window.location.origin}/oauth/${encodeURIComponent(provider)}`;
  let endpoint: string;
  let client: string;
  let scope = 'openid profile email';
  switch (provider) {
    case 'github': endpoint = 'https://github.com/login/oauth/authorize'; client = String(status.github_client_id || ''); scope = 'user:email'; break;
    case 'discord': endpoint = 'https://discord.com/oauth2/authorize'; client = String(status.discord_client_id || ''); scope = 'identify openid'; break;
    case 'linuxdo': endpoint = 'https://connect.linux.do/oauth2/authorize'; client = String(status.linuxdo_client_id || ''); break;
    case 'oidc': endpoint = String(status.oidc_authorization_endpoint || ''); client = String(status.oidc_client_id || ''); break;
    default: {
      const custom = (status.custom_oauth_providers as { slug: string; client_id: string; authorization_endpoint: string; scopes?: string }[] | undefined)?.find((item) => item.slug === provider);
      if (!custom) throw new Error('OAuth provider is unavailable');
      endpoint = custom.authorization_endpoint; client = custom.client_id; scope = custom.scopes || scope;
    }
  }
  const url = new URL(endpoint);
  url.searchParams.set('client_id', client); url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirect); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', scope);
  return url.toString();
}

// Exchange the provider callback in the authenticated opener. The popup never
// receives the dashboard access token or the resulting operation proof.
export async function oauthExchange<T>(provider: string, intent: 'bind' | 'verify', operation?: { scope: string; context?: unknown }, proofToken?: string, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const popup = window.open('about:blank', '_blank', 'popup,width=540,height=720');
  if (!popup) throw new Error('Allow popups to continue verification');
  let cleanup = () => {};
  try {
    const [state, status] = await Promise.all([
      authResult<OAuthState>(API.post('/api/oauth/state', { provider, intent, ...operation }, {
        signal, skipErrorHandler: true, ...(proofToken ? { headers: { 'X-Security-Proof': proofToken }, singleUseAuthorization: true } : {}),
      })),
      authResult<Record<string, unknown>>(API.get('/api/status', { signal, skipErrorHandler: true })),
    ]);
    signal?.throwIfAborted();
    popup.sessionStorage.setItem(`hyxware:oauth-popup:${state.flow_token}`, intent);
    const callback = new Promise<Record<string, string>>((resolve, reject) => {
      const handle = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== 'hyxware:oauth-callback' || event.data?.state !== state.flow_token || event.data?.provider !== provider) return;
        resolve(event.data);
      };
      window.addEventListener('message', handle);
      const cancel = () => reject(new DOMException('OAuth verification cancelled', 'AbortError'));
      const timer = window.setInterval(() => { if (popup.closed) cancel(); }, 500);
      const timeout = window.setTimeout(() => reject(new Error('OAuth verification expired')), 10 * 60_000);
      cleanup = () => { window.removeEventListener('message', handle); window.clearInterval(timer); window.clearTimeout(timeout); signal?.removeEventListener('abort', cancel); };
      signal?.addEventListener('abort', cancel, { once: true });
      try { signal?.throwIfAborted(); popup.location.replace(state.authorization_url || authorizationURL(provider, state.flow_token, status)); }
      catch (error) { reject(error); }
    });
    const result = await callback;
    signal?.throwIfAborted();
    return await authResult<T>(API.get(`/api/oauth/${encodeURIComponent(provider)}`, {
      params: { state: result.state, code: result.code, error: result.error, error_description: result.error_description },
      signal, disableDuplicate: true, singleUseAuthorization: true, skipErrorHandler: true,
    }));
  } finally { cleanup(); popup.close(); }
}
