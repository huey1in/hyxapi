import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import type { AuthUser } from '../../stores/auth-store';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import { PersonalSkeleton } from '../../components/layout/PageSkeletons';
import AccountSettings, { AccountActions } from './AccountSettings';
import BillingSettings from './BillingSettings';
import SecuritySettings from './SecuritySettings';
import NotificationSettings from './NotificationSettings';
import UsagePreferences, { LanguagePreference } from './PreferencesSettings';
import { parsePersonalSettings } from './personal-settings';
import type { RefreshProfile } from './personal-settings';
import LoginSessions from './LoginSessions';
import AccessTokens from './AccessTokens';
import AccountBindings from './AccountBindings';
import { PersonalSettingsHeader } from './ProfileSettingsLayout';
import { personalSettingsTab } from './personal-navigation';
import type { PersonalSettingsTab } from './personal-navigation';
import { useSettingsAutosave } from './useSettingsAutosave';

function PersonalProfile({ identity, tab, onChange }: { identity: string; tab: PersonalSettingsTab; onChange: (tab: PersonalSettingsTab) => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [ready, setReady] = useState(false);
  const profile = useQuery({
    queryKey: ['personal-profile', identity],
    queryFn: async ({ signal }) => {
      const result = await authResult<AuthUser>(API.get('/api/user/self', { signal, disableDuplicate: true, skipErrorHandler: true }));
      parsePersonalSettings(result.setting); return result;
    }, gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  useEffect(() => { if (profile.data) { useAuthStore.getState().auth.setUser(profile.data); setReady(true); } }, [profile.data]);
  const refresh: RefreshProfile = async (signal) => {
    const result = await authResult<AuthUser>(API.get('/api/user/self', { signal, disableDuplicate: true, skipErrorHandler: true }));
    signal.throwIfAborted(); useAuthStore.getState().auth.setUser(result);
  };
  if (profile.isPending) return <PersonalSkeleton tab={tab} onChange={onChange} />;
  if (profile.error) return <div className='console-content-page personal-settings-page'><PersonalSettingsHeader tab={tab} onChange={onChange} /><div role='alert' className='text-sm'>{t(apiErrorMessage(profile.error, 'Unable to load profile'))} <Button onClick={() => void profile.refetch()} loading={profile.isFetching}>{t('Retry')}</Button></div></div>;
  if (!ready) return <PersonalSkeleton tab={tab} onChange={onChange} />;
  if (!user || !profile.data) return null;
  return <PersonalSettings key={`${identity}:${user.role}`} identity={identity} user={user} refresh={refresh} tab={tab} onChange={onChange} />;
}

function PersonalSettings({ identity, user, refresh, tab, onChange }: { identity: string; user: AuthUser; refresh: RefreshProfile; tab: PersonalSettingsTab; onChange: (tab: PersonalSettingsTab) => void }) {
  const preferences = useSettingsAutosave(user, refresh);
  return <div className='console-content-page personal-settings-page'>
    <PersonalSettingsHeader tab={tab} onChange={onChange} />
    <div key={tab} data-settings-panel={tab} className='flex min-w-0 flex-col gap-6'>
      {tab === 'account' && <><AccountSettings user={user} refresh={refresh} /><AccountBindings /><LanguagePreference refresh={refresh} /><AccountActions user={user} /></>}
      {tab === 'security' && <><SecuritySettings identity={identity} user={user} refresh={refresh} /><LoginSessions /><AccessTokens /></>}
      {tab === 'usage' && <><BillingSettings /><UsagePreferences preferences={preferences} /></>}
      {tab === 'notifications' && <NotificationSettings user={user} preferences={preferences} refresh={refresh} />}
    </div>
  </div>;
}

export default function Personal() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  const location = useLocation();
  const navigate = useNavigate();
  const tab = personalSettingsTab(location.search);
  const changeTab = (value: PersonalSettingsTab) => {
    const params = new URLSearchParams(location.search);
    if (value === 'account') params.delete('tab');
    else params.set('tab', value);
    void navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash });
  };
  return <PersonalProfile key={identity} identity={identity} tab={tab} onChange={changeTab} />;
}
