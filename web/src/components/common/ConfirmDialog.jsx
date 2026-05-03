/*
 * Confirm dialog (used for delete confirmations etc).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onCancel?.();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[200] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='px-5 pt-5 pb-3'>
          <h3 className='text-base font-semibold text-ui-text mb-1.5'>{title}</h3>
          {description && (
            <p className='text-sm text-ui-text-2 leading-relaxed'>{description}</p>
          )}
        </div>
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <button
            onClick={onCancel}
            className='px-3.5 py-1.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              danger
                ? 'bg-ui-danger text-white hover:opacity-90'
                : 'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmDialog;
