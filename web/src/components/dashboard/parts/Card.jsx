/*
 * Generic dashboard card with optional title + action area.
 */
import React from 'react';

const Card = ({ title, action, children, className = '', bodyClass = 'p-5' }) => (
  <div
    className={`bg-ui-bg-elevated border border-ui-border rounded-xl ${className}`}
  >
    {(title || action) && (
      <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
        {title && (
          <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
            {title}
          </div>
        )}
        {action && <div className='flex items-center gap-2'>{action}</div>}
      </div>
    )}
    <div className={bodyClass}>{children}</div>
  </div>
);

export default Card;
