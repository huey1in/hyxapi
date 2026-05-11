/*
 * EmptyState — 空状态占位
 *
 * title:       node
 * description: node
 * action:      节点（通常是个 Button）
 * padding:     lg (默认) | md | sm
 */

import React from 'react';
import { cn } from '../tokens';

const EmptyState = ({ title, description, action, padding = 'lg' }) => (
  <div className={cn(
    'flex flex-col items-center justify-center text-center',
    padding === 'lg' && 'py-16',
    padding === 'md' && 'py-10',
    padding === 'sm' && 'py-6',
  )}>
    {title && <div className='text-sm text-ui-text font-medium mb-1'>{title}</div>}
    {description && <div className='text-xs text-ui-text-3 max-w-sm leading-relaxed'>{description}</div>}
    {action && <div className='mt-4'>{action}</div>}
  </div>
);

export default EmptyState;
