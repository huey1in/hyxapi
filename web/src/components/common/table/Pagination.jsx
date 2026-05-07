/*
 * Pagination component — minimal numeric controls.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ page, pageSize, total, onChange }) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const go = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p);
  };

  return (
    <div className='flex items-center justify-between gap-3 px-4 py-3 border-t border-ui-border text-sm'>
      <span className='text-ui-text-3 tabular-nums'>
        {total > 0 ? `${start}-${end} / ${total}` : '0'}
      </span>
      <div className='flex items-center gap-1'>
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ui-text-2 transition-colors'
        >
          <ChevronLeft size={16} />
        </button>
        <span className='px-3 py-2 text-ui-text tabular-nums'>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ui-text-2 transition-colors'
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
