import { useContext } from 'react';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { Button, IconButton, Skeleton } from '../../components/ui';
import { renderQuota } from '../../helpers';
import type { WalletProfile } from './wallet-data';
import { StatusContext } from '../../context/Status';
import { DailyCheckinSkeleton } from './DailyCheckin';

export function TopUpPage({ children, pending = false }: PropsWithChildren<{ pending?: boolean }>) {
  const { t } = useTranslation();
  return <div className='console-content-page'>
    <ConsolePageHeader title={t('充值')} actions={pending && <div role='status' aria-label={t('Loading...')} aria-busy='true' className='flex h-10 items-center'>
      <Skeleton width={72} height={3} rounded='rounded-full' />
    </div>} />
    {children}
  </div>;
}

export function WalletBalanceCard({ user, pending = false, onHistory }: { user?: WalletProfile; pending?: boolean; onHistory?: () => void }) {
  const { t } = useTranslation();
  return <div data-wallet-balance aria-busy={pending || undefined} data-loading-skeleton={pending ? 'cards' : undefined} className='flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-ui-border px-5 py-[26px]'>
    <div>
      <div className='mb-1.5 text-[13px] text-ui-text-3'>{t('Current balance')}</div>
      <div className='flex h-[42px] items-center text-[28px] font-bold text-ui-text'>{pending ? <Skeleton width={140} height={28} /> : user ? renderQuota(user.quota) : '—'}</div>
      <div className='mt-1 flex h-4 items-center text-xs text-ui-text-3'>{pending ? <Skeleton width={140} height={12} /> : t('Total used: {{amount}}', { amount: user ? renderQuota(user.used_quota) : '—' })}</div>
    </div>
    <Button size='sm' variant='secondary' disabled={!onHistory} onClick={onHistory}>{t('Top-up history')}</Button>
  </div>;
}

type InvitationRewardsProps = PropsWithChildren<{
  user?: WalletProfile;
  pending?: boolean;
  link?: string;
  linkPending?: boolean;
  transferDisabled?: boolean;
  onTransfer?: () => void;
  onCopy?: () => void;
}>;

export function InvitationRewards({ user, pending = false, link = '', linkPending = false, transferDisabled = true, onTransfer, onCopy, children }: InvitationRewardsProps) {
  const { t } = useTranslation();
  return <section data-wallet-invitations aria-busy={pending || linkPending || undefined} data-loading-skeleton={pending || linkPending ? 'cards' : undefined} className='flex flex-col gap-3'>
    <h2 className='text-lg font-semibold text-ui-text'>{t('Invitation rewards')}</h2>
    <div className='grid grid-cols-2 gap-3'>
      {[
        { label: 'Invited users', value: user?.aff_count ?? '—' },
        { label: 'Total rewards', value: user ? renderQuota(user.aff_history_quota) : '—' },
      ].map(({ label, value }) => <div key={label} className='rounded-2xl border border-ui-border px-[18px] py-4'>
        <div className='mb-1.5 text-xs text-ui-text-3'>{t(label)}</div>
        <div className='flex h-[33px] items-center text-[22px] font-semibold text-ui-text'>{pending ? <Skeleton width={72} height={22} /> : value}</div>
      </div>)}
    </div>
    <div className='flex flex-wrap items-center justify-between gap-2 text-sm text-ui-text-2'>
      <div className='flex min-h-5 items-center'>{pending ? <Skeleton width={168} height={14} /> : t('Available rewards: {{amount}}', { amount: user ? renderQuota(user.aff_quota) : '—' })}</div>
      <Button size='sm' variant='secondary' disabled={pending || transferDisabled} onClick={onTransfer}>{t('Transfer to balance')}</Button>
    </div>
    {(linkPending || link) && <div data-wallet-link className='flex min-w-0 items-center gap-2 rounded-[26px] border border-ui-border px-3.5 py-2.5'>
      <span className='min-w-0 flex-1 truncate text-[13px] font-medium tracking-wide text-ui-text'>{linkPending ? <Skeleton width='75%' height={14} /> : link}</span>
      <IconButton icon={Copy} aria-label={t('Copy invitation link')} disabled={linkPending || !onCopy} onClick={onCopy} />
    </div>}
    {children}
  </section>;
}

export function TopUpSkeleton() {
  const [{ status }] = useContext(StatusContext);
  return <TopUpPage pending>
    <WalletBalanceCard pending />
    {status?.checkin_enabled === true && <DailyCheckinSkeleton />}
    {status?.invitation_rewards_enabled === true && <InvitationRewards pending linkPending />}
  </TopUpPage>;
}
