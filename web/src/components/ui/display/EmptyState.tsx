/*
 * EmptyState — 空状态占位
 *
 * icon:        lucide 组件
 * title:       node
 * description: node
 * action:      节点（通常是个 Button）
 */

import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../tokens';

interface EmptyStateProps { icon?: LucideIcon | null; title?: ReactNode; description?: ReactNode; action?: ReactNode; padding?: 'lg' | 'md' | 'sm' }
const EmptyState = ({ icon: Icon = Inbox, title, description, action, padding = 'lg' }: EmptyStateProps) => (
  <div className={cn(
    'flex flex-col items-center justify-center text-center text-ui-text-3',
    padding === 'lg' && 'py-16',
    padding === 'md' && 'py-10',
    padding === 'sm' && 'py-6',
  )}>
    {Icon && (
      <div className='w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center mb-3'>
        <Icon size={20} />
      </div>
    )}
    {title && <div className='text-sm text-ui-text-2 font-medium mb-1'>{title}</div>}
    {description && <div className='text-xs text-ui-text-3 max-w-sm leading-relaxed'>{description}</div>}
    {action && <div className='mt-4'>{action}</div>}
  </div>
);

export default EmptyState;
