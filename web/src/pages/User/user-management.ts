import { z } from 'zod';
import { apiErrorMessage } from '../../lib/api-error';
import type { AdminPermissionMatrix, PermissionCatalog } from '../../lib/admin-permissions';
import { normalizeAdminPermissions } from '../../lib/admin-permissions';

const text = z.string().nullish().transform((value) => value ?? '');
export const managedUserSchema = z.object({
  id: z.number().int().positive(), username: z.string(), display_name: text,
  email: text, role: z.number().int(), status: z.number().int(), group: text,
  quota: z.number(), used_quota: z.number().default(0),
  aff_count: z.number().default(0), aff_quota: z.number().default(0),
  created_at: z.number().default(0), last_login_at: z.number().default(0), remark: text,
  DeletedAt: z.string().nullish(), github_id: text, google_id: text, discord_id: text, oidc_id: text,
  wechat_id: text, telegram_id: text, linux_do_id: text,
  admin_permissions: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
});
export const userPageSchema = z.object({ items: z.array(managedUserSchema), total: z.number().int().nonnegative() });
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type UserFilters = { keyword: string; group: string; role: string; status: string };
export type UserSort = 'id' | 'username' | 'quota' | 'group' | 'created_at' | 'last_login_at';
export type UserAction = 'enable' | 'disable' | 'delete';
export type UserForm = { username: string; display_name: string; password: string; role: number; group: string; remark: string; admin_permissions?: AdminPermissionMatrix };

export function canManageUser(actorRole: number, user: Pick<ManagedUser, 'role' | 'DeletedAt'>): boolean {
  return !user.DeletedAt && (actorRole === 100 || actorRole > user.role);
}

export function userUpdatePayload(form: UserForm, original: ManagedUser | null, catalog?: PermissionCatalog) {
  const role = form.role;
  const payload: { username: string; display_name: string; password?: string; id?: number; role?: number; group?: string; remark?: string; admin_permissions?: AdminPermissionMatrix } = {
    username: form.username.trim(), display_name: form.display_name || form.username.trim(),
  };
  if (form.password) payload.password = form.password;
  if (original) { payload.id = original.id; payload.group = form.group; payload.remark = form.remark; }
  if (!original || role !== original.role) payload.role = role;
  if (role === 10 && catalog?.resources.length && form.admin_permissions) {
    const permissions = normalizeAdminPermissions(form.admin_permissions, catalog);
    if (!original || role !== original.role || JSON.stringify(permissions) !== JSON.stringify(normalizeAdminPermissions(original.admin_permissions, catalog))) payload.admin_permissions = permissions;
  }
  return payload;
}

export function userErrorMessage(error: unknown): string { return apiErrorMessage(error, 'Unable to manage users'); }
