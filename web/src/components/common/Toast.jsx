/*
Copyright (C) 2025 QuantumNous

Custom toast system. Replaces semi-ui's Toast and react-toastify.
Usage:
  toast.success('message')
  toast.error('message')
  toast.warning('message')
  toast.info('message')
  toast.dismiss(id)
*/

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const DEFAULT_DURATION = {
  success: 2500,
  info: 3000,
  warning: 3500,
  error: 5000,
};

let counter = 0;
let queue = [];
const listeners = new Set();
const emit = () => listeners.forEach((cb) => cb([...queue]));

const push = (message, type) => {
  if (!message) return null;
  const id = ++counter;
  queue = [...queue, { id, message: String(message), type }];
  emit();
  const duration = DEFAULT_DURATION[type] ?? 3000;
  if (duration > 0) setTimeout(() => dismiss(id), duration);
  return id;
};

const dismiss = (id) => {
  queue = queue.filter((t) => t.id !== id);
  emit();
};

export const toast = {
  success: (msg) => push(msg, 'success'),
  error:   (msg) => push(msg, 'error'),
  warning: (msg) => push(msg, 'warning'),
  info:    (msg) => push(msg, 'info'),
  dismiss,
};

export const ToastContainer = () => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    listeners.add(setItems);
    return () => listeners.delete(setItems);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className='fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none max-w-md'>
      {items.map((item) => (
        <div
          key={item.id}
          className='pointer-events-auto flex items-start gap-3 px-4 py-2.5 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg w-fit min-w-[220px] max-w-full text-sm text-ui-text animate-toast-in'
        >
          <span className='flex-1 leading-snug'>{item.message}</span>
          <button
            onClick={() => dismiss(item.id)}
            aria-label='close'
            className='p-0.5 -mr-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors flex-shrink-0 mt-0.5'
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default ToastContainer;
