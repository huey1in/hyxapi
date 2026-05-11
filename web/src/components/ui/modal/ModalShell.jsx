/*
 * ModalShell — 模态对话框底层容器
 *
 * 仅提供 backdrop / 居中 / scroll lock / esc / portal / 进出动画。
 *
 * open / onClose
 * maxWidth:  number(px) | CSS string，默认 500
 * maxHeight: 默认 'calc(100vh - 32px)'
 * closeOnBackdrop: 默认 true
 * blockScroll:     默认 true
 * zIndex:          默认 200
 * variant:    body-shell | flush（默认 flush）
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../tokens';
import useExitTransition from './useExitTransition';

const ModalShell = ({
  open,
  onClose,
  maxWidth = 500,
  maxHeight = 'calc(100vh - 32px)',
  closeOnBackdrop = true,
  blockScroll = true,
  zIndex = 200,
  variant = 'flush',
  children,
}) => {
  const downOnBackdropRef = useRef(false);
  const { mounted, exiting } = useExitTransition(open, 200);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    let original;
    if (blockScroll) {
      original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      if (blockScroll) document.body.style.overflow = original;
    };
  }, [open, onClose, blockScroll]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn('fixed inset-0 flex items-center justify-center p-4', exiting ? 'animate-overlay-out' : 'animate-overlay-in')}
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', zIndex }}
      onMouseDown={(e) => { downOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => {
        if (!closeOnBackdrop) return;
        if (downOnBackdropRef.current && e.target === e.currentTarget) onClose?.();
        downOnBackdropRef.current = false;
      }}
    >
      <div
        className={cn(
          'bg-[var(--page-bg)] border border-ui-border rounded-2xl shadow-2xl w-full overflow-hidden',
          variant === 'body-shell' && 'p-6',
          exiting ? 'animate-modal-out' : 'animate-modal-in',
        )}
        style={{ maxWidth, maxHeight }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default ModalShell;
