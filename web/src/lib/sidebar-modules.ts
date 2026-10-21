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
  '/console/token': [['console', 'token']],
  '/console/log': [['console', 'log'], ['console', 'task'], ['console', 'midjourney']],
  '/console/audit': [['console', 'audit']], '/console/task': [['console', 'task']],
  '/console/midjourney': [['console', 'midjourney']],
  '/console/topup': [['personal', 'topup']], '/console/my-subscription': [['personal', 'topup']],
  // Profile and security share one local page. Keep its entry when either of
  // the corresponding upstream modules remains visible.
  '/console/personal': [['personal', 'personal'], ['personal', 'security']],
  '/console/channel': [['admin', 'channel']], '/console/models': [['admin', 'models']],
  '/console/vendors': [['admin', 'models']],
  '/console/redemption': [['admin', 'redemption']], '/console/user': [['admin', 'user']],
  '/console/subscription': [['admin', 'subscription']], '/console/setting': [['admin', 'setting']],
};

export function isSidebarModuleVisible(route: string, admin: SidebarModules): boolean {
  const mappings = routes[route];
  if (!mappings) return true;
  return mappings.some(([section, module]) => isSidebarModuleEnabled(section, module, admin));
}

export function isSidebarModuleEnabled(section: string, module: string, admin: SidebarModules): boolean {
  return admin[section]?.enabled !== false && admin[section]?.[module] !== false;
}
