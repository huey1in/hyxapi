import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { showError, showSuccess } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-error';
import { useAuthStore } from '../../stores/auth-store';
import type { AuthUser } from '../../stores/auth-store';
import { notificationForm } from './personal-settings';
import type { RefreshProfile } from './personal-settings';
import { createSettingsAutosave } from './settings-autosave';

export function useSettingsAutosave(user: AuthUser, refresh: RefreshProfile) {
  const { i18n } = useTranslation();
  const [autosave] = useState(() => createSettingsAutosave(notificationForm(user), user.role, async (patch, signal) => {
    signal.throwIfAborted();
    try {
      const { data } = await API.put('/api/user/setting', patch, { signal, skipErrorHandler: true, timeout: 30000 });
      if (!data.success) throw new Error(data.message || 'Unable to save preferences');
      signal.throwIfAborted();
      await refresh(signal);
      signal.throwIfAborted();
      showSuccess(i18n.t('Saved successfully'));
    } catch (error) {
      const message = apiErrorMessage(error, 'Unable to save preferences');
      if (!signal.aborted && message) showError(i18n.t(message));
      throw error;
    }
  }));
  const state = useSyncExternalStore(autosave.subscribe, autosave.getSnapshot);
  useEffect(() => {
    const identity = () => { const auth = useAuthStore.getState().auth; return `${auth.user?.id}:${auth.session?.sid}:${auth.user?.role}`; };
    const owner = identity();
    const unsubscribe = useAuthStore.subscribe(() => { if (identity() !== owner) autosave.cancel(); });
    // Navigating away flushes valid edits. Session changes cancel all work before
    // it can run with another account's credentials.
    return () => { void autosave.flush().finally(unsubscribe); };
  }, [autosave]);
  return { ...state, set: autosave.set, flush: autosave.flush };
}

export type SettingsAutosave = ReturnType<typeof useSettingsAutosave>;
