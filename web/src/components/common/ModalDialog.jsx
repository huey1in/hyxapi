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
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full overflow-hidden'
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 pt-5 pb-4 border-b border-ui-border'>
          <h3
            className='text-base font-semibold text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className='w-8 h-8 inline-flex items-center justify-center rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className='px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4'>
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && (
          <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-ui-border'>
            {footer || (
              <>
                <button
                  onClick={onClose}
                  className='px-4 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'
                >
                  取消
                </button>
                <button
                  onClick={onClose}
                  disabled={loading}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
                >
                  {loading && <Loader2 size={14} className='animate-spin' />}
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
