export type SidebarModules = Record<string, Record<string, boolean>>;

export const sidebarSections = [
  { key: 'console', title: 'Console Area', modules: [
    { key: 'detail', title: 'Dashboard' }, { key: 'token', title: 'Token Management' },
    { key: 'log', title: 'Usage Logs' }, { key: 'audit', title: 'Audit Logs' },
    { key: 'midjourney', title: 'Drawing Logs' }, { key: 'task', title: 'Task Logs' },
  ] },
  { key: 'personal', title: 'Personal Center Area', modules: [
    { key: 'topup', title: 'Wallet Management' }, { key: 'personal', title: 'Personal Settings' },
    { key: 'security', title: 'Security & Access' },
  ] },
] as const;

// Invalid/legacy values do not narrow navigation. Only actual booleans count;
// personal preferences can never override the administrator or role checks.
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
  '/console/token': [['console', 'token']], '/console/log': [['console', 'log']],
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

export function isSidebarModuleVisible(route: string, admin: SidebarModules, user: SidebarModules = {}): boolean {
  const mappings = routes[route];
  if (!mappings) return true;
  return mappings.some(([section, module]) =>
    admin[section]?.enabled !== false && admin[section]?.[module] !== false &&
    user[section]?.enabled !== false && user[section]?.[module] !== false);
}

export function defaultSidebarModules(current: SidebarModules = {}): SidebarModules {
  const result = structuredClone(current);
  delete result.chat;
  for (const section of sidebarSections) {
    result[section.key] = { ...result[section.key], enabled: true };
    for (const module of section.modules) result[section.key][module.key] = true;
  }
  return result;
}
