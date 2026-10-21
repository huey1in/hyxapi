import type { AuthUser } from '../stores/auth-store';
import { hasPermission } from './admin-permissions';
import { ROLE } from './roles';

export const CLIENT_ROUTE_REDIRECTS: Record<string, string> = {
  '/console/pricing': '/pricing',
  '/console/token': '/token',
  '/console/log': '/log',
  '/console/topup': '/topup',
  '/console/my-subscription': '/subscription',
  '/console/personal': '/personal',
  '/console/notices': '/notices',
};

const clientPages = new Set(['token', 'log', 'topup', 'subscription', 'personal', 'notices']);
export const isPricingPath = (path: string) => path === '/pricing' || path.startsWith('/pricing/');
export const isConsolePath = (path: string, authenticated = false) => path === '/console' || path.startsWith('/console/') || clientPages.has(path.split('/')[1]) || (authenticated && isPricingPath(path));

export function canonicalClientPath(path: string): string {
  for (const [previous, current] of Object.entries(CLIENT_ROUTE_REDIRECTS)) {
    if (path === previous || path.startsWith(`${previous}/`)) return current + path.slice(previous.length);
  }
  return path;
}
const adminPages = new Set(['channel', 'models', 'vendors', 'user', 'operations', 'system-status', 'redemption', 'subscription', 'audit']);

// Administrator sidebar configuration controls discoverability. Authorization uses the role and
// capability matrix returned by the server, including for direct navigation.
export function canOpenConsolePage(path: string, user: AuthUser | null | undefined): boolean {
  if (!isConsolePath(path, Boolean(user))) return true;
  if (!user || user.role < ROLE.USER) return false;
  const page = path.startsWith('/console/') ? path.split('/')[2] : '';
  if (page === 'setting') return user.role >= ROLE.SUPER_ADMIN;
  if (adminPages.has(page) && user.role < ROLE.ADMIN) return false;
  if (page === 'channel' && !hasPermission(user, 'channel', 'read')) return false;
  return true;
}
