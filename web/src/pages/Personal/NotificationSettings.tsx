import { useTranslation } from 'react-i18next';
import { getCurrencyConfig } from '../../helpers';
import { Input, Select, Switch } from '../../components/ui';
import type { AuthUser } from '../../stores/auth-store';
import type { NotificationForm, PreferenceField } from './personal-settings';
import type { SettingsAutosave } from './useSettingsAutosave';
import { SettingGroup, SettingRow } from './ProfileSettingsLayout';

export default function NotificationSettings({ user, preferences }: { user: AuthUser; preferences: SettingsAutosave }) {
  const { t } = useTranslation();
  const { form, set, flush, errors } = preferences;
  const currency = getCurrencyConfig();
  const error = (key: PreferenceField) => errors[key] ? <p id={`preference-error-${key}`} className='mt-1 text-xs text-ui-danger'>{t(errors[key])}</p> : null;
  const inputProps = (key: PreferenceField) => ({ invalid: !!errors[key], 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `preference-error-${key}` : undefined, onBlur: () => { void flush(); } });
  const fields: { key: 'notification_email' | 'webhook_url' | 'webhook_secret' | 'bark_url' | 'gotify_url' | 'gotify_token'; label: string; secret?: boolean }[] = form.notify_type === 'email'
    ? [{ key: 'notification_email', label: 'Notification Email' }]
    : form.notify_type === 'webhook' ? [{ key: 'webhook_url', label: 'Webhook URL' }, { key: 'webhook_secret', label: 'Webhook Secret', secret: true }]
      : form.notify_type === 'bark' ? [{ key: 'bark_url', label: 'Bark URL' }] : [{ key: 'gotify_url', label: 'Gotify URL' }, { key: 'gotify_token', label: 'Gotify Token', secret: true }];
  return <div className='min-w-0 space-y-2'>
    <SettingGroup title={t('Notifications')}>
      <SettingRow title={t('Quota warning')} description={t('Notify once when the balance falls below the threshold; recharging enables the next reminder')}>
        <Switch aria-label={t('Quota warning')} checked={form.quota_warning_enabled} onChange={(value) => set('quota_warning_enabled', value)} />
      </SettingRow>
      {form.quota_warning_enabled && <SettingRow title={t('Reminder threshold')} description={t('Use the display currency; zero uses the system default')}>
        <div className='w-32'><Input {...inputProps('quota_warning_threshold')} aria-label={t('Reminder threshold')} type='number' min={0} step='any' value={form.quota_warning_threshold} prefix={currency.type === 'TOKENS' ? undefined : currency.symbol} onChange={(value) => set('quota_warning_threshold', value, 600)} width='full' />{error('quota_warning_threshold')}</div>
      </SettingRow>}
      {user.role >= 10 && <>
        <SettingRow title={t('Channel notifications')} description={t('Receive automatic channel status changes and batch test results')}><Switch aria-label={t('Channel notifications')} checked={form.channel_notify_enabled} onChange={(value) => set('channel_notify_enabled', value)} /></SettingRow>
        <SettingRow title={t('Upstream model updates')} description={t('Receive model changes discovered by scheduled checks')}><Switch aria-label={t('Upstream model updates')} checked={form.upstream_model_update_notify_enabled} onChange={(value) => set('upstream_model_update_notify_enabled', value)} /></SettingRow>
      </>}
      <SettingRow title={t('Notification Method')} description={t('Applies to all enabled notification categories')}>
        <Select popover aria-label={t('Notification Method')} value={form.notify_type} onChange={(value) => set('notify_type', value as NotificationForm['notify_type'])} options={['email', 'webhook', 'bark', 'gotify'].map((value) => ({ value, label: value === 'email' ? t('Email') : value === 'webhook' ? 'Webhook' : value === 'bark' ? 'Bark' : 'Gotify' }))} />
      </SettingRow>
      {fields.map((field, index) => <SettingRow key={field.key} title={t(field.label)} last={index === fields.length - 1 && form.notify_type !== 'gotify'}><div className='w-[min(220px,48vw)]'><Input {...inputProps(field.key)} aria-label={t(field.label)} type={field.secret ? 'password' : field.key === 'notification_email' ? 'email' : 'url'} value={form[field.key]} placeholder={field.key === 'notification_email' ? user.email || t('Leave blank to use the account email') : undefined} onChange={(value) => set(field.key, value, 600)} width='full' />{error(field.key)}</div></SettingRow>)}
      {form.notify_type === 'gotify' && <SettingRow title={t('Message Priority')} description={t('Priority level from 0 (lowest) to 10 (highest), default is 5')} last><div className='w-24'><Input {...inputProps('gotify_priority')} aria-label={t('Message Priority')} type='number' min={0} max={10} value={form.gotify_priority} onChange={(value) => set('gotify_priority', value, 600)} width='full' />{error('gotify_priority')}</div></SettingRow>}
    </SettingGroup>
    <p className='px-0.5 text-xs text-ui-text-3'>{t('Verification and password reset emails are always sent')}</p>
  </div>;
}
