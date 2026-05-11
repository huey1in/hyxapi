/*
 * DocumentRenderer — 通用文档展示
 *
 * 同时支持三种内容：
 *   1. URL → 显示访问按钮
 *   2. 包含 HTML 标签 → dangerouslySetInnerHTML（自动抽离 <style>）
 *   3. 其它 → 用 MarkdownRenderer 渲染
 *
 * apiEndpoint:   GET 取内容的接口
 * title:         标题（用于卡片头与空态）
 * cacheKey:      localStorage 缓存 key
 * emptyMessage:  空内容时的兜底文案
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { API, showError } from '../../../helpers';
import { Card, Button, PageShell, EmptyState } from '../../ui';
import MarkdownRenderer from '../markdown/MarkdownRenderer';

const isUrl = (s) => {
  try { new URL(String(s).trim()); return true; } catch { return false; }
};
const isHtmlContent = (s) => typeof s === 'string' && /<\/?[a-z][\s\S]*>/i.test(s);

const sanitizeHtml = (html) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const styles = Array.from(tempDiv.querySelectorAll('style')).map((el) => el.innerHTML).join('\n');
  tempDiv.querySelectorAll('style').forEach((el) => el.remove());
  const bodyContent = tempDiv.querySelector('body');
  const content = bodyContent ? bodyContent.innerHTML : tempDiv.innerHTML;
  return { content, styles };
};

const DocumentRenderer = ({ apiEndpoint, title, cacheKey, emptyMessage = '管理员未设置该内容' }) => {
  const [content, setContent] = useState(() => localStorage.getItem(cacheKey) || '');
  const [loading, setLoading] = useState(!localStorage.getItem(cacheKey));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get(apiEndpoint);
        const { success, data } = res.data || {};
        if (cancelled) return;
        if (success && data) {
          setContent(data);
          localStorage.setItem(cacheKey, data);
        }
      } catch (err) {
        if (!cancelled && !localStorage.getItem(cacheKey)) {
          showError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiEndpoint, cacheKey]);

  const htmlPayload = useMemo(() => (isHtmlContent(content) ? sanitizeHtml(content) : { content: '', styles: '' }), [content]);

  useEffect(() => {
    if (!htmlPayload.styles) return;
    const id = `doc-style-${cacheKey}`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = htmlPayload.styles;
    return () => { document.getElementById(id)?.remove(); };
  }, [cacheKey, htmlPayload.styles]);

  if (loading) {
    return (
      <div className='flex justify-center items-center py-24'>
        <Loader2 size={32} className='animate-spin text-ui-text-3' />
      </div>
    );
  }

  if (!content || !content.trim()) {
    return (
      <PageShell title={title} maxWidth='900px'>
        <Card>
          <EmptyState title={title} description={emptyMessage} />
        </Card>
      </PageShell>
    );
  }

  if (isUrl(content)) {
    return (
      <PageShell title={title} maxWidth='900px'>
        <Card>
          <div className='text-center py-6'>
            <p className='text-sm text-ui-text-2 mb-4'>管理员设置了外部链接，点击下方按钮访问。</p>
            <Button onClick={() => window.open(content.trim(), '_blank', 'noopener,noreferrer')}>
              访问 {title}
            </Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (isHtmlContent(content)) {
    return (
      <PageShell title={title} maxWidth='900px'>
        <Card>
          <div className='prose max-w-none text-ui-text-2' dangerouslySetInnerHTML={{ __html: htmlPayload.content }} />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell title={title} maxWidth='900px'>
      <Card>
        <MarkdownRenderer content={content} />
      </Card>
    </PageShell>
  );
};

export default DocumentRenderer;
