import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import useIsMobile from '../../hooks/useIsMobile';
import ContentSkeleton from '../ui/feedback/ContentSkeleton';
import Skeleton from '../ui/feedback/Skeleton';
import Card from '../ui/card/Card';
import Divider from '../ui/display/Divider';
import Table from '../ui/layout/Table';
import { SettingGroup, SettingRow } from '../../pages/Personal/ProfileSettingsLayout';

// These frames are shared with the corresponding pages so loading uses the same
// width, padding and mobile breakpoint as the loaded content.
export function ConsolePage({ children, width = 960, gap = 28, mobileGap = 20 }: PropsWithChildren<{ width?: number; gap?: number; mobileGap?: number }>) {
  const mobile = useIsMobile();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? mobileGap : gap, width: '100%', minWidth: 0, maxWidth: width, marginInline: 'auto', padding: mobile ? '16px' : '24px 16px' }}>{children}</div>;
}

export function TokenCardFrame({ children, ...props }: PropsWithChildren<{ 'data-token-id'?: number; 'data-token-placeholder'?: boolean }>) {
  const mobile = useIsMobile();
  return <div {...props} className='group' style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, paddingBlock: mobile ? 14 : 12, paddingInline: mobile ? 14 : 18, border: '1px solid var(--ui-border)', borderRadius: 26, background: 'var(--page-bg)' }}>{children}</div>;
}

export function TokenCardsSkeleton() {
  const mobile = useIsMobile();
  return <ContentSkeleton variant='tokens'><div className='flex flex-col gap-3'>
    {[0, 1, 2].map((index) => <TokenCardFrame key={index} data-token-placeholder>
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className='flex min-h-[21px] items-center gap-1.5'><Skeleton width={13} height={13} rounded='rounded-sm' /><Skeleton width={110} height={14} /><Skeleton width={60} height={20} /></div>
        <div className={`flex h-9 items-center gap-1 ${mobile ? 'self-end' : ''}`}>{Array.from({ length: 4 }, (_, action) => <Skeleton key={action} width={36} height={36} rounded='rounded-xl' />)}</div>
      </div>
      <div className='flex flex-wrap items-center gap-2'><Skeleton width={126} height={18} /><Skeleton width={90} height={20} /><Skeleton width={56} height={20} /><Skeleton width={90} height={16} className='ml-auto' /></div>
      <Skeleton width={145} height={16} />
    </TokenCardFrame>)}
  </div></ContentSkeleton>;
}

export function PersonalSkeleton() {
  const { t } = useTranslation();
  return <ConsolePage width={720} gap={24} mobileGap={24}><ContentSkeleton variant='form'><div className='flex flex-col gap-6'>
    {[
      { title: 'Account', rows: ['Email', 'Password'] },
      { title: 'Security', rows: ['Passkey', 'Two-factor authentication'] },
      { title: 'Login devices', rows: ['Manage login sessions'] },
      { title: 'System access tokens', rows: ['Personal tokens for the management API'] },
    ].map((group) => <SettingGroup key={group.title} title={t(group.title)}>{group.rows.map((label, index) => <SettingRow key={label} title={t(label)} description={<Skeleton width={220} height={18} />} last={index === group.rows.length - 1}><Skeleton width={70} height={32} rounded='rounded-full' /></SettingRow>)}</SettingGroup>)}
  </div></ContentSkeleton></ConsolePage>;
}

export function ProfileRowsSkeleton({ rows = 1, lines = 1, switches = false }: { rows?: number; lines?: number; switches?: boolean }) {
  return <ContentSkeleton variant='form'>{Array.from({ length: rows }, (_, index) => <SettingRow key={index} title={<Skeleton width={110} height={21} />} description={lines > 0 ? <div>{Array.from({ length: lines }, (_, line) => <Skeleton key={line} width={200} height={18} />)}</div> : undefined} last={index === rows - 1}><Skeleton width={switches ? 36 : 70} height={switches ? 20 : 32} rounded='rounded-full' /></SettingRow>)}</ContentSkeleton>;
}

export function StatCard({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return <div data-stat-card style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 2 }}>{sub}</div>}
  </div>;
}

