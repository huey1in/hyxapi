/*
 * ModalDialog — token-system centered modal for CRUD forms.
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';

const ModalDialog = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 500,
  loading = false,
  hideFooter = false,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[200] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full overflow-hidden'
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-5 pt-4 pb-3 border-b border-ui-divider'>
          <h3 className='text-sm font-semibold text-ui-text'>{title}</h3>
          <button
            onClick={onClose}
            className='w-7 h-7 inline-flex items-center justify-center rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className='px-5 py-4 max-h-[70vh] overflow-y-auto space-y-3'>
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && (
          <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-divider'>
            {footer || (
              <>
                <button
                  onClick={onClose}
                  className='px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'
                >
                  取消
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className='inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
                >
                  {loading && <Loader2 size={11} className='animate-spin' />}
                  确定
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ModalDialog;
