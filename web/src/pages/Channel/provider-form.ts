export type ChannelCreateMode = 'single' | 'batch' | 'multi_to_single';

export const CHANNEL_KEY_HINTS: Record<number, string> = {
  15: 'APIKey|SecretKey',
  18: 'APPID|APISecret|APIKey',
  22: 'APIKey-AppId',
  23: 'TokenHub API Key / AppId|SecretId|SecretKey',
  33: 'AccessKey|SecretAccessKey|Region / APIKey|Region',
  50: 'AccessKey|SecretKey / API Key',
  51: 'Access Key ID|Secret Access Key',
  57: '{"access_token":"...","refresh_token":"...","account_id":"..."}',
  62: 'API Key / EMPTY',
  63: 'API Key / EMPTY',
};

export const CHANNEL_OTHER_FIELDS: Record<number, { label: string; placeholder: string }> = {
  3: { label: 'API Version', placeholder: '2024-02-01' },
  18: { label: 'Model Version', placeholder: 'v2.1' },
  21: { label: 'Knowledge Base ID', placeholder: '' },
  24: { label: 'API Version', placeholder: 'v1beta' },
  39: { label: 'Account ID', placeholder: 'Cloudflare Account ID' },
  41: { label: 'Region configuration (JSON)', placeholder: '{"default":"us-central1"}' },
  49: { label: 'Bot ID', placeholder: 'bot_xxx' },
};

export function isMultiKeyChannel(type: number, key: string, info?: { is_multi_key?: boolean }): boolean {
  return info?.is_multi_key === true || (type !== 57 && key.includes('\n'));
}

export function channelCredentialError(type: number, key: string, mode: ChannelCreateMode, editing: boolean): string | undefined {
  if (type === 57) {
    if (mode !== 'single') return 'Codex channels only support single creation';
    if (!key.trim() && editing) return;
    try {
      const credential: unknown = JSON.parse(key);
      if (!credential || Array.isArray(credential) || typeof credential !== 'object') throw new Error();
      const fields = credential as Record<string, unknown>;
      if (typeof fields.access_token !== 'string' || !fields.access_token.trim()) return 'Codex credential requires access_token';
      if (typeof fields.account_id !== 'string' || !fields.account_id.trim()) return 'Codex credential requires account_id';
    } catch { return 'Codex credential must be a JSON object'; }
  } else if (!editing && !key.trim()) return 'Enter an API key (use EMPTY for an unauthenticated inference server)';
}
