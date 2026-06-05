/*
 * PageShell — 页面级外壳
 *
 * 统一所有列表/详情页的：
 *   - bg-[var(--page-bg)] 背景
 *   - max-w-[1400px] 居中
 *   - 内边距 px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8
 *   - 标题区（title + 右侧 actions）
 *
 * title:    string | node
 * actions:  右侧节点（通常是若干 IconButton + Button）
 * maxWidth: 默认 '1400px'
 */

import React from 'react';
import { cn } from '../tokens';

const PageShell = ({ title, actions, maxWidth = '1400px', children }) => (
  <div
    className='px-4 pt-8 pb-6 md:px-6 md:pt-6 md:pb-8'
    style={{ backgroundColor: 'var(--page-bg)' }}
  >
    <div className='mx-auto' style={{ maxWidth }}>
      {(title || actions) && (
        <div className='flex items-center justify-between gap-3 mb-5'>
          {title && (
            <h1 className='text-2xl md:text-3xl font-medium text-ui-text' style={{ letterSpacing: '-0.02em' }}>
              {title}
            </h1>
          )}
          {actions && <div className='flex items-center gap-1'>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  </div>
);

export default PageShell;
