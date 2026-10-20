import type { AuthUser } from '../stores/auth-store';
import { hasPermission } from './admin-permissions';
import { ROLE } from './roles';

export const isConsolePath = (path: string) => path === '/console' || path.startsWith('/console/');
const adminPages = new Set(['channel', 'models', 'vendors', 'user', 'operations', 'system-status', 'redemption', 'subscription']);

// Sidebar preferences control discoverability. Authorization uses the role and
// capability matrix returned by the server, including for direct navigation.
export function canOpenConsolePage(path: string, user: AuthUser | null | undefined): boolean {
  if (!isConsolePath(path)) return true;
  if (!user || user.role < ROLE.USER) return false;
  const page = path.split('/')[2] || '';
  if (page === 'setting') return user.role >= ROLE.SUPER_ADMIN;
  if (adminPages.has(page) && user.role < ROLE.ADMIN) return false;
  if (page === 'channel' && !hasPermission(user, 'channel', 'read')) return false;
  return true;
}