export function ReportSection({ title, right, children }: PropsWithChildren<{ title: ReactNode; right?: ReactNode }>) {
  return <div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>{title}</span>{right && <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>{right}</span>}</div>{children}</div>;
}

export function StatisticsSkeleton({ system = false }: { system?: boolean }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const groups = system ? [
    { title: '', labels: ['Service health', 'RPM in last 5 minutes', 'Success rate', 'Average latency'] },
    { title: 'Resources and connections', labels: ['CPU', 'Memory', 'Disk', 'Active connections'] },
    { title: 'Request health', labels: ['Requests today', 'Errors in last 5 minutes', 'Tokens today', 'Cost today', 'Goroutines'] },
  ] : [{ title: '', labels: ['Recorded payment amount', 'Top-up orders', 'Average RPM', 'Usage credit charged', 'Requests', 'Token consumption', 'Active users', 'New users'] }];
  return <ContentSkeleton variant='cards'><div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 20 : 28 }}>
    {groups.map((group, index) => <section key={index}>
      {group.title && <h2 className='mb-3 text-base font-semibold text-ui-text'>{t(group.title)}</h2>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mobile ? 2 : 4}, minmax(0, 1fr))`, gap: mobile ? 8 : 12 }}>
        {group.labels.map((label) => <StatCard key={label} label={t(label)} value={<div className={`flex items-center ${system && index === 1 && label !== 'Active connections' ? 'h-9' : 'h-[30px]'}`}><Skeleton width={85} height={20} /></div>} sub={!system || index === 0 || label === 'Active connections' || label === 'Errors in last 5 minutes' ? <Skeleton width={75} height={18} /> : index === 1 ? <Skeleton height={4} className='mt-1' /> : undefined} />)}
      </div>
    </section>)}
    {(system ? ['Channel health', 'Model risk'] : ['Charges by group', 'Charges by channel']).map((title, index) => <ReportSection key={title} title={t(title)}>
      <Table loading size='sm' skeletonRows={3} columns={(system
        ? [index === 0 ? 'Channel' : 'Model', 'Errors', 'Error rate', ...(!mobile ? ['Average latency', 'Requests'] : [])]
        : ['#', index === 0 ? 'Group' : 'Channel', 'Usage charges', ...(!mobile ? ['Requests', 'Token', 'Share of charges'] : [])]
      ).map((label, column) => ({ key: label, title: t(label), align: column > (system ? 0 : 1) ? 'right' as const : 'left' as const, width: label === '#' ? 40 : label === 'Share of charges' ? 100 : undefined }))} />
    </ReportSection>)}
    {system ? ['Dependencies', 'Cache and capacity'].map((title) => <ReportSection key={title} title={t(title)}><div className={`flex gap-3 ${mobile ? 'flex-col' : ''}`}>{[0, 1].map((index) => <div key={index} className='min-w-0 flex-1 rounded-2xl border border-ui-border p-4'><Skeleton width={110} height={20} /><div className='mt-2.5 grid grid-cols-2 gap-2'>{[0, 1, 2, 3].map((field) => <div key={field} className='space-y-1'><Skeleton width={60} height={16} /><Skeleton width={50} height={20} /></div>)}</div></div>)}</div></ReportSection>) : <ReportSection title={t('Reporting basis')}><div className='rounded-lg border border-ui-border p-3.5 space-y-2'><Skeleton height={22} /><Skeleton width='80%' height={16} /></div></ReportSection>}
  </div></ContentSkeleton>;
}

export function DashboardStatsSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='dashboard'><div className='flex flex-col gap-4 min-[769px]:gap-7'>
    <div className='dashboard-primary-stats'>{['Remaining balance', 'Total requests'].map((label, index) => <div key={label} className='dashboard-primary-card'>
      <div className='min-w-0'><div className='mb-2 text-sm text-ui-text-3'>{t(label)}</div><div className='flex h-[42px] items-center'><Skeleton width={140} height={28} /></div><div className='mt-1'><Skeleton width={145} height={18} /></div></div>
      {index === 0 && <Skeleton width={76} height={32} rounded='rounded-full' />}
    </div>)}</div>
    <div className='dashboard-secondary-stats'>{['Tokens today', 'Spent today', 'Requests today', 'Current RPM'].map((label, index) => <div className='dashboard-stat-mini' key={label}>
      <div className='mb-1 text-xs text-ui-text-3'>{t(label)}</div><div className='flex h-[30px] items-center'><Skeleton width={90} height={20} /></div>{index === 3 && <Skeleton width={100} height={18} />}
    </div>)}</div>
  </div></ContentSkeleton>;
}

export function PricingCardsSkeleton({ preview = false }: { preview?: boolean }) {
  return <ContentSkeleton variant='cards'><div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-4'>
    {Array.from({ length: 8 }, (_, index) => <Card key={index} data-pricing-placeholder>
      <div className='flex flex-col'>
        <div className='flex items-start justify-between gap-2'><div className='flex min-w-0 items-center gap-2'><Skeleton width={22} height={22} /><Skeleton width={100} height={21} /></div><Skeleton width={45} height={22} /></div>
        {!preview && <div className='mt-3'><Skeleton width={120} height={28} /></div>}
        <Divider />
        <div className='mt-3 flex flex-col gap-1'>{[0, 1].map((row) => <div key={row} className='flex items-center justify-between gap-2'><Skeleton width={55} height={16} /><Skeleton width={90} height={16} /></div>)}</div>
      </div>
    </Card>)}
  </div></ContentSkeleton>;
}

export function PricingDetailSkeleton() {
  return <ContentSkeleton variant='cards'><div className='flex flex-col gap-4'>
    <Card><div className='flex items-center gap-4'><Skeleton width={56} height={56} /><div className='flex-1 space-y-3'><Skeleton width={220} height={28} /><div className='flex gap-2'><Skeleton width={70} height={20} /><Skeleton width={80} height={20} /></div></div><Skeleton width={32} height={32} /></div><div className='mt-4 border-t border-ui-divider pt-4'><Skeleton height={16} /><Skeleton className='mt-2' width='70%' height={16} /></div></Card>
    <Card><div className='space-y-4'><Skeleton width={140} height={20} /><Skeleton width={180} height={36} />{[0, 1, 2].map((row) => <div key={row} className='flex justify-between gap-4 border-t border-ui-divider pt-3'><Skeleton width='30%' height={20} /><Skeleton width='35%' height={20} /></div>)}</div></Card>
  </div></ContentSkeleton>;
}

export function OffersSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='cards'><section className='space-y-4'><h2 className='text-lg font-semibold text-ui-text'>{t('Subscription plans')}</h2><div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
    {[0, 1].map((index) => <div key={index} className='min-w-0 space-y-3 rounded-[26px] border border-ui-border p-5'><div className='flex justify-between gap-2'><Skeleton width='45%' height={24} /><Skeleton width={60} height={24} /></div><Skeleton height={20} /><Skeleton width='75%' height={20} /><div className='flex gap-2'><Skeleton width={90} height={20} /></div><Skeleton width={88} height={36} rounded='rounded-full' /></div>)}
  </div></section></ContentSkeleton>;
}

export function MySubscriptionSkeleton() {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return <ContentSkeleton variant='cards'><div className={`flex flex-col ${mobile ? 'gap-5' : 'gap-7'}`}>
    <div className='space-y-2 rounded-[26px] border border-ui-border p-5'><div className='text-sm text-ui-text-2'>{t('Billing priority')}</div><Skeleton height={36} rounded='rounded-full' /></div>
    <div className={mobile ? 'space-y-4' : 'rounded-[26px] border border-ui-border px-6 py-5'}>
      <div className='mb-3.5 flex justify-between gap-2'><Skeleton width={170} height={28} /><Skeleton width={55} height={20} /></div>
      <div className={`grid min-w-0 gap-4 ${mobile ? 'grid-cols-1' : 'grid-cols-2'}`}>{['Validity', 'Source', 'Credit usage', 'Concurrency / RPM limits', 'Next credit reset', 'Wallet fallback after credit is exhausted'].map((label) => <div key={label} className='min-w-0'><div className='mb-1 text-[13px] text-ui-text-3'>{t(label)}</div><Skeleton width='75%' height={23} />{label === 'Credit usage' && <Skeleton height={6} className='mt-1' />}</div>)}</div>
    </div>
  </div></ContentSkeleton>;
}
