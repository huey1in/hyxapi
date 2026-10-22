/*
 * Pagination — 分页控件
 *
 * page / pageSize / total / onChange(page)
 * showRange: 显示当前可见区间（默认 true）
 * leading: 分页栏左侧的操作入口
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import IconButton from '../button/IconButton';

/**
 * @param {{ page: number, pageSize: number, total: number, onChange?: (page: number) => void, showRange?: boolean, leading?: import('react').ReactNode }} props
 */
const Pagination = ({ page, pageSize, total, onChange, showRange = true, leading = null }) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const go = (p) => { if (p < 1 || p > totalPages || p === page) return; onChange?.(p); };

  return (
    <div className={`flex items-center gap-3 py-3 border-t border-ui-border text-sm ${showRange || leading ? 'justify-between' : 'justify-end'} ${leading ? 'px-0' : 'px-4'}`}>
      {leading}
      {showRange && (
        <span className='text-ui-text-3 tabular-nums'>
          {total > 0 ? `${start}-${end} / ${total}` : '0'}
        </span>
      )}
      <div className='flex shrink-0 items-center gap-1'>
        <IconButton icon={ChevronLeft} size='sm' onClick={() => go(page - 1)} disabled={page <= 1} aria-label='prev' />
        <span className='px-3 py-2 text-ui-text tabular-nums'>{page} / {totalPages}</span>
        <IconButton icon={ChevronRight} size='sm' onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label='next' />
      </div>
    </div>
  );
};

export default Pagination;
