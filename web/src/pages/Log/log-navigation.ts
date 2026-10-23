import { isSidebarModuleEnabled } from '../../lib/sidebar-modules';
import type { SidebarModules } from '../../lib/sidebar-modules';

export const LOG_SOURCES = [
  { value: 'usage', label: 'Request logs', module: 'log' },
  { value: 'tasks', label: 'Async tasks', module: 'task' },
  { value: 'midjourney', label: 'Midjourney', module: 'midjourney' },
] as const;
export type LogSourceOption = typeof LOG_SOURCES[number];

export function visibleLogSources(admin: SidebarModules) {
  return LOG_SOURCES.filter((source) => isSidebarModuleEnabled('console', source.module, admin));
}
