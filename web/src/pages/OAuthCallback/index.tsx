import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { applyAuthBundle, isAuthBundle } from '../../lib/auth-session';
import { useAuthStore } from '../../stores/auth-store';
import { API } from '../../helpers';
import { UserContext } from '../../context/User';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import { isLoginChallenge, safeAuthRedirect } from '../Auth/auth-flow';

export default function OAuthCallback() {
  const { t } = useTranslation();
  const { provider } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [, dispatch] = useContext(UserContext);
  const [error, setError] = useState('');

  useEffect(() => {
    const owner = new AbortController();
    const query = new URLSearchParams(search);
    const state = query.get('state');
    let popupIntent: string | null = null;
    try { if (state) popupIntent = sessionStorage.getItem(`hyxware:oauth-popup:${state}`); } catch { /* redirect flows do not require storage */ }
    if ((popupIntent === 'bind' || popupIntent === 'verify') && window.opener) {
      // Only the protocol's fields can enter the opener's callback message.
      window.opener.postMessage({ type: 'hyxware:oauth-callback', provider, state,
        code: query.get('code') || '', error: query.get('error') || '', error_description: query.get('error_description') || '',
      }, window.location.origin);
      return () => owner.abort();
    }
    setError('');
    // StrictMode immediately disposes its first effect. Defer the one-use
    // exchange so that discarded effect cannot consume the authorization code.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!provider || !state) throw new Error('Invalid OAuth callback. Start sign-in again.');
          const data = await authResult<unknown>(API.get(`/api/oauth/${encodeURIComponent(provider)}`, {
            params: Object.fromEntries(query), signal: owner.signal, disableDuplicate: true, skipAuthRefresh: true, skipErrorHandler: true,
          }));
          owner.signal.throwIfAborted();
          let redirectTo = '/console';
          try { redirectTo = safeAuthRedirect(sessionStorage.getItem(`hyxware:oauth-redirect:${state}`)); sessionStorage.removeItem(`hyxware:oauth-redirect:${state}`); } catch { /* optional storage */ }
          if (data && typeof data === 'object' && 'action' in data && data.action === 'bind') { navigate('/console/personal', { replace: true }); return; }
          if (isLoginChallenge(data)) {
            useAuthStore.getState().auth.setPendingLoginVerification({ challenge: data, redirectTo });
            navigate('/auth', { replace: true }); return;
          }
          if (!isAuthBundle(data)) throw new Error('Invalid sign-in response. Please try again.');
          applyAuthBundle(data); dispatch({ type: 'login', payload: data.user }); navigate(redirectTo, { replace: true });
        } catch (failure) {
          if (!owner.signal.aborted) setError(apiErrorMessage(failure, 'Sign-in failed. Please try again.'));
        }
      })();
    }, 0);
    return () => { window.clearTimeout(timer); owner.abort(); };
  }, [provider, search, navigate, dispatch]);

  return <div className='oauth-callback-page'>
    {error ? <><p role='alert'>{t(error)}</p><Link to='/auth?mode=login'>{t('Return to sign-in')}</Link></> : t('Completing sign-in…')}
  </div>;
}
