import { z } from 'zod';

export const CC_SWITCH_APPS = {
  claude: { label: 'Claude Code', apiFormat: 'anthropic' },
  codex: { label: 'Codex', apiFormat: 'openai_responses' },
  gemini: { label: 'Gemini CLI', apiFormat: 'gemini_native' },
} as const;
export type CCSwitchApp = keyof typeof CC_SWITCH_APPS;
export type CCSwitchModels = { model: string; haikuModel?: string; sonnetModel?: string; opusModel?: string };

export const ccSwitchModelsSchema = z.object({ success: z.literal(true), data: z.array(z.object({ id: z.string().min(1) })) });
export const ccSwitchKeySchema = z.object({ success: z.literal(true), data: z.object({ key: z.string().trim().min(1).refine((key) => !!key.replace(/^sk-/, '') && !/[\s*]/.test(key)) }) });

// CC Switch's provider import protocol: https://github.com/farion1231/cc-switch/blob/main/docs/guides/deeplink-site-integration-guide-en.md
export function buildCCSwitchURL({ app, name, models, apiKey, serverAddress }: {
  app: CCSwitchApp; name: string; models: CCSwitchModels; apiKey: string; serverAddress: string;
}) {
  if (!Object.hasOwn(CC_SWITCH_APPS, app)) throw new Error('Invalid CC Switch application');
  if (!name.trim()) throw new Error('Please enter a name');
  if (!models.model.trim()) throw new Error('Please select a primary model');
  const key = apiKey.trim();
  if (!key.replace(/^sk-/, '') || /[\s*]/.test(key)) throw new Error('Invalid API key response');
  let address: URL;
  try { address = new URL(serverAddress); } catch { throw new Error('Invalid API server address'); }
  if (!['http:', 'https:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) throw new Error('Invalid API server address');
  const base = address.href.replace(/\/+$/, '');
  const params = new URLSearchParams({
    resource: 'provider', app, name: name.trim(),
    endpoint: app === 'codex' && !base.endsWith('/v1') ? `${base}/v1` : base,
    apiFormat: CC_SWITCH_APPS[app].apiFormat,
    apiKey: key.startsWith('sk-') ? key : `sk-${key}`,
    homepage: base, model: models.model.trim(), enabled: 'true',
  });
  if (app === 'claude') {
    for (const field of ['haikuModel', 'sonnetModel', 'opusModel'] as const) {
      if (models[field]?.trim()) params.set(field, models[field].trim());
    }
  }
  return `ccswitch://v1/import?${params}`;
}
