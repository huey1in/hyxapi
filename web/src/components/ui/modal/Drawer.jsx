/*
 * Drawer — 顶/底/左/右滑入大面板（非模态、可选 backdrop）
 *
 * placement: top | bottom | left | right (默认)
 * size:      宽（左右）或高（上下），默认 320
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../tokens';
import IconButton from '../button/IconButton';
import useExitTransition from './useExitTransition';

const PLACEMENT = {
  top:    { container: 'top-0 left-0 right-0',    sizeKey: 'height' },
  bottom: { container: 'bottom-0 left-0 right-0', sizeKey: 'height' },
  left:   { container: 'top-0 bottom-0 left-0',   sizeKey: 'width' },
  right:  { container: 'top-0 bottom-0 right-0',  sizeKey: 'width' },
};

const Drawer = ({
  open,
  onClose,
  placement = 'right',
  size = 320,
  title,
  showBackdrop = true,
  children,
}) => {
  const { mounted, exiting } = useExitTransition(open, 220);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;
  const p = PLACEMENT[placement];

  return createPortal(
    <div className='fixed inset-0 z-[200]'>
      {showBackdrop && (
        <div
          className={cn('absolute inset-0 bg-black/30', exiting ? 'animate-overlay-out' : 'animate-overlay-in')}
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'absolute bg-[var(--page-bg)] shadow-2xl flex flex-col',
          p.container,
          exiting ? `animate-slide-out-${placement}` : `animate-slide-in-${placement}`,
        )}
        style={{ [p.sizeKey]: size }}
      >
        {title && (
          <div className='flex items-center justify-between gap-3 px-5 pt-4 pb-2 flex-shrink-0'>
            <div className='text-base font-semibold text-ui-text'>{title}</div>
            <IconButton icon={X} onClick={onClose} aria-label='close' />
          </div>
        )}
        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Drawer;
