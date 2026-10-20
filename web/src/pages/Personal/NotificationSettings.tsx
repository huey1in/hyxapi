import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, getCurrencyConfig, showSuccess } from '../../helpers';
import { Button, Input, Select, Switch } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import type { AuthUser } from '../../stores/auth-store';
import { notificationForm, notificationPayload, parsePersonalSettings } from './personal-settings';
import type { NotificationForm, RefreshProfile } from './personal-settings';
import { SettingGroup, SettingRow } from './ProfileSettingsLayout';
import { interfaceLanguages, normalizeLanguage } from '../../i18n/language';

export default function NotificationSettings({ user, refresh }: { user: AuthUser; refresh: RefreshProfile }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => notificationForm(user));
  const { busy, run } = useOwnedOperation();
  const currency = getCurrencyConfig();
  const set = <K extends keyof NotificationForm>(key: K, value: NotificationForm[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = () => void run(async (signal) => {
    const { data } = await API.put('/api/user/setting', notificationPayload(form, user.role), { signal, skipErrorHandler: true });
    if (!data.success) throw new Error(data.message || 'Unable to save notification settings');
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Notification settings saved'));
  });
  const fields: { key: 'notification_email' | 'webhook_url' | 'webhook_secret' | 'bark_url' | 'gotify_url' | 'gotify_token'; label: string; secret?: boolean }[] = form.notify_type === 'email'
    ? [{ key: 'notification_email', label: 'Notification Email' }]
    : form.notify_type === 'webhook' ? [{ key: 'webhook_url', label: 'Webhook URL' }, { key: 'webhook_secret', label: 'Webhook Secret', secret: true }]
      : form.notify_type === 'bark' ? [{ key: 'bark_url', label: 'Bark URL' }] : [{ key: 'gotify_url', label: 'Gotify URL' }, { key: 'gotify_token', label: 'Gotify Token', secret: true }];
  return <fieldset disabled={busy} className='m-0 min-w-0 border-0 p-0'>
    <SettingGroup title={t('Notifications')}>
      <SettingRow title={t('Quota warning')} description={t('Notify once when the balance falls below the threshold; recharging enables the next reminder')}>
        <Switch aria-label={t('Quota warning')} checked={form.quota_warning_enabled} onChange={(value) => set('quota_warning_enabled', value)} />
      </SettingRow>
      {form.quota_warning_enabled && <SettingRow title={t('Reminder threshold')} description={t('Use the display currency; zero uses the system default')}>
        <div className='w-32'><Input aria-label={t('Reminder threshold')} type='number' min={0} step='any' value={form.quota_warning_threshold} prefix={currency.type === 'TOKENS' ? undefined : currency.symbol} onChange={(value) => set('quota_warning_threshold', value === '' ? 0 : Number(value))} width='full' /></div>
      </SettingRow>}
      {user.role >= 10 && <>
        <SettingRow title={t('Channel notifications')} description={t('Receive automatic channel status changes and batch test results')}><Switch aria-label={t('Channel notifications')} checked={form.channel_notify_enabled} onChange={(value) => set('channel_notify_enabled', value)} /></SettingRow>
        <SettingRow title={t('Upstream model updates')} description={t('Receive model changes discovered by scheduled checks')}><Switch aria-label={t('Upstream model updates')} checked={form.upstream_model_update_notify_enabled} onChange={(value) => set('upstream_model_update_notify_enabled', value)} /></SettingRow>
      </>}
      <SettingRow title={t('Notification Method')} description={t('Applies to all enabled notification categories')}>
        <Select aria-label={t('Notification Method')} value={form.notify_type} onChange={(value) => set('notify_type', value as NotificationForm['notify_type'])} options={['email', 'webhook', 'bark', 'gotify'].map((value) => ({ value, label: value === 'email' ? t('Email') : value === 'webhook' ? 'Webhook' : value === 'bark' ? 'Bark' : 'Gotify' }))} />
      </SettingRow>
      {fields.map((field) => <SettingRow key={field.key} title={t(field.label)}><Input aria-label={t(field.label)} type={field.secret ? 'password' : 'text'} value={form[field.key]} placeholder={field.key === 'notification_email' ? user.email || t('Leave blank to use the account email') : undefined} onChange={(value) => set(field.key, value)} /></SettingRow>)}
      {form.notify_type === 'gotify' && <SettingRow title={t('Message Priority')} description={t('Priority level from 0 (lowest) to 10 (highest), default is 5')}><div className='w-24'><Input aria-label={t('Message Priority')} type='number' min={0} max={10} value={form.gotify_priority} onChange={(value) => set('gotify_priority', Number(value))} width='full' /></div></SettingRow>}
      <SettingRow title={t('Save notification settings')} description={t('Verification and password reset emails are always sent')} last><Button onClick={save} loading={busy}>{t('Save')}</Button></SettingRow>
    </SettingGroup>
  </fieldset>;
}

export function PersonalPreferences({ user, refresh }: { user: AuthUser; refresh: RefreshProfile }) {
  const { t, i18n } = useTranslation();
  const initial = parsePersonalSettings(user.setting);
  const [recordIP, setRecordIP] = useState(initial.record_ip_log);
  const [acceptUnset, setAcceptUnset] = useState(initial.accept_unset_model_ratio_model);
  const { busy, run } = useOwnedOperation();
  const save = () => void run(async (signal) => {
    const { data } = await API.put('/api/user/setting', { record_ip_log: recordIP, accept_unset_model_ratio_model: acceptUnset }, { signal, skipErrorHandler: true });
    if (!data.success) throw new Error(data.message || 'Unable to save preferences');
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Settings updated successfully'));
  });
  const language = (value: string) => void run(async (signal) => {
    const { data } = await API.put('/api/user/self', { language: value }, { signal, skipErrorHandler: true });
    if (!data.success) throw new Error(data.message || 'Unable to save preferences');
    signal.throwIfAborted(); await i18n.changeLanguage(value); signal.throwIfAborted(); await refresh(signal);
  });
  return <SettingGroup title={t('Preferences')}>
    <SettingRow title={t('Language')} description={t('Interface language')}><Select aria-label={t('Language')} value={normalizeLanguage(i18n.language) || 'en'} options={[...interfaceLanguages]} onChange={language} width={160} disabled={busy} /></SettingRow>
    <SettingRow title={t('Record IP Address')} description={t('Log IP address for usage and error logs')}><Switch aria-label={t('Record IP Address')} checked={recordIP} onChange={setRecordIP} disabled={busy} /></SettingRow>
    <SettingRow title={t('Allow models without a configured price')} description={t('Allow requests to models whose price has not been configured')}><Switch aria-label={t('Allow models without a configured price')} checked={acceptUnset} onChange={setAcceptUnset} disabled={busy} /></SettingRow>
    <SettingRow title={t('Save preferences')} last><Button onClick={save} loading={busy}>{t('Save')}</Button></SettingRow>
  </SettingGroup>;
}
