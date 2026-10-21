import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { configuredContentKind } from '../../lib/configured-content';
import { safeAnnouncementLink } from './notification-data';
import { useSiteNotice } from './use-site-notice';
import { useAuthStore } from '../../stores/auth-store';

function InlineContent({ content, duplicate = false }: { content: string; duplicate?: boolean }) {
  const kind = configuredContentKind(content);
  const summary = useMemo(() => {
    if (kind !== 'html') return '';
    const noticeDocument = new DOMParser().parseFromString(content, 'text/html');
    noticeDocument.querySelectorAll('script,style,noscript,template,iframe,object').forEach((node) => node.remove());
    noticeDocument.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,section,tr').forEach((node) => node.after(noticeDocument.createTextNode(' ')));
    return noticeDocument.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }, [content, kind]);
  if (kind === 'html') return <span>{summary}</span>;
  if (kind === 'url') {
    const link = safeAnnouncementLink(content);
    return link ? <a href={link} target='_blank' rel='noopener noreferrer' tabIndex={duplicate ? -1 : undefined}>{content}</a> : <span>{content}</span>;
  }
  return <ReactMarkdown skipHtml unwrapDisallowed allowedElements={['p', 'strong', 'em', 'del', 'code', 'a', 'br', 'img']} components={{
    p: ({ children }) => <span>{children} </span>,
    br: () => ' ',
    img: ({ alt }) => <span>{alt}</span>,
    a: ({ href, children }) => {
      const link = safeAnnouncementLink(href ?? '');
      return link ? <a href={link} target='_blank' rel='noopener noreferrer' tabIndex={duplicate ? -1 : undefined}>{children}</a> : <span>{children}</span>;
    },
  }}>{content}</ReactMarkdown>;
}

function NoticeBanner({ content, onClose }: { content: string; onClose: () => void }) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return;
    const measure = () => {
      setOverflow(text.scrollWidth > viewport.clientWidth + 1);
      viewport.style.setProperty('--site-notice-duration', `${Math.max(20, (text.scrollWidth + 48) / 36)}s`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(text);
    measure();
    return () => observer.disconnect();
  }, [content]);

  return <section className='site-notice-banner' aria-label={t('Site notice')} data-overflow={overflow || undefined}>
    <div ref={viewportRef} className='site-notice-banner-viewport' tabIndex={overflow ? 0 : undefined} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) event.currentTarget.scrollLeft = 0;
    }}>
      <div className='site-notice-banner-track'>
        <div className='site-notice-banner-group'><span ref={textRef} className='site-notice-banner-text'><InlineContent content={content} /></span></div>
        {overflow && <div className='site-notice-banner-group site-notice-banner-copy' aria-hidden='true' onMouseDown={(event) => event.preventDefault()}>
          <span className='site-notice-banner-text'><InlineContent content={content} duplicate /></span>
        </div>}
      </div>
    </div>
    <button type='button' className='site-notice-banner-close' title={t('Close site notice')} aria-label={t('Close site notice')} onClick={onClose}><span aria-hidden='true'>×</span></button>
  </section>;
}

export default function SiteNoticeBanner() {
  const notice = useSiteNotice();
  const userId = useAuthStore((state) => state.auth.user?.id);
  const storageKey = `hyxware-site-notice-dismissed:${userId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return saved;
      const previous = sessionStorage.getItem(storageKey) ?? '';
      if (previous) {
        localStorage.setItem(storageKey, previous);
        sessionStorage.removeItem(storageKey);
      }
      return previous;
    } catch { return ''; }
  });
  const content = notice.error ? '' : notice.data ?? '';
  if (!content || content === dismissed) return null;
  return <NoticeBanner content={content} onClose={() => {
    setDismissed(content);
    try { localStorage.setItem(storageKey, content); } catch { /* Keep dismissal in memory when storage is unavailable. */ }
  }} />;
}
