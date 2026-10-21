import type { PropsWithChildren, ReactNode } from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';
import ContentSkeleton from '../ui/feedback/ContentSkeleton';
import Skeleton from '../ui/feedback/Skeleton';
import Card from '../ui/card/Card';
import Divider from '../ui/display/Divider';
import Table from '../ui/layout/Table';
import { PersonalSettingsHeader, SettingGroup, SettingRow } from '../../pages/Personal/ProfileSettingsLayout';
import type { PersonalSettingsTab } from '../../pages/Personal/personal-navigation';
import { BillingSettingsSkeleton } from '../../pages/Personal/BillingSettings';
import { useAuthStore } from '../../stores/auth-store';
import { StatusContext } from '../../context/Status';
import { parsePersonalSettings } from '../../pages/Personal/personal-settings';
import SpendingTrendChart from '../../pages/Dashboard/SpendingTrendChart';

// These frames are shared with the corresponding pages so loading uses the same
// width, padding and mobile breakpoint as the loaded content.
export function ConsolePage({ children, width = 960, gap = 28, mobileGap = 20 }: PropsWithChildren<{ width?: number; gap?: number; mobileGap?: number }>) {
  const mobile = useIsMobile();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? mobileGap : gap, width: '100%', minWidth: 0, maxWidth: width, marginInline: 'auto', padding: mobile ? '16px' : '24px 16px' }}>{children}</div>;
}

