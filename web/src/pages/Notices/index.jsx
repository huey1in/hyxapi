import React, { useContext, useMemo } from 'react';
import { Megaphone } from 'lucide-react';
import { marked } from 'marked';
import { getRelativeTime } from '../../helpers';
import { StatusContext } from '../../context/Status';
import useIsMobile from '../../hooks/useIsMobile';

const TYPE_COLOR = {
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  default: '#c0c0c0',
};

const NoticesPage = () => {
  const [statusState] = useContext(StatusContext);
  const announcements = statusState?.status?.announcements || [];
  const isMobile = useIsMobile();

  const items = useMemo(() => {
    const seen = (() => {
      try { return new Set(JSON.parse(localStorage.getItem('seen_notices') || '[]')); } catch { return new Set(); }
    })();
    const list = (announcements || []).slice(0, 50).map((it) => {
      const d = it?.publishDate ? new Date(it.publishDate) : null;
      const abs = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : it?.publishDate || '';
      const key = `${it?.publishDate || ''}-${(it?.content || '').slice(0, 30)}`;
      return { key, type: it.type || 'default', time: abs, content: it.content, extra: it.extra, relative: getRelativeTime(it.publishDate), isUnread: !seen.has(key) };
    });
    // 标记全部已读
    try {
      localStorage.setItem('seen_notices', JSON.stringify(list.map((it) => it.key)));
    } catch {}
    return list;
  }, [announcements]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      <span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>系统公告</span>

      <div style={{ padding: '24px', border: '1px solid #e9e9e9', borderRadius: 26 }}>
        {items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#999' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F2F0E9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Megaphone size={24} color='#bbb' />
            </div>
            <span style={{ fontSize: 14 }}>暂无公告</span>
          </div>
        ) : (
          items.map((it, idx) => {
            const isLast = idx === items.length - 1;
            const dotColor = TYPE_COLOR[it.type] || TYPE_COLOR.default;
            const html = marked.parse(it.content || '');
            const extraHtml = it.extra ? marked.parse(it.extra) : '';
            return (
              <div key={it.key + idx} style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: dotColor, boxShadow: `0 0 0 3px #FFFDF7, 0 0 0 4px ${dotColor}55`,
                  }} />
                  {!isLast && <div style={{ width: 1, flex: 1, background: '#e9e9e9', marginTop: 6 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 24 }}>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>
                    {it.relative && <span style={{ marginRight: 6 }}>{it.relative}</span>}
                    <span>{it.time}</span>
                  </div>
                  <div
                    style={{ fontSize: 14, lineHeight: 1.7, color: '#333', fontWeight: it.isUnread ? 600 : 400 }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  {it.extra && (
                    <div style={{ fontSize: 13, color: '#666', marginTop: 6 }} dangerouslySetInnerHTML={{ __html: extraHtml }} />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NoticesPage;
