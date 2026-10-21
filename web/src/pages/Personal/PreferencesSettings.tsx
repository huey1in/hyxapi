import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Select, Switch } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { interfaceLanguages, normalizeLanguage } from '../../i18n/language';
import type { RefreshProfile } from './personal-settings';
import type { SettingsAutosave } from './useSettingsAutosave';
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
    <SettingRow title={t('Language')} description={t('Interface language')} last><Select popover aria-label={t('Language')} value={normalizeLanguage(i18n.language) || 'en'} options={[...interfaceLanguages]} onChange={language} width={160} disabled={busy} /></SettingRow>
  </SettingGroup>;
}

export default function UsagePreferences({ preferences }: { preferences: SettingsAutosave }) {
  const { t } = useTranslation();
  const { form, set } = preferences;
  return <SettingGroup title={t('Usage preferences')}>
    <SettingRow title={t('Record IP Address')} description={t('Log IP address for usage and error logs')}><Switch aria-label={t('Record IP Address')} checked={form.record_ip_log} onChange={(value) => set('record_ip_log', value)} /></SettingRow>
    <SettingRow title={t('Allow models without a configured price')} description={t('Allow requests to models whose price has not been configured')} last><Switch aria-label={t('Allow models without a configured price')} checked={form.accept_unset_model_ratio_model} onChange={(value) => set('accept_unset_model_ratio_model', value)} /></SettingRow>
  </SettingGroup>;
}
