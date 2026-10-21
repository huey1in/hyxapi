import { useTranslation } from 'react-i18next';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useLogout } from '../../hooks/useLogout';
import { cn } from '../ui/tokens';
import Skeleton from '../ui/feedback/Skeleton';

export default function SidebarLogoutButton({ compact = false, loading = false, className, iconSize = 22 }: { compact?: boolean; loading?: boolean; className?: string; iconSize?: number }) {
  const { t } = useTranslation();
  const signedIn = useAuthStore((state) => Boolean(state.auth.user));
  const { busy, logout } = useLogout();
  if (!signedIn && !loading) return null;

  return <div aria-busy={loading || busy} className={cn('console-sidebar-logout mb-2 shrink-0', compact ? 'mx-1.5' : 'mx-[10px]')}>
    {loading ? <div role='status' aria-label={t('Loading...')} className={cn(className, 'justify-center')}>
      <Skeleton width={iconSize} height={iconSize} className='shrink-0' />
      {!compact && <Skeleton width={65} height={16} />}
    </div> : <button type='button' onClick={logout} disabled={busy} aria-label={t('Sign out')} title={t('Sign out')} className={cn(className, 'w-full justify-center text-center text-ui-text transition-[background-color,box-shadow] motion-reduce:transition-none enabled:hover:bg-ui-bg-subtle enabled:hover:shadow-sm enabled:focus:bg-ui-bg-subtle enabled:focus:shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50')}>
        {busy ? <LoaderCircle aria-hidden='true' size={iconSize} className='shrink-0 animate-spin motion-reduce:animate-none' /> : <LogOut aria-hidden='true' size={iconSize} className='shrink-0' />}
        {!compact && <span className='min-w-0 truncate'>{t('Sign out')}</span>}
      </button>
    }
  </div>;
}
