/*
 * Pagination — 分页控件
 *
 * page / pageSize / total / onChange(page)
 * showRange: 显示当前可见区间（默认 true）
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import IconButton from '../button/IconButton';

const Pagination = ({ page, pageSize, total, onChange, showRange = true }) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const go = (p) => { if (p < 1 || p > totalPages || p === page) return; onChange?.(p); };

  return (
    <div className='flex items-center justify-between gap-3 px-4 py-3 border-t border-ui-border text-sm'>
      {showRange && (
        <span className='text-ui-text-3 tabular-nums'>
          {total > 0 ? `${start}-${end} / ${total}` : '0'}
        </span>
      )}
      <div className='flex items-center gap-1'>
        <IconButton icon={ChevronLeft} size='sm' onClick={() => go(page - 1)} disabled={page <= 1} aria-label='prev' />
        <span className='px-3 py-2 text-ui-text tabular-nums'>{page} / {totalPages}</span>
        <IconButton icon={ChevronRight} size='sm' onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label='next' />
      </div>
    </div>
  );
};

export default Pagination;
