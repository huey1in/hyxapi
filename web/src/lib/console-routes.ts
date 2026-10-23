import type { AuthUser } from '../stores/auth-store';
import { hasPermission } from './admin-permissions';
import { ROLE } from './roles';

export const CONSOLE_ROUTE_REDIRECTS: Record<string, string> = {
  '/console/pricing': '/pricing',
  '/console/token': '/token',
  '/console/log': '/log',
  '/console/topup': '/topup',
  '/console/my-subscription': '/subscription',
  '/console/personal': '/personal',
  '/console/notices': '/notices',
  '/console/channel': '/channel',
  '/console/models': '/models',
  '/console/vendors': '/vendors',
  '/console/user': '/user',
  '/console/operations': '/operations',
  '/console/audit': '/audit',
  '/console/system-status': '/system-status',
  '/console/redemption': '/redemption',
  '/console/subscription': '/subscription/manage',
  '/console/setting': '/setting',
  '/console/tickets': '/tickets/manage',
};

const clientPages = new Set(['token', 'log', 'topup', 'subscription', 'personal', 'notices', 'tickets']);
const isPricingPath = (path: string) => path === '/pricing' || path.startsWith('/pricing/');
const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
const adminPaths = ['/channel', '/models', '/vendors', '/user', '/operations', '/system-status', '/redemption', '/subscription/manage', '/audit'];

export function canonicalConsolePath(path: string): string {
  for (const [previous, current] of Object.entries(CONSOLE_ROUTE_REDIRECTS)) {
    if (path === previous || path.startsWith(`${previous}/`)) return current + path.slice(previous.length);
  }
  return path;
}

export function isConsolePath(pathname: string, authenticated = false): boolean {
  const path = canonicalConsolePath(pathname);
  if (path.replace(/\/+$/, '') === '/user/reset') return false;
  return path === '/console' || path.startsWith('/console/') || clientPages.has(path.split('/')[1])
    || adminPaths.some((root) => within(path, root)) || within(path, '/setting')
    || (authenticated && isPricingPath(path));
}

// Administrator sidebar configuration controls discoverability. Authorization uses the role and
// capability matrix returned by the server, including for direct navigation.
export function canOpenConsolePage(pathname: string, user: AuthUser | null | undefined): boolean {
  const path = canonicalConsolePath(pathname);
  if (!isConsolePath(path, Boolean(user))) return true;
  if (!user || user.role < ROLE.USER) return false;
  if (within(path, '/setting')) return user.role >= ROLE.SUPER_ADMIN;
  if (within(path, '/tickets/manage')) return user.role >= ROLE.SUPPORT;
  if (adminPaths.some((root) => within(path, root)) && user.role < ROLE.ADMIN) return false;
  if (within(path, '/channel') && !hasPermission(user, 'channel', 'read')) return false;
  return true;
}
