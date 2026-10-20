/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect } from 'react';
import type { Dispatch, PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { reducer, initialState } from './reducer';
import type { UserAction, UserState } from './reducer';
import { subscribeAuthSessionEvents } from '../../lib/auth-session-sync';
import { clearAuthentication, refreshAuthentication } from '../../lib/auth-session';
import { useAuthStore } from '../../stores/auth-store';
import { normalizeLanguage } from '../../i18n/language';

export const UserContext = React.createContext<[UserState, Dispatch<UserAction>]>([
  initialState,
  () => {},
]);

export const UserProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const { i18n } = useTranslation();
  useEffect(() => useAuthStore.subscribe((next, previous) => {
    if (next.auth.user !== previous.auth.user) {
      dispatch(next.auth.user ? { type: 'login', payload: next.auth.user } : { type: 'logout' });
    }
  }), []);

  useEffect(() => subscribeAuthSessionEvents((event) => {
    const sid = useAuthStore.getState().auth.session?.sid;
    if (event.kind === 'signed_out' && sid === event.sid) clearAuthentication(false);
    else if (event.kind === 'authenticated' && sid !== event.sid) {
      clearAuthentication(false, 'idle');
      void refreshAuthentication();
    }
  }), []);

  // Sync language preference when user data is loaded
  useEffect(() => {
    if (state.user?.setting) {
      try {
        const settings = typeof state.user.setting === 'string' ? JSON.parse(state.user.setting) : state.user.setting;
        const normalizedLanguage = normalizeLanguage(settings.language);
        if (normalizedLanguage && normalizedLanguage !== i18n.language) {
          i18n.changeLanguage(normalizedLanguage);
        }
        if (normalizedLanguage) {
          localStorage.setItem('i18nextLng', normalizedLanguage);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [state.user?.setting, i18n]);

  return (
    <UserContext.Provider value={[state, dispatch]}>
      {children}
    </UserContext.Provider>
  );
};
