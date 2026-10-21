export type ModuleAccess = { enabled: boolean; requireAuth: boolean };
export type HeaderNavModules = {
  home: boolean;
  console: boolean;
  pricing: ModuleAccess;
  docs: boolean;
};

const flag = (raw: unknown, fallback: boolean): boolean => {
  if (typeof raw === 'boolean') return raw;
  if (raw === 1 || raw === '1') return true;
  if (raw === 0 || raw === '0') return false;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return fallback;
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

// Accept the persisted JSON and older scalar switches, just like the API guard.
export function parseHeaderNavModules(raw: unknown): HeaderNavModules {
  let value: unknown = raw;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
  const config = record(value) ?? {};
  const access = (key: 'pricing'): ModuleAccess => {
    const entry = record(config[key]);
    return entry ? { enabled: flag(entry.enabled, true), requireAuth: flag(entry.requireAuth, false) } : { enabled: flag(config[key], true), requireAuth: false };
  };
  return { home: flag(config.home, true), console: flag(config.console, true), pricing: access('pricing'), docs: flag(config.docs, true) };
}

export function publicModuleAccess(config: HeaderNavModules, module: 'pricing', authenticated: boolean): 'allowed' | 'disabled' | 'sign-in' {
  const access = config[module];
  return !access.enabled ? 'disabled' : access.requireAuth && !authenticated ? 'sign-in' : 'allowed';
}

export function publicRouteModule(path: string): 'pricing' | null {
  if (path === '/pricing' || path.startsWith('/pricing/')) return 'pricing';
  return null;
}
