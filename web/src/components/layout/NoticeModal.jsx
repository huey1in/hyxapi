/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import { Bell, Megaphone, X, Loader2 } from 'lucide-react';
import { API, showError, getRelativeTime } from '../../helpers';
import { StatusContext } from '../../context/Status';
import NotificationEmptyIcon from './icons/NotificationEmptyIcon';
import AnnouncementEmptyIcon from './icons/AnnouncementEmptyIcon';
import { Button, IconButton, ModalShell } from '../ui';

const TYPE_COLOR = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

const EmptyState = ({ icon: Icon, description }) => (
  <div className='flex flex-col items-center justify-center py-16 text-ui-text-3'>
    <div className='w-16 h-16 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-3'>
      <Icon size={28} />
    </div>
    <p className='text-sm'>{description}</p>
  </div>
);

const NoticeModal = ({
  visible,
  onClose,
  isMobile,
  defaultTab = 'inApp',
  unreadKeys = [],
}) => {
  const { t } = useTranslation();
  const [noticeContent, setNoticeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [statusState] = useContext(StatusContext);

  const announcements = statusState?.status?.announcements || [];
  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);

  const getKeyForItem = (item) =>
    `${item?.publishDate || ''}-${(item?.content || '').slice(0, 30)}`;

  const processedAnnouncements = useMemo(() => {
    return (announcements || []).slice(0, 20).map((item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const absoluteTime =
        pubDate && !isNaN(pubDate.getTime())
          ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
          : item?.publishDate || '';
      return {
        key: getKeyForItem(item),
        type: item.type || 'default',
        time: absoluteTime,
        content: item.content,
        extra: item.extra,
        relative: getRelativeTime(item.publishDate),
        isUnread: unreadSet.has(getKeyForItem(item)),
      };
    });
  }, [announcements, unreadSet]);

  const handleCloseTodayNotice = () => {
    const today = new Date().toDateString();
    localStorage.setItem('notice_close_date', today);
    onClose();
  };

  const displayNotice = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/notice');
      const { success, message, data } = res.data;
      if (success) {
        setNoticeContent(data ? marked.parse(data) : '');
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) displayNotice();
  }, [visible]);

  useEffect(() => {
    if (visible) setActiveTab(defaultTab);
  }, [defaultTab, visible]);

  if (!visible) return null;

  const tabs = [
    { key: 'inApp', Icon: Bell, label: t('通知') },
    { key: 'system', Icon: Megaphone, label: t('系统公告') },
  ];

  const renderMarkdownNotice = () => {
    if (loading) {
      return (
        <EmptyState icon={Loader2} description={t('加载中...')} />
      );
    }
    if (!noticeContent) {
      return <EmptyState icon={NotificationEmptyIcon} description={t('暂无公告')} />;
    }
    return (
      <div
        dangerouslySetInnerHTML={{ __html: noticeContent }}
        className='notice-content-scroll max-h-[55vh] overflow-y-auto pr-2 text-ui-text text-sm leading-relaxed'
      />
    );
  };

  const renderAnnouncementTimeline = () => {
    if (processedAnnouncements.length === 0) {
      return <EmptyState icon={AnnouncementEmptyIcon} description={t('暂无系统公告')} />;
    }
    return (
      <div className='max-h-[55vh] overflow-y-auto pr-2'>
        {processedAnnouncements.map((item, idx) => {
          const htmlContent = marked.parse(item.content || '');
          const htmlExtra = item.extra ? marked.parse(item.extra) : '';
          const isLast = idx === processedAnnouncements.length - 1;
          const dotColor = TYPE_COLOR[item.type] || 'var(--ui-text-3)';
          return (
            <div key={item.key + idx} className='flex gap-3'>
              <div className='flex flex-col items-center pt-1.5'>
                <span
                  className='w-2.5 h-2.5 rounded-full ring-4 ring-ui-bg-elevated'
                  style={{ background: dotColor }}
                />
                {!isLast && <div className='w-px flex-1 bg-ui-border mt-1' />}
              </div>
              <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
                <div className='text-xs text-ui-text-3 mb-1'>
                  {item.relative ? `${item.relative} ` : ''}
                  {item.time}
                </div>
                <div
                  className={`text-sm text-ui-text ${item.isUnread ? 'shine-text' : ''}`}
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
                {item.extra && (
                  <div
                    className='text-xs text-ui-text-2 mt-1'
                    dangerouslySetInnerHTML={{ __html: htmlExtra }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ModalShell
      open={visible}
      onClose={onClose}
      maxWidth='42rem'
      maxHeight='85vh'
      className='flex flex-col'
    >
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <div className='flex items-center gap-4 min-w-0'>
            <span className='text-base font-semibold text-ui-text whitespace-nowrap'>
              {t('系统公告')}
            </span>
            {/* Segmented control 视觉（"凸起" active），与 RadioChipGroup 同类。
                此处独立实现因为带 Icon；若再次出现可抽 ui/Segmented 组件。 */}
            <div className='inline-flex bg-ui-bg-subtle rounded-full p-0.5'>
              {tabs.map(({ key, Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeTab === key
                      ? 'bg-ui-bg-elevated text-ui-text shadow-sm'
                      : 'text-ui-text-2 hover:text-ui-text'
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>
          <IconButton
            icon={X}
            variant='ghost'
            size='sm'
            onClick={onClose}
            aria-label={t('关闭')}
            className='flex-shrink-0'
          />
        </div>

        {/* Body */}
        <div className='flex-1 overflow-hidden p-5'>
          {activeTab === 'inApp' ? renderMarkdownNotice() : renderAnnouncementTimeline()}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <Button variant='secondary' size='sm' onClick={handleCloseTodayNotice}>
            {t('今日关闭')}
          </Button>
          <Button variant='primary' size='sm' onClick={onClose}>
            {t('关闭公告')}
          </Button>
        </div>
    </ModalShell>
  );
};

export default NoticeModal;
