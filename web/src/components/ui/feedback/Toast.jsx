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

const TYPE_CONFIG = {
  success: { Icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error:   { Icon: XCircle,      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  warning: { Icon: AlertTriangle, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info:    { Icon: Info,          color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
};

const TYPE_CONFIG_DARK = {
  success: { color: '#4ade80', bg: '#14261a', border: '#1a3a24' },
  error:   { color: '#f87171', bg: '#2a1414', border: '#3a1a1a' },
  warning: { color: '#fbbf24', bg: '#2a2414', border: '#3a3018' },
  info:    { color: '#60a5fa', bg: '#141e2a', border: '#1a2a3a' },
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
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={() => setItems((s) => s.filter((i) => i.id !== item.id))} />
      ))}
    </div>,
    document.body,
  );
};

const ToastItem = ({ item, onDismiss }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  const darkConfig = TYPE_CONFIG_DARK[item.type] || TYPE_CONFIG_DARK.info;
  const { Icon } = config;
  const bg = isDark ? darkConfig.bg : config.bg;
  const border = isDark ? darkConfig.border : config.border;
  const color = isDark ? darkConfig.color : config.color;

  return (
    <div
      className='animate-toast-in'
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 14,
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        minWidth: 200,
        maxWidth: 400,
      }}
    >
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: isDark ? '#ebe8e0' : '#1a1a1a', lineHeight: 1.4 }}>
        {item.message}
      </span>
      <button
        onClick={onDismiss}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent',
          cursor: 'pointer', color: isDark ? '#807c70' : '#999', flexShrink: 0,
        }}
        aria-label='close'
      >
        <X size={12} />
      </button>
    </div>
  );
};

export default ToastContainer;
