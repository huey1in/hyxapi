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
  notification_email: z.string().catch(''), notification_email_verified: z.boolean().catch(false), webhook_url: z.string().catch(''), webhook_secret: z.string().catch(''),
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
export type NotificationForm = Omit<ReturnType<typeof notificationForm>, 'quota_warning_threshold' | 'gotify_priority'> & {
  quota_warning_threshold: number | string;
  gotify_priority: number | string;
};
export type PreferenceField = keyof NotificationForm;
export type PreferenceErrors = Partial<Record<PreferenceField, string>>;
export type PreferencePatch = Partial<Record<PreferenceField, string | number | boolean>>;

export function personalSettingsChanges(form: NotificationForm, saved: NotificationForm, role: number, retryFields: ReadonlySet<PreferenceField> = new Set()) {
  const patch: PreferencePatch = {};
  const errors: PreferenceErrors = {};
  const changed = (key: PreferenceField) => form[key] !== saved[key] || retryFields.has(key);
  for (const key of ['record_ip_log', 'accept_unset_model_ratio_model', 'quota_warning_enabled', ...(role >= 10 ? ['channel_notify_enabled', 'upstream_model_update_notify_enabled'] as const : [])] as const) {
    if (changed(key)) patch[key] = form[key];
  }
  if (changed('quota_warning_threshold')) {
    const value = Number(form.quota_warning_threshold);
    if (String(form.quota_warning_threshold).trim() === '' || !Number.isFinite(value) || value < 0) errors.quota_warning_threshold = 'Reminder threshold cannot be negative';
    else patch.quota_warning_threshold = displayAmountToQuota(value);
  }
  const delivery: PreferenceField[] = form.notify_type === 'email' ? []
    : form.notify_type === 'webhook' ? ['webhook_url', 'webhook_secret']
      : form.notify_type === 'bark' ? ['bark_url'] : ['gotify_url', 'gotify_token', 'gotify_priority'];
  const methodChanged = changed('notify_type');
  const deliveryPatch: PreferencePatch = {};
  for (const key of delivery) {
    if (!methodChanged && !changed(key)) continue;
    const value = form[key];
    if (key.endsWith('_url')) {
      try { const url = new URL(String(value)); if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error(); }
      catch { errors[key] = 'Notification URL must use http or https'; }
    } else if (key === 'gotify_token' && !String(value).trim()) errors[key] = 'Gotify token cannot be empty';
    else if (key === 'gotify_priority' && (String(value).trim() === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 10)) errors[key] = 'Gotify priority must be between 0 and 10';
    if (!errors[key]) deliveryPatch[key] = key === 'gotify_priority' ? Number(value) : value;
  }
  if (!methodChanged || !delivery.some((key) => errors[key])) {
    Object.assign(patch, deliveryPatch);
    if (methodChanged) patch.notify_type = form.notify_type;
  }
  return { patch, errors };
}
