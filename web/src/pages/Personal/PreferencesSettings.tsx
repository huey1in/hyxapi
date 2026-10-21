import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { Button, Select, Switch } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import type { AuthUser } from '../../stores/auth-store';
import { interfaceLanguages, normalizeLanguage } from '../../i18n/language';
import { parsePersonalSettings } from './personal-settings';
import type { RefreshProfile } from './personal-settings';
import { SettingGroup, SettingRow } from './ProfileSettingsLayout';

export function LanguagePreference({ refresh }: { refresh: RefreshProfile }) {
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const language = (value: string) => void run(async (signal) => {
    const { data } = await API.put('/api/user/self', { language: value }, { signal, skipErrorHandler: true });
    if (!data.success) throw new Error(data.message || 'Unable to save preferences');
    signal.throwIfAborted(); await i18n.changeLanguage(value); signal.throwIfAborted(); await refresh(signal);
  });
  return <SettingGroup title={t('Preferences')}>
    <SettingRow title={t('Language')} description={t('Interface language')} last><Select aria-label={t('Language')} value={normalizeLanguage(i18n.language) || 'en'} options={[...interfaceLanguages]} onChange={language} width={160} disabled={busy} /></SettingRow>
  </SettingGroup>;
}

export default function UsagePreferences({ user, refresh }: { user: AuthUser; refresh: RefreshProfile }) {
  const { t } = useTranslation();
  const initial = parsePersonalSettings(user.setting);
  const [recordIP, setRecordIP] = useState(initial.record_ip_log);
  const [acceptUnset, setAcceptUnset] = useState(initial.accept_unset_model_ratio_model);
  const { busy, run } = useOwnedOperation();
  const save = () => void run(async (signal) => {
    const { data } = await API.put('/api/user/setting', { record_ip_log: recordIP, accept_unset_model_ratio_model: acceptUnset }, { signal, skipErrorHandler: true });
    if (!data.success) throw new Error(data.message || 'Unable to save preferences');
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Settings updated successfully'));
  });
  return <SettingGroup title={t('Usage preferences')}>
    <SettingRow title={t('Record IP Address')} description={t('Log IP address for usage and error logs')}><Switch aria-label={t('Record IP Address')} checked={recordIP} onChange={setRecordIP} disabled={busy} /></SettingRow>
    <SettingRow title={t('Allow models without a configured price')} description={t('Allow requests to models whose price has not been configured')}><Switch aria-label={t('Allow models without a configured price')} checked={acceptUnset} onChange={setAcceptUnset} disabled={busy} /></SettingRow>
    <SettingRow title={t('Save preferences')} last><Button onClick={save} loading={busy}>{t('Save')}</Button></SettingRow>
  </SettingGroup>;
}
