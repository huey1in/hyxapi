export type SidebarModules = Record<string, Record<string, boolean>>;

// Invalid/legacy values do not narrow navigation. Only actual booleans count;
// navigation visibility remains separate from role and API authorization.
export function parseSidebarModules(raw: unknown): SidebarModules {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([section, modules]) => {
      if (section === 'chat') return [];
      if (!modules || typeof modules !== 'object' || Array.isArray(modules)) return [];
      return [[section, Object.fromEntries(Object.entries(modules).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))]];
    }));
  } catch { return {}; }
}

const routes: Record<string, readonly (readonly [string, string])[]> = {
  '/console': [['console', 'detail']],
  '/token': [['console', 'token']],
  '/log': [['console', 'log'], ['console', 'task'], ['console', 'midjourney']],
  '/audit': [['console', 'audit']], '/console/task': [['console', 'task']],
  '/console/midjourney': [['console', 'midjourney']],
  '/topup': [['personal', 'topup']], '/subscription': [['personal', 'topup']],
  // Profile and security share one local page. Keep its entry when either of
  // the corresponding upstream modules remains visible.
  '/personal': [['personal', 'personal'], ['personal', 'security']],
  '/channel': [['admin', 'channel']], '/models': [['admin', 'models']],
  '/vendors': [['admin', 'models']],
  '/redemption': [['admin', 'redemption']], '/user': [['admin', 'user']],
  '/subscription/manage': [['admin', 'subscription']], '/setting': [['admin', 'setting']],
};

export function isSidebarModuleVisible(route: string, admin: SidebarModules): boolean {
  const mappings = routes[route];
  if (!mappings) return true;
  return mappings.some(([section, module]) => isSidebarModuleEnabled(section, module, admin));
}

export function isSidebarModuleEnabled(section: string, module: string, admin: SidebarModules): boolean {
  return admin[section]?.enabled !== false && admin[section]?.[module] !== false;
}
