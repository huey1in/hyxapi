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

import {
  getUserIdFromLocalStorage,
  showError,
} from './utils';
import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { applyAuthRotation, clearAuthentication, getFreshAuthHeaders, refreshAuthentication } from '../lib/auth-session';
import { operationForRequest } from '../lib/verification-operation';
import { requestVerification } from '../lib/verification-request';
import { useAuthStore } from '../stores/auth-store';
import type { ApiEnvelope } from '../types/api';
import { normalizeLanguage } from '../i18n/language';

const apiBaseURL = import.meta.env.PUBLIC_API_BASE_URL || '';

export let API = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    'New-API-User': getUserIdFromLocalStorage(),
    'Cache-Control': 'no-store',
  },
});

function patchAPIInstance(instance: AxiosInstance) {
  const originalGet = instance.get.bind(instance);
  const inFlightGetRequests = new Map<string, Promise<unknown>>();

  const genKey = (url: string, config: AxiosRequestConfig = {}) => {
    const params = config.params ? JSON.stringify(config.params) : '{}';
    return `${url}?${params}`;
  };

  instance.get = <T = unknown, R = AxiosResponse<T>, D = unknown>(url: string, config: AxiosRequestConfig<D> = {}): Promise<R> => {
    if (config?.disableDuplicate) {
      return originalGet<T, R, D>(url, config);
    }

    const key = `${useAuthStore.getState().auth.session?.sid || 'anonymous'}:${genKey(url, config)}`;
    if (inFlightGetRequests.has(key)) {
      return inFlightGetRequests.get(key) as Promise<R>;
    }

    const reqPromise = originalGet<T, R, D>(url, config).finally(() => {
      inFlightGetRequests.delete(key);
    });

    inFlightGetRequests.set(key, reqPromise);
    return reqPromise;
  };

  // Forward the active UI language to the backend so its i18n responses
  // (toast messages, error strings) come back in the user's language.
  instance.interceptors.request.use(async (config) => {
    const initial = useAuthStore.getState().auth;
    const identity = `${initial.user?.id}:${initial.session?.sid}`;
    if (config.verificationOwner === undefined) config.verificationOwner = identity;
    if (config.singleUseAuthorization || config.headers.has('X-Security-Proof')) {
      config.skipAuthRefresh = true;
      const headers = await getFreshAuthHeaders();
      const current = useAuthStore.getState().auth;
      if (config.verificationOwner !== `${current.user?.id}:${current.session?.sid}`) throw new axios.CanceledError('Security verification owner changed');
      Object.entries(headers).forEach(([key, value]) => config.headers.set(key, value));
    } else {
      const token = useAuthStore.getState().auth.accessToken;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const lang = localStorage.getItem('i18nextLng') || navigator.language || 'en';
      const normalised = normalizeLanguage(String(lang)) || 'en';
      config.headers = config.headers || {};
      config.headers['Accept-Language'] = normalised;
    } catch {}
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      if (response.config.acceptAuthRotation && response.data?.success) applyAuthRotation(response.data.data);
      return response;
    },
    async (error) => {
      const config = error.config;
      if (error.response?.status === 403 && error.response?.data?.code === 'SECURITY_PROOF_REQUIRED' && config && !config.headers?.['X-Security-Proof']) {
        const operation = operationForRequest(config, useAuthStore.getState().auth.user?.has_password !== false);
        if (operation) {
          const auth = useAuthStore.getState().auth;
          const owner = `${auth.user?.id}:${auth.session?.sid}`;
          if (config.verificationOwner !== owner) throw new axios.CanceledError('Security verification owner changed');
          const proof = await requestVerification(operation, config.signal);
          const current = useAuthStore.getState().auth;
          if (config.signal?.aborted || owner !== `${current.user?.id}:${current.session?.sid}`) throw new axios.CanceledError('Security verification owner changed');
          config.headers['X-Security-Proof'] = proof.proof_token;
          config.singleUseAuthorization = true;
          config.skipAuthRefresh = true;
          return instance.request(config);
        }
      }
      if (error.response?.status === 401 && config && !AUTH_BYPASS_RE.test(config.url || '')) {
        if (!config.skipAuthRefresh && !config.authRetry) {
          config.authRetry = true;
          const outcome = await refreshAuthentication();
          if (outcome.kind === 'authenticated') {
            config.headers.Authorization = `Bearer ${outcome.bundle.access_token}`;
            return instance.request(config);
          }
          if (outcome.kind === 'anonymous' || outcome.kind === 'out_of_sync') handleUnauthorized(error);
        } else if (config.authRetry) {
          clearAuthentication(false);
          handleUnauthorized(error);
        }
      }
      if (!config?.skipErrorHandler) showError(error);
      return Promise.reject(error);
    },
  );
}

patchAPIInstance(API);

export function updateAPI() {
  API = axios.create({
    baseURL: apiBaseURL,
    withCredentials: true,
    headers: {
      'New-API-User': getUserIdFromLocalStorage(),
      'Cache-Control': 'no-store',
    },
  });

  patchAPIInstance(API);
}

// Path-prefixes whose 401/403 should NOT trigger a global redirect
// to /auth — these are part of the auth flow itself or always-public.
const AUTH_BYPASS_RE =
  /\/api\/(oauth|status|notice|verification|reset_password|user\/(auth|login|register|passkey\/login|password_reset))/;

const handleUnauthorized = (error: AxiosError) => {
  const url = error?.config?.url || '';
  if (AUTH_BYPASS_RE.test(url)) return;
  // 在 setup / oauth callback 等独立页面直接放过
  const path = window.location.pathname;
  if (path === '/setup' || path.startsWith('/oauth/') || path === '/user/reset') {
    return;
  }
  // 清掉本地用户态，再由全局认证事件触发跳转。
  try {
    localStorage.removeItem('user');
  } catch {}
  // 通过全局事件统一跳转认证页。
  try {
    window.dispatchEvent(
      new CustomEvent('hyxware:auth-required', { detail: { from: path } }),
    );
  } catch {}
};

let channelModels: Record<string, string[]> | undefined;

export function getChannelModels(type: string | number): string[] {
  if (channelModels !== undefined && type in channelModels) {
    if (!channelModels[type]) {
      return [];
    }
    return channelModels[type];
  }
  let models = localStorage.getItem('channel_models');
  if (!models) {
    return [];
  }
  channelModels = JSON.parse(models) as Record<string, string[]>;
  if (type in channelModels) {
    return channelModels[type];
  }
  return [];
}

export async function logoutAuthentication(signal?: AbortSignal) {
  const { accessToken, session } = useAuthStore.getState().auth;
  const response = await API.post<ApiEnvelope<unknown>>('/api/user/auth/logout', undefined, {
    signal,
    headers: { ...(session ? { 'X-Auth-Session': session.sid } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    skipAuthRefresh: true, skipErrorHandler: true,
  });
  signal?.throwIfAborted();
  if (!response.data.success) throw new Error(response.data.message || 'Unable to complete operation');
  const current = useAuthStore.getState().auth;
  if (current.session?.sid !== session?.sid) return false;
  clearAuthentication();
  localStorage.removeItem('user');
  return true;
}
