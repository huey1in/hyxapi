import { ProfileRowsSkeleton } from '../../components/layout/PageSkeletons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { Button, Switch } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { defaultSidebarModules, parseSidebarModules, sidebarSections } from '../../lib/sidebar-modules';
import type { SidebarModules } from '../../lib/sidebar-modules';
import type { ApiEnvelope, User } from '../../types/api';
import { SettingGroup, SettingRow } from './ProfileSettingsLayout';

function SidebarSettingsForm() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [config, setConfig] = useState<SidebarModules>(() => parseSidebarModules(user?.sidebar_modules));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { busy, run } = useOwnedOperation();
  const load = () => void run(async (signal) => {
    setError(false);
    try {
      const { data } = await API.get<ApiEnvelope<User>>('/api/user/self', { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load sidebar settings');
      setConfig(parseSidebarModules(data.data.sidebar_modules)); setLoaded(true);
    } catch (error) { if (!signal.aborted) setError(true); throw error; }
  });
  useEffect(load, []);
  const toggle = (section: string, module: string, value: boolean) => setConfig((previous) => ({ ...previous, [section]: { ...previous[section], [module]: value } }));
  const save = () => void run(async (signal) => {
    const serialized = JSON.stringify(config);
    const { data } = await API.put<ApiEnvelope<null>>('/api/user/self', { sidebar_modules: serialized }, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to save sidebar settings');
    const auth = useAuthStore.getState().auth;
    if (auth.user) auth.setUser({ ...auth.user, sidebar_modules: serialized });
    showSuccess(t('Saved successfully'));
  });
  return <SettingGroup title={t('Sidebar Personal Settings')}>
    <p className='px-4 pt-4 text-xs text-ui-text-3'>{t('Customize sidebar display content')}</p>
    {error && <div role='alert' className='p-4 text-sm text-ui-text-2'>{t('Unable to load sidebar settings')} <Button onClick={load} loading={busy}>{t('Retry')}</Button></div>}
    {!error && !loaded && <ProfileRowsSkeleton rows={sidebarSections.reduce((count, section) => count + section.modules.length + 1, 0)} lines={0} switches />}
    {loaded && sidebarSections.map((section) => <div key={section.key} className='border-b border-ui-divider'>
      <SettingRow title={t(section.title)}><Switch aria-label={t(section.title)} checked={config[section.key]?.enabled !== false} disabled={busy} onChange={(value) => toggle(section.key, 'enabled', value)} /></SettingRow>
      {section.modules.map((module, index) => <SettingRow key={module.key} title={t(module.title)} last={index === section.modules.length - 1}>
        <Switch aria-label={t(module.title)} checked={config[section.key]?.[module.key] !== false} disabled={busy || config[section.key]?.enabled === false} onChange={(value) => toggle(section.key, module.key, value)} />
      </SettingRow>)}
    </div>)}
    <div className='flex flex-wrap justify-end gap-2 p-4'>
      <Button variant='toggle' disabled={!loaded || busy} onClick={() => setConfig(defaultSidebarModules(config))}>{t('Reset to Default')}</Button>
      <Button onClick={save} loading={busy} disabled={!loaded}>{t('Save Changes')}</Button>
    </div>
  </SettingGroup>;
}

export default function SidebarSettings() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  const allowed = useAuthStore((state) => !!state.auth.user && state.auth.user.permissions?.sidebar_settings !== false);
  return allowed ? <SidebarSettingsForm key={identity} /> : null;
}
