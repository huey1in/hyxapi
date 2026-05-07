/*
 * SlideOver — token-system right/left slide-in panel.
 * Drop-in shell for replacing Semi UI's SideSheet on screens with heavy
 * existing form content we don't want to fully rewrite.
 */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

const SlideOver = ({
  open,
  onClose,
  title,
  headerExtra,
  footer,
  width = 600,
  placement = 'right',
  children,
  bodyClass = '',
}) => {
  const location = useLocation();
  const initialPathRef = useRef(null);

  useEffect(() => {
    if (!open) {
      initialPathRef.current = null;
      return;
    }
    if (initialPathRef.current === null) {
      initialPathRef.current = location.pathname;
    } else if (initialPathRef.current !== location.pathname) {
      // URL changed while modal was open — auto-close so navigation isn't
      // visually swallowed by a stale slide-over.
      onClose?.();
      return;
    }
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = ov;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, location.pathname]);

  if (!open || typeof document === 'undefined') return null;

  const side = placement === 'left' ? 'left-0' : 'right-0';
  const animFrom = placement === 'left' ? '-translate-x-full' : 'translate-x-full';

  return createPortal(
    <>
      <div
        className='fixed inset-0 z-[110] animate-fade'
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 bottom-0 ${side} z-[120] flex flex-col bg-ui-bg-elevated border-${placement === 'left' ? 'r' : 'l'} border-ui-border shadow-2xl animate-slide-in`}
        style={{ width: `min(${width}px, 100vw)`, animation: `slide-in-${placement} 0.2s ease-out` }}
      >
        <style>{`
          @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-6 py-4 border-b border-ui-border flex-shrink-0'>
          <div className='flex items-center gap-2 min-w-0 flex-1'>{title}</div>
          <div className='flex items-center gap-2 flex-shrink-0'>
            {headerExtra}
            <button
              onClick={onClose}
              className='p-1.5 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto ${bodyClass}`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className='flex items-center justify-end gap-2.5 px-6 py-4 border-t border-ui-border flex-shrink-0'>
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
};

export default SlideOver;
