/*
 * Generic dashboard card with optional title + action area.
 */
import React from 'react';

const Card = ({ title, action, children, className = '', bodyClass = 'p-5' }) => (
  <div
    className={`bg-ui-bg-elevated border border-ui-border rounded-xl flex flex-col ${className}`}
  >
    {(title || action) && (
      <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border flex-shrink-0 min-w-0'>
        {title && (
          <div className='flex items-center gap-2 text-sm font-semibold text-ui-text whitespace-nowrap flex-shrink-0'>
            {title}
          </div>
        )}
        {action && <div className='flex items-center gap-2 min-w-0'>{action}</div>}
      </div>
    )}
    <div className={`${bodyClass} flex-1 min-h-0`}>{children}</div>
  </div>
);

export default Card;