export function PersonalSkeleton({ tab = 'account', onChange }: { tab?: PersonalSettingsTab; onChange?: (tab: PersonalSettingsTab) => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const role = user?.role ?? 0;
  const [statusState] = useContext(StatusContext);
  const status = statusState.status;
  const bindings = [
    (status?.github_oauth || user?.github_id) && 'GitHub', (status?.discord_oauth || user?.discord_id) && 'Discord',
    (status?.oidc_enabled || user?.oidc_id) && (status?.oidc_display_name || 'OIDC'), (status?.linuxdo_oauth || user?.linux_do_id) && 'Linux DO',
    (status?.telegram_oauth || user?.telegram_id) && 'Telegram', (status?.wechat_login || user?.wechat_id) && 'WeChat',
    ...(status?.custom_oauth_providers ?? []).map((provider) => provider.name || provider.slug),
  ].filter((label): label is string => typeof label === 'string');
  let settings;
  try { settings = parsePersonalSettings(user?.setting); } catch { settings = parsePersonalSettings(undefined); }
  const notificationRows = ['Quota warning', ...(settings.quota_warning_enabled ? ['Reminder threshold'] : []), ...(role >= 10 ? ['Channel notifications', 'Upstream model updates'] : []), 'Notification Method', ...(settings.notify_type === 'webhook' ? ['Webhook URL', 'Webhook Secret'] : settings.notify_type === 'bark' ? ['Bark URL'] : settings.notify_type === 'gotify' ? ['Gotify URL', 'Gotify Token', 'Message Priority'] : ['Notification Email'])];
  const group = (title: string, rows: string[], switches = false) => <SettingGroup title={t(title)}>{rows.map((label, row) => {
    const toggle = switches || ['Quota warning', 'Channel notifications', 'Upstream model updates'].includes(label);
    const input = ['Language', 'Reminder threshold', 'Notification Method', 'Notification Email', 'Webhook URL', 'Webhook Secret', 'Bark URL', 'Gotify URL', 'Gotify Token', 'Message Priority'].includes(label);
    const textInput = ['Notification Email', 'Webhook URL', 'Webhook Secret', 'Bark URL', 'Gotify URL', 'Gotify Token'].includes(label);
    const width = textInput ? 'min(220px,48vw)' : toggle ? 44 : label === 'Reminder threshold' ? 128 : label === 'Message Priority' ? 96 : input ? 160 : 70;
    return <SettingRow key={`${label}:${row}`} title={t(label)} description={textInput ? undefined : <Skeleton width={220} height={18} />} last={row === rows.length - 1}><Skeleton width={width} height={toggle ? 24 : 36} rounded={input ? 'rounded-xl' : 'rounded-full'} /></SettingRow>;
  })}</SettingGroup>;
  return <ConsolePage width={720} gap={24} mobileGap={24}>
    <PersonalSettingsHeader tab={tab} onChange={onChange} />
    <ContentSkeleton variant='form'><div data-settings-panel={tab} className='flex min-w-0 flex-col gap-6'>
      {tab === 'account' && <>{group('Account', ['Email'])}{bindings.length > 0 && group('Linked accounts', bindings)}{group('Preferences', ['Language'])}{role < 100 && group('Account actions', ['Delete account'])}</>}
      {tab === 'security' && <>{group('Security', ['Password', 'Passkey', 'Two-factor authentication'])}{group('Login devices', ['Manage login sessions'])}{group('System access tokens', ['Personal tokens for the management API'])}</>}
      {tab === 'usage' && <><BillingSettingsSkeleton />{group('Usage preferences', ['Record IP Address', 'Allow models without a configured price'], true)}</>}
      {tab === 'notifications' && <div className='space-y-2'>{group('Notifications', notificationRows)}<p className='px-0.5 text-xs text-ui-text-3'>{t('Verification and password reset emails are always sent')}</p></div>}
    </div></ContentSkeleton>
  </ConsolePage>;
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

export function DashboardPrimaryStatsSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='dashboard'><div className='dashboard-primary-stats'>{['Top-up balance', 'Total spending'].map((label, index) => <div key={label} className='dashboard-primary-card'>
      <div className='min-w-0'><div className='mb-2 text-sm text-ui-text-3'>{t(label)}</div><div className='flex h-[42px] items-center'><Skeleton width={140} height={28} /></div></div>
      {index === 0 && <Skeleton width={76} height={32} rounded='rounded-full' />}
    </div>)}</div></ContentSkeleton>;
}

export function DashboardUsageStatsSkeleton() {
  const { t } = useTranslation();
  return <ContentSkeleton variant='dashboard'><div className='dashboard-secondary-stats'>{['Spending amount', 'API requests', 'Tokens'].map((label) => <div className='dashboard-stat-mini' key={label}>
    <div className='mb-1 text-xs text-ui-text-3'>{label === 'Tokens' ? label : t(label)}</div><div className='flex h-[30px] items-center'><Skeleton width={72} height={20} /></div>
  </div>)}</div></ContentSkeleton>;
}

export function DashboardStatsSkeleton() {
  const { t } = useTranslation();
  return <div className='flex flex-col gap-4 min-[769px]:gap-7'>
    <DashboardPrimaryStatsSkeleton />
    <div aria-hidden='true' className='mx-6 my-3 h-px shrink-0 bg-ui-divider max-[768px]:mx-3' />
    <div className='space-y-3'><ContentSkeleton variant='dashboard'><div className='dashboard-usage-filters'>{['Time', 'API Key'].map((label, index) => <div key={label} className={`dashboard-filter-field${index ? ' dashboard-key-filter' : ''}`}>
      <div className='flex h-8 w-full items-center gap-1.5 rounded-xl border border-ui-border px-[11px] text-sm'><span className='shrink-0 text-xs text-ui-text-3'>{index ? label : t(label)}</span><div className='relative min-w-0 flex-1 whitespace-nowrap'><span className='invisible'>{t(index ? 'All' : 'Last 30 days')}</span><div className='absolute inset-x-0 top-1/2 -translate-y-1/2'><Skeleton height={14} /></div></div><ChevronDown size={14} className='shrink-0 text-ui-text-3' /></div>
    </div>)}</div></ContentSkeleton><DashboardUsageStatsSkeleton /><SpendingTrendChart loading /></div>
  </div>;
}

export function PricingCardsSkeleton({ preview = false }: { preview?: boolean }) {
  return <ContentSkeleton variant='cards'><div className='pricing-model-grid grid'>
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

export function MySubscriptionSkeleton() {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  return <ContentSkeleton variant='cards'><div className={`flex flex-col ${mobile ? 'gap-5' : 'gap-7'}`}>
    <div className={mobile ? 'space-y-4' : 'rounded-[26px] border border-ui-border px-6 py-5'}>
      <div className='mb-3.5 flex justify-between gap-2'><Skeleton width={170} height={28} /><Skeleton width={55} height={20} /></div>
      <div className={`grid min-w-0 gap-4 ${mobile ? 'grid-cols-1' : 'grid-cols-2'}`}>{['Validity', 'Source', 'Credit usage', 'Concurrency / RPM limits', 'Next credit reset', 'Wallet fallback after credit is exhausted'].map((label) => <div key={label} className='min-w-0'><div className='mb-1 text-[13px] text-ui-text-3'>{t(label)}</div><Skeleton width='75%' height={23} />{label === 'Credit usage' && <Skeleton height={6} className='mt-1' />}</div>)}</div>
    </div>
  </div></ContentSkeleton>;
}
