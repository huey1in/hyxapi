/*
 * Toast — 浮层通知（通过 showToast 命令式调用）
 *
 * 用法：
 *   import { showToast, ToastContainer } from '...';
 *   <ToastContainer /> (放在根组件)
 *   showToast({ message: '保存成功', type: 'success' });
 *
 * 类型：
 *   info (默认) | success | warning | error
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '../tokens';

let externalEnqueue = null;
let counter = 0;

export function showToast({ message, type = 'info', duration = 3000 }) {
  if (typeof externalEnqueue === 'function') {
    externalEnqueue({ message, type, duration });
  }
}
export const showSuccess = (message, opts = {}) => showToast({ ...opts, message, type: 'success' });
export const showError   = (message, opts = {}) => showToast({ ...opts, message, type: 'error' });
export const showInfo    = (message, opts = {}) => showToast({ ...opts, message, type: 'info' });
export const showWarning = (message, opts = {}) => showToast({ ...opts, message, type: 'warning' });

const TYPE_ICON = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

export const ToastContainer = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    externalEnqueue = ({ message, type, duration }) => {
      const id = ++counter;
      setItems((s) => [...s, { id, message, type }]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), duration);
    };
    return () => { externalEnqueue = null; };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className='fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none max-w-md'>
      {items.map((item) => {
        const Icon = TYPE_ICON[item.type] || Info;
        return (
          <div
            key={item.id}
            className='pointer-events-auto group flex items-center gap-2.5 px-3 py-2 rounded-xl bg-ui-accent text-ui-accent-fg shadow-lg w-fit min-w-[220px] max-w-full text-sm animate-toast-in'
          >
            <Icon size={14} className='flex-shrink-0 opacity-80' />
            <span className='flex-1 leading-snug truncate'>{item.message}</span>
            <button
              onClick={() => setItems((s) => s.filter((i) => i.id !== item.id))}
              className='inline-flex items-center justify-center w-5 h-5 rounded-md opacity-50 hover:opacity-100 hover:bg-white/15 transition flex-shrink-0'
              aria-label='close'
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
};

export default ToastContainer;
