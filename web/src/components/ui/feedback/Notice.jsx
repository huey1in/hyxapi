/*
 * Notice — 提示横幅
 *
 * kind:   info (默认) | success | warning | danger
 * icon:   override 左侧图标（默认按 kind 自动选）
 * title:  可选
 * action: 右侧节点
 */

import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../tokens';

const KIND = {
  info:    { Icon: Info,          color: 'text-ui-text-2' },
  success: { Icon: CheckCircle2,  color: 'text-ui-text-2' },
  warning: { Icon: AlertTriangle, color: 'text-ui-text-2' },
  danger:  { Icon: XCircle,       color: 'text-ui-text-2' },
};

const Notice = ({ kind = 'info', icon, title, children, action }) => {
  const k = KIND[kind] || KIND.info;
  const Icon = icon || k.Icon;
  return (
    <div className='flex items-start gap-3 px-4 py-3 rounded-2xl border border-ui-border bg-[var(--page-bg)]'>
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', k.color)} />
      <div className='flex-1 text-sm leading-relaxed text-ui-text-2 min-w-0'>
        {title && <div className='text-ui-text mb-0.5'>{title}</div>}
        {children}
      </div>
      {action && <div className='flex-shrink-0 ml-2'>{action}</div>}
    </div>
  );
};

export default Notice;
