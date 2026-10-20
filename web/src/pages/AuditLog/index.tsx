import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import { useAuthStore } from '../../stores/auth-store';
import type { AuthUser } from '../../stores/auth-store';
import type { ApiEnvelope } from '../../types/api';
import { hasPermission } from '../../lib/admin-permissions';
import type { AuditScope } from '../../features/audit/types';
import AuditViewer from '../../features/audit/AuditViewer';

function AuditPage({ user, identity }: { user: AuthUser; identity: string }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const client = useQueryClient();
  const [scope, setScope] = useState<AuditScope>('all');
  const [revoked, setRevoked] = useState(false);
  const owner = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); owner.current = controller; return () => { controller.abort(); owner.current = null; }; }, []);
  const canReadAll = user.role >= 10 && hasPermission(user, 'audit', 'read');
  const effectiveScope = canReadAll && !revoked ? scope : 'self';
  const onDenied = useCallback(() => {
    setRevoked(true); setScope('self');
    const current = useAuthStore.getState().auth;
    if (`${current.user?.id}:${current.session?.sid}` !== identity || !current.user) return;
    current.setUser({ ...current.user, permissions: { ...current.user.permissions, admin_permissions: { ...current.user.permissions?.admin_permissions, audit: { read: false } } } });
    void client.cancelQueries({ queryKey: ['audit-records', identity, 'all'] }).then(() => client.removeQueries({ queryKey: ['audit-records', identity, 'all'] }));
    const signal = owner.current?.signal;
    if (!signal || signal.aborted) return;
    void API.get<ApiEnvelope<AuthUser>>('/api/user/self', { signal, skipErrorHandler: true, disableDuplicate: true }).then((response) => {
      const latest = useAuthStore.getState().auth;
      if (!signal.aborted && response.data.success && response.data.data?.id === user.id && `${latest.user?.id}:${latest.session?.sid}` === identity && latest.user) latest.setUser({ ...latest.user, role: response.data.data.role, permissions: response.data.data.permissions });
    }).catch(() => { /* Keep the denied scope closed if capability refresh fails. */ });
  }, [client, identity, user.id]);
  return <div style={{ width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }} className='space-y-5'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t('Audit Logs')}</h1>
      {canReadAll && !revoked && <div role='group' aria-label={t('View scope')} className='flex gap-2'><Button variant='toggle' size='sm' selected={scope === 'all'} onClick={() => setScope('all')}>{t('All')}</Button><Button variant='toggle' size='sm' selected={scope === 'self'} onClick={() => setScope('self')}>{t('Only Mine')}</Button></div>}
    </div>
    {revoked && <p role='status' className='text-sm text-ui-text-2'>{t('Audit access changed. Showing only your records.')}</p>}
    <AuditViewer key={`${identity}:${effectiveScope}`} identity={identity} scope={effectiveScope} onDenied={onDenied} />
  </div>;
}

export default function AuditLogPage() {
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const identity = `${user?.id}:${sid}`;
  return user ? <AuditPage key={identity} user={user} identity={identity} /> : null;
}
