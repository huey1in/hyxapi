import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useLogout } from '../../hooks/useLogout';
import { useMobileSidebar } from '../../context/MobileSidebar';
import { cn } from '../ui/tokens';
import Skeleton from '../ui/feedback/Skeleton';

const previewUser = { id: 0, username: 'demo', display_name: 'Hyxware', email: '' };

export default function SidebarUserCard({ compact = false, loading = false, preview = false }: { compact?: boolean; loading?: boolean; preview?: boolean }) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((state) => state.auth.user);
  const { busy, logout } = useLogout();
  const [, setMobileOpen] = useMobileSidebar();
  const user = preview ? previewUser : currentUser;
  if (!user && !loading) return null;

  const name = user?.display_name?.trim() || user?.username || '';
  const account = user?.email || (user?.username ? `@${user.username}` : '');
  const identity = <span className='block min-w-0'>
    <span className='block truncate text-sm font-medium leading-5 text-ui-text' title={name}>{name}</span>
    <span className='block truncate text-xs leading-4 text-ui-text-3' title={account}>{account}</span>
  </span>;

  return <div role='group' aria-label={t('Account')} aria-busy={loading || busy} className={cn('console-sidebar-user-card mx-[10px] mb-2 flex shrink-0 items-center gap-2 rounded-lg', compact ? 'flex-col px-1 py-2' : 'min-h-16 p-2.5')}>
    {loading ? <>
      {!compact && <div className='min-w-0 flex-1 space-y-1'><Skeleton width={72} height={14} /><Skeleton width={90} height={12} /></div>}
      <Skeleton width={compact ? 28 : 44} height={28} className='shrink-0' />
    </> : <>
      {!compact && (preview ? <div className='min-w-0 flex-1'>{identity}</div> : <Link to='/console/personal' onClick={() => setMobileOpen(false)} aria-label={`${t('Personal Settings')} · ${name}`} className='min-w-0 flex-1 rounded-lg underline-offset-2 focus:outline-none focus-visible:underline'>{identity}</Link>)}
      <button type='button' onClick={logout} disabled={preview || busy} aria-label={t('Sign out')} title={t('Sign out')} className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs text-ui-text-2 transition-[background-color,box-shadow,color] motion-reduce:transition-none enabled:hover:bg-ui-bg-subtle enabled:hover:text-ui-text enabled:hover:shadow-sm enabled:focus:bg-ui-bg-subtle enabled:focus:shadow-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50', compact ? 'size-7' : 'h-8 px-1.5')}>
        {busy ? <LoaderCircle size={16} className='animate-spin motion-reduce:animate-none' /> : <LogOut size={16} />}
        {!compact && <span>{t('Sign out')}</span>}
      </button>
    </>}
  </div>;
}
