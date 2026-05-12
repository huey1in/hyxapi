import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Bell, Megaphone, X, Loader2 } from 'lucide-react';
import { marked } from 'marked';
import { API, showError, getRelativeTime } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { Button, IconButton, ModalShell, Tabs } from '../ui';

const TYPE_COLOR = {
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
};

const EmptyBox = ({ icon: Icon, description }) => (
  <div className='flex flex-col items-center justify-center py-16 text-ui-text-3'>
    <div className='w-16 h-16 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-3'>
      <Icon size={28} />
    </div>
    <p className='text-sm'>{description}</p>
  </div>
);

const NoticeModal = ({ open, onClose, defaultTab = 'inApp', unreadKeys = [] }) => {
  const [statusState] = useContext(StatusContext);
  const announcements = statusState?.status?.announcements || [];

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [noticeContent, setNoticeContent] = useState('');
  const [loading, setLoading] = useState(false);

  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);
  const getKey = (it) => `${it?.publishDate || ''}-${(it?.content || '').slice(0, 30)}`;

  const items = useMemo(() => {
    return (announcements || []).slice(0, 20).map((it) => {
      const d = it?.publishDate ? new Date(it.publishDate) : null;
      const abs = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : it?.publishDate || '';
      const key = getKey(it);
      return {
        key,
        type: it.type || 'default',
        time: abs,
        content: it.content,
        extra: it.extra,
        relative: getRelativeTime(it.publishDate),
        isUnread: unreadSet.has(key),
      };
    });
  }, [announcements, unreadSet]);

  useEffect(() => {
    if (!open) return;
    setActiveTab(defaultTab);
    setLoading(true);
    API.get('/api/notice')
      .then((res) => {
        const { success, data, message } = res.data || {};
        if (success) setNoticeContent(data ? marked.parse(data) : '');
        else if (message) showError(message);
      })
      .catch(showError)
      .finally(() => setLoading(false));
  }, [open, defaultTab]);

  if (!open) return null;

  const handleCloseToday = () => {
    try { localStorage.setItem('notice_close_date', new Date().toDateString()); } catch {}
    onClose();
  };

  const tabs = [
    { value: 'inApp',  label: <span className='inline-flex items-center gap-1.5'><Bell size={13} /> 通知</span> },
    { value: 'system', label: <span className='inline-flex items-center gap-1.5'><Megaphone size={13} /> 系统公告</span> },
  ];

  const renderMarkdownNotice = () => {
    if (loading) return <EmptyBox icon={Loader2} description='加载中...' />;
    if (!noticeContent) return <EmptyBox icon={Bell} description='暂无公告' />;
    return (
      <div
        dangerouslySetInnerHTML={{ __html: noticeContent }}
        className='max-h-[55vh] overflow-y-auto pr-2 text-ui-text-1 text-sm leading-relaxed ui-scrollbar prose max-w-none'
      />
    );
  };

  const renderTimeline = () => {
    if (items.length === 0) return <EmptyBox icon={Megaphone} description='暂无系统公告' />;
    return (
      <div className='max-h-[55vh] overflow-y-auto pr-2 ui-scrollbar'>
        {items.map((it, idx) => {
          const html = marked.parse(it.content || '');
          const extraHtml = it.extra ? marked.parse(it.extra) : '';
          const isLast = idx === items.length - 1;
          const dotColor = TYPE_COLOR[it.type] || 'var(--ui-text-3)';
          return (
            <div key={it.key + idx} className='flex gap-3'>
              <div className='flex flex-col items-center pt-1.5'>
                <span
                  className='w-2.5 h-2.5 rounded-full ring-4'
                  style={{ background: dotColor, boxShadow: '0 0 0 4px var(--page-bg)' }}
                />
                {!isLast && <div className='w-px flex-1 bg-ui-border mt-1' />}
              </div>
              <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
                <div className='text-xs text-ui-text-3 mb-1'>
                  {it.relative ? `${it.relative} ` : ''}{it.time}
                </div>
                <div
                  className={`text-sm text-ui-text-1 ${it.isUnread ? 'font-medium' : ''}`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                {it.extra && (
                  <div className='text-xs text-ui-text-2 mt-1' dangerouslySetInnerHTML={{ __html: extraHtml }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ModalShell open={open} onClose={onClose} maxWidth='42rem' maxHeight='85vh' zIndex={500}>
      <div className='flex flex-col h-full'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <div className='flex items-center gap-4 min-w-0'>
            <span className='text-base font-semibold text-ui-text-1 whitespace-nowrap'>系统公告</span>
            <Tabs variant='pill' size='sm' items={tabs} value={activeTab} onChange={setActiveTab} />
          </div>
          <IconButton icon={X} onClick={onClose} aria-label='关闭' />
        </div>

        {/* Body */}
        <div className='flex-1 overflow-hidden p-5'>
          {activeTab === 'inApp' ? renderMarkdownNotice() : renderTimeline()}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <Button variant='secondary' size='sm' onClick={handleCloseToday}>今日关闭</Button>
          <Button size='sm' onClick={onClose}>关闭公告</Button>
        </div>
      </div>
    </ModalShell>
  );
};

export default NoticeModal;
