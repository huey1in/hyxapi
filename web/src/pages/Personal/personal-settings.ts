import { z } from 'zod';
import { displayAmountToQuota, quotaToDisplayAmount } from '../../helpers/quota';
import type { AuthUser } from '../../stores/auth-store';

export type RefreshProfile = (signal: AbortSignal) => Promise<void>;
export function passwordPayload(hasPassword: boolean, form: { original: string; password: string; confirmation: string }) {
  const length = [...form.password].length;
  if (length < 8 || length > 128) throw new Error('Password must contain between 8 and 128 characters.');
  if (form.password !== form.confirmation) throw new Error('Passwords do not match');
  if (hasPassword && !form.original) throw new Error('Enter your current password');
  if (hasPassword && form.original === form.password) throw new Error('New password must be different from current password');
  return { password: form.password, ...(hasPassword ? { original_password: form.original } : {}) };
}
const settingsSchema = z.object({
  notify_type: z.enum(['email', 'webhook', 'bark', 'gotify']).catch('email'),
  quota_warning_enabled: z.boolean().catch(true), quota_warning_threshold: z.number().catch(0),
  notification_email: z.string().catch(''), webhook_url: z.string().catch(''), webhook_secret: z.string().catch(''),
  bark_url: z.string().catch(''), gotify_url: z.string().catch(''), gotify_token: z.string().catch(''), gotify_priority: z.number().int().min(0).max(10).catch(5),
  channel_notify_enabled: z.boolean().optional(), upstream_model_update_notify_enabled: z.boolean().catch(false),
  record_ip_log: z.boolean().catch(false), accept_unset_model_ratio_model: z.boolean().catch(false),
});
export function parsePersonalSettings(value: AuthUser['setting']) {
  return settingsSchema.parse(typeof value === 'string' ? JSON.parse(value || '{}') : value ?? {});
}
export function notificationForm(user: AuthUser) {
  const settings = parsePersonalSettings(user.setting);
  return { ...settings, quota_warning_threshold: quotaToDisplayAmount(settings.quota_warning_threshold), channel_notify_enabled: settings.channel_notify_enabled ?? user.role >= 100 };
}
export type NotificationForm = ReturnType<typeof notificationForm>;
export function notificationPayload(form: NotificationForm, role: number) {
  if (!Number.isFinite(Number(form.quota_warning_threshold)) || Number(form.quota_warning_threshold) < 0) throw new Error('Reminder threshold cannot be negative');
  const { notify_type, notification_email, webhook_url, webhook_secret, bark_url, gotify_url, gotify_token, gotify_priority, quota_warning_enabled } = form;
  return { notify_type, notification_email, webhook_url, webhook_secret, bark_url, gotify_url, gotify_token, gotify_priority, quota_warning_enabled,
    quota_warning_threshold: displayAmountToQuota(form.quota_warning_threshold),
    ...(role >= 10 ? { channel_notify_enabled: form.channel_notify_enabled, upstream_model_update_notify_enabled: form.upstream_model_update_notify_enabled } : {}),
  };
}
