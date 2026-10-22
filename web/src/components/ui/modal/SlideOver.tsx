/*
 * SlideOver — 侧滑面板
 *
 * open / onClose
 * placement:  right (默认) | left
 * 宽度统一为 480px，屏幕不足时填满可用宽度。
 * title:      node
 * headerExtra: 标题区右侧额外节点
 * footer:     底部固定操作区
 */

import { useEffect } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../tokens';
import IconButton from '../button/IconButton';
import useExitTransition from './useExitTransition';
import { sidePanelStyle } from './side-panel';

type Props = PropsWithChildren<{ open: boolean; onClose?: () => void; placement?: 'left' | 'right'; title?: ReactNode; headerExtra?: ReactNode; footer?: ReactNode }>;

const SlideOver = ({
  open,
  onClose,
  placement = 'right',
  title,
  headerExtra,
  footer,
  children,
}: Props) => {
  const { mounted, exiting } = useExitTransition(open, 220);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  const side = placement === 'left' ? 'left-0' : 'right-0';

  return createPortal(
    <div className='fixed inset-0 z-[200]'>
      <div
        className={cn('absolute inset-0 bg-black/45 backdrop-blur-[2px]', exiting ? 'animate-overlay-out' : 'animate-overlay-in')}
        onClick={onClose}
      />
      <div
        data-side-panel
        className={cn(
          'absolute top-0 bottom-0 min-w-0 bg-[var(--page-bg)] shadow-2xl flex flex-col',
          side,
          exiting
            ? (placement === 'left' ? 'animate-slide-out-left' : 'animate-slide-out-right')
            : (placement === 'left' ? 'animate-slide-in-left'  : 'animate-slide-in-right'),
        )}
        style={sidePanelStyle}
      >
        <div className='flex items-center justify-between gap-3 px-4 md:px-6 pt-5 pb-3 shrink-0'>
          <div className='flex items-center gap-2 min-w-0 flex-1 [overflow-wrap:anywhere]'>{title}</div>
          <div className='flex items-center gap-2 shrink-0'>
            {headerExtra}
            <IconButton icon={X} onClick={onClose} aria-label='close' />
          </div>
        </div>
        <div className='min-h-0 min-w-0 flex-1 overflow-y-auto'>{children}</div>
        {footer && (
          <div className='flex min-w-0 flex-wrap items-center justify-end gap-2 px-4 md:px-6 pt-3 pb-4 shrink-0'>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SlideOver;
