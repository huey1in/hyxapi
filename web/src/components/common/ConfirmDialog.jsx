/*
 * Confirm dialog (used for delete confirmations etc).
 *
 * Two ways to use:
 *
 * 1. Component form (controlled):
 *      <ConfirmDialog open={...} title="..." onConfirm={...} onCancel={...} />
 *
 * 2. Imperative API (replacement for Semi's Modal.confirm). Mount <ConfirmHost />
 *    once near the app root, then call showConfirm({ title, content, danger, onOk }).
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

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
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onCancel}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='px-6 pt-6 pb-4'>
          <h3
            className='flex items-center gap-2 text-lg font-semibold text-ui-text mb-2'
            style={{ letterSpacing: '-0.02em' }}
          >
            {danger && <AlertTriangle size={18} className='text-ui-danger' />}
            {title}
          </h3>
          {description && (
            <p className='text-sm text-ui-text-2 leading-relaxed mt-2'>{description}</p>
          )}
        </div>
        <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-ui-border'>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
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

// ── imperative API ──────────────────────────────────────

let setHost = null;
const buffered = [];

export const showConfirm = (options) => {
  const item = { id: Date.now() + Math.random(), ...options };
  if (setHost) setHost((prev) => [...prev, item]);
  else buffered.push(item);
};

export const ConfirmHost = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setHost = setItems;
    if (buffered.length) setItems((p) => [...p, ...buffered.splice(0)]);
    return () => {
      setHost = null;
    };
  }, []);

  const close = (id) => setItems((p) => p.filter((x) => x.id !== id));

  return items.map((it) => (
    <ConfirmDialog
      key={it.id}
      open
      title={it.title}
      description={it.content}
      confirmText={it.okText || '确认'}
      cancelText={it.cancelText || '取消'}
      danger={it.danger}
      onCancel={() => close(it.id)}
      onConfirm={async () => {
        try {
          await it.onOk?.();
        } finally {
          close(it.id);
        }
      }}
    />
  ));
};

export default ConfirmDialog;
