import { isSidebarModuleEnabled } from '../../lib/sidebar-modules';
import type { SidebarModules } from '../../lib/sidebar-modules';

export const LOG_TABS = [
  { value: 'usage', label: 'Request logs', module: 'log' },
  { value: 'tasks', label: 'Async tasks', module: 'task' },
  { value: 'midjourney', label: 'Midjourney', module: 'midjourney' },
] as const;
export type LogTab = typeof LOG_TABS[number]['value'];

export function logTabFromSearch(search: string): LogTab {
  const requested = new URLSearchParams(search).get('tab');
  return LOG_TABS.find((tab) => tab.value === requested)?.value ?? 'usage';
}

export function visibleLogTabs(admin: SidebarModules) {
  return LOG_TABS.filter((tab) => isSidebarModuleEnabled('console', tab.module, admin));
}

export function logTabLocation(tab: LogTab, search = '', hash = ''): string {
  const params = new URLSearchParams(search);
  if (tab === 'usage') params.delete('tab');
  else params.set('tab', tab);
  const query = params.toString();
  return `/console/log${query ? `?${query}` : ''}${hash}`;
}
