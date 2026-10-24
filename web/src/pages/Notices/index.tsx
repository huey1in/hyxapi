import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { EmptyState, Pagination } from '../../components/ui';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { useAuthStore } from '../../stores/auth-store';
import { announcementKey, safeAnnouncementLink } from '../../features/notifications/notification-data';
import { useNotifications } from '../../features/notifications/use-notifications';

const colors: Record<string, string> = { success: '#22c55e', warning: '#f59e0b', error: '#ef4444', ongoing: '#3b82f6', default: '#c0c0c0' };
const pageSize = 20;

function Notifications() {
  const { t, i18n } = useTranslation();
  const { announcements, read, markRead } = useNotifications();
  const [page, setPage] = useState(1);
  const [previouslyRead] = useState(() => new Set(read.announcements));
  const visible = useMemo(() => announcements.slice((page - 1) * pageSize, page * pageSize), [announcements, page]);
  const keys = useMemo(() => announcements.map(announcementKey), [announcements]);
  useEffect(() => { setPage((current) => Math.min(current, Math.max(1, Math.ceil(announcements.length / pageSize)))); }, [announcements.length]);
  useEffect(() => { markRead(keys); }, [keys, markRead]);
  const date = (raw: string) => { const value = new Date(raw); return Number.isNaN(value.getTime()) ? raw : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(value); };
  return <div className='console-content-page console-wide-page'>
    <ConsolePageHeader title={t('Notifications')} />
    <section aria-label={t('System announcements')} className='notices-announcements flex min-h-[440px] min-w-0 flex-col rounded-[26px] border border-ui-border p-6 md:min-h-[560px]'>
      <h2 className='mb-5 text-sm font-semibold'>{t('System announcements')}</h2>
      {!announcements.length ? <div className='notices-empty-state flex flex-1 items-center justify-center'><EmptyState icon={Bell} iconVariant='plain' title={t('No announcements')} /></div> : visible.map((item, index) => {
        const key = announcementKey(item); const last = index === visible.length - 1; const color = colors[item.type] ?? colors.default; const link = safeAnnouncementLink(item.link);
        return <article key={key} className='flex min-w-0 gap-4'>
          <div className='flex shrink-0 flex-col items-center' aria-hidden='true'><span className='mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full' style={{ background: color, boxShadow: `0 0 0 3px var(--page-bg), 0 0 0 4px ${color}55` }} />{!last && <span className='mt-1.5 w-px flex-1 bg-ui-border' />}</div>
          <div className={`min-w-0 flex-1 ${last ? '' : 'pb-6'}`}>
            <time className='mb-1.5 block text-xs text-ui-text-3' dateTime={item.publishDate}>{date(item.publishDate)}</time>
            {item.title && <h3 className='mb-2 text-sm font-semibold text-ui-text'>{item.title}</h3>}
            <div className='min-w-0 text-sm leading-relaxed text-ui-text-2' style={{ fontWeight: previouslyRead.has(key) ? 400 : 600 }}><MarkdownRenderer content={item.content} /></div>
            {item.extra && <div className='mt-1.5 min-w-0 text-[13px] text-ui-text-3'><MarkdownRenderer content={item.extra} /></div>}
            {link && <a href={link} target='_blank' rel='noopener noreferrer' className='mt-2 inline-block text-sm underline'>{t('View announcement')}</a>}
          </div>
        </article>;
      })}
      {announcements.length > pageSize && <div className='mt-5'><Pagination page={page} pageSize={pageSize} total={announcements.length} onChange={setPage} /></div>}
    </section>
  </div>;
}

export default function NoticesPage() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <Notifications key={identity} />;
}
