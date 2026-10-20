/*
Copyright (C) 2023-2026 QuantumNous

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
export type ChatPreset = { id: string; name: string; url: string; type: 'web' | 'custom-protocol' | 'fluent' };
export type ActiveApiKey = { id?: number; key?: string; status: number; expired_time?: number; unlimited_quota?: boolean; remain_quota?: number };

export function detectChatLinkType(url: string): ChatPreset['type'] {
  if (/^https?:\/\//i.test(url)) return 'web';
  return url === 'fluentread' ? 'fluent' : 'custom-protocol';
}

export function validChatTemplate(value: string): boolean {
  if (!value || value.trim() !== value || /[\r\n\t]/.test(value)) return false;
  if (value === 'fluentread' || value === 'ccswitch') return true;
  try {
    const url = new URL(value);
    if (['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:'].includes(url.protocol)) return false;
    return url.protocol === 'http:' || url.protocol === 'https:' ? Boolean(url.hostname && !url.username && !url.password) : /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
  } catch { return false; }
}

export function parseChatConfig(raw: unknown): ChatPreset[] {
  let parsed = raw;
  if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { return []; } }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 1) return [];
    const [name, value] = Object.entries(entry)[0];
    if (!name.trim() || typeof value !== 'string' || !validChatTemplate(value)) return [];
    return [{ id: String(index), name, url: value, type: detectChatLinkType(value) }];
  });
}

export function chatLinkRequiresApiKey(url: string): boolean {
  return ['{key}', '{cherryConfig}', '{aionuiConfig}', '{deepchatConfig}', '{aqbotConfig}'].some((token) => url.includes(token)) || url === 'ccswitch' || url === 'fluentread';
}

export function normalizeApiKey(value: string): string {
  const key = value.trim();
  return key && !key.startsWith('sk-') ? `sk-${key}` : key;
}

function toBase64(value: string): string {
  return btoa(Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join(''));
}

export function resolveChatUrl({ template, apiKey = '', serverAddress }: { template: string; apiKey?: string; serverAddress: string }): string {
  if (!validChatTemplate(template) || template === 'ccswitch' || template === 'fluentread') return '';
  const key = normalizeApiKey(apiKey);
  if (chatLinkRequiresApiKey(template) && !key) return '';
  const address = serverAddress.replace(/\/+$/, '');
  const configs: Record<string, unknown> = {
    cherryConfig: { id: 'new-api', baseUrl: address, apiKey: key },
    aionuiConfig: { platform: 'new-api', baseUrl: address, apiKey: key },
    deepchatConfig: { id: 'new-api', baseUrl: address, apiKey: key },
  };
  let url = template;
  for (const [name, payload] of Object.entries(configs)) url = url.replaceAll(`{${name}}`, encodeURIComponent(toBase64(JSON.stringify(payload))));
  const aqbot = new URLSearchParams({ name: 'Hyxware', baseurl: address, apikey: key, type: 'openai' });
  url = url.replaceAll('{aqbotConfig}', aqbot.toString()).replaceAll('{address}', encodeURIComponent(address)).replaceAll('{key}', encodeURIComponent(key));
  return validChatTemplate(url) ? url : '';
}

export function getFirstActiveKey(keys: ActiveApiKey[] | undefined, now = Date.now() / 1000): ActiveApiKey | undefined {
  return keys?.find((item) => item.status === 1 && (!item.expired_time || item.expired_time === -1 || item.expired_time > now) && (item.unlimited_quota !== false || (item.remain_quota ?? 0) > 0));
}

export function buildCCSwitchURL(app: 'claude' | 'codex' | 'gemini', name: string, models: Record<string, string>, apiKey: string, serverAddress: string): string {
  if (!models.model?.trim() || !normalizeApiKey(apiKey)) return '';
  const address = serverAddress.replace(/\/+$/, '');
  const params = new URLSearchParams({ resource: 'provider', app, name, endpoint: app === 'codex' ? `${address}/v1` : address, apiKey: normalizeApiKey(apiKey), homepage: address, enabled: 'true' });
  for (const field of ['model', 'haikuModel', 'sonnetModel', 'opusModel']) if (models[field]?.trim()) params.set(field, models[field].trim());
  return `ccswitch://v1/import?${params.toString()}`;
}

export function sendToFluent(apiKey: string, serverAddress: string): boolean {
  const container = document.getElementById('fluent-new-api-container');
  if (!container) return false;
  container.dispatchEvent(new CustomEvent('fluent:prefill', { detail: { id: 'new-api', baseUrl: serverAddress, apiKey: normalizeApiKey(apiKey) } }));
  return true;
}
