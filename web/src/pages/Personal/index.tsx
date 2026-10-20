import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, Loading } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import type { AuthUser } from '../../stores/auth-store';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import useIsMobile from '../../hooks/useIsMobile';
import AccountSettings from './AccountSettings';
import SecuritySettings from './SecuritySettings';
import NotificationSettings, { PersonalPreferences } from './NotificationSettings';
import { parsePersonalSettings } from './personal-settings';
import type { RefreshProfile } from './personal-settings';
import CheckinCalendar from './CheckinCalendar';
import SidebarSettings from './SidebarSettings';
import LoginSessions from './LoginSessions';
import AccessTokens from './AccessTokens';
import AccountBindings from './AccountBindings';

function PersonalProfile({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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
  if (profile.isPending) return <Loading />;
  if (profile.error) return <div role='alert' className='p-6 text-sm'>{t(apiErrorMessage(profile.error, 'Unable to load profile'))} <Button onClick={() => void profile.refetch()} loading={profile.isFetching}>{t('Retry')}</Button></div>;
  if (!ready) return <Loading />;
  if (!user || !profile.data) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 720, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
    <AccountSettings user={user} refresh={refresh} />
    <SecuritySettings identity={identity} refresh={refresh} />
    <LoginSessions />
    <AccessTokens />
    <AccountBindings />
    <CheckinCalendar />
    <SidebarSettings />
    <NotificationSettings user={user} refresh={refresh} />
    <PersonalPreferences user={user} refresh={refresh} />
  </div>;
}

export default function Personal() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <PersonalProfile key={identity} identity={identity} />;
}
