import type { AuthUser } from '../stores/auth-store';
import { hasPermission } from './admin-permissions';
import { ROLE } from './roles';

const clientPages = new Set(['token', 'log', 'topup', 'subscription', 'personal', 'notices', 'tickets', 'leaderboard']);
const isPricingPath = (path: string) => path === '/pricing' || path.startsWith('/pricing/');
const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
const adminPaths = ['/channel', '/models', '/vendors', '/user', '/operations', '/system-status', '/redemption', '/subscription/manage', '/audit'];

export function isConsolePath(pathname: string, authenticated = false): boolean {
  const path = pathname;
  if (path.replace(/\/+$/, '') === '/user/reset') return false;
  return path.replace(/\/+$/, '') === '/console' || clientPages.has(path.split('/')[1])
    || adminPaths.some((root) => within(path, root)) || within(path, '/setting')
    || (authenticated && isPricingPath(path));
}

// Administrator sidebar configuration controls discoverability. Authorization uses the role and
// capability matrix returned by the server, including for direct navigation.
export function canOpenConsolePage(pathname: string, user: AuthUser | null | undefined): boolean {
  const path = pathname;
  if (!isConsolePath(path, Boolean(user))) return true;
  if (!user || user.role < ROLE.USER) return false;
  if (within(path, '/setting')) return user.role >= ROLE.SUPER_ADMIN;
  if (within(path, '/tickets/manage')) return user.role >= ROLE.SUPPORT;
  if (adminPaths.some((root) => within(path, root)) && user.role < ROLE.ADMIN) return false;
  if (within(path, '/channel') && !hasPermission(user, 'channel', 'read')) return false;
  return true;
}
