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
 *
 * 设计：暖色极简。右上角堆叠，中性卡片底（CSS 变量驱动深色模式），
 *       语义色仅用于左侧图标与一条细色条，不做整片彩色填充。
 */

import { useEffect, useState, useCallback } from 'react';
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

// 语义色仅用于图标和细色条；不同主题下都清晰可辨。
const TYPE_CONFIG = {
  success: { Icon: CheckCircle2,  color: '#16a34a' },
  error:   { Icon: XCircle,       color: '#dc2626' },
  warning: { Icon: AlertTriangle, color: '#d97706' },
  info:    { Icon: Info,          color: '#6b7280' },
};

export const ToastContainer = () => {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    // 先标记退出，播放离场动画后再移除
    setItems((s) => s.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 160);
  }, []);

  useEffect(() => {
    externalEnqueue = ({ message, type, duration }) => {
      const id = ++counter;
      setItems((s) => [...s, { id, message, type, leaving: false }]);
      setTimeout(() => dismiss(id), duration);
    };
    return () => { externalEnqueue = null; };
  }, [dismiss]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
      ))}
    </div>,
    document.body,
  );
};

const ToastItem = ({ item, onDismiss }) => {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
  const { Icon, color } = config;

  return (
    <div
      className={item.leaving ? 'animate-toast-out' : 'animate-toast-in'}
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 12px 11px 14px',
        borderRadius: 14,
        background: 'var(--ui-bg-elevated)',
        border: '1px solid var(--ui-border)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
        minWidth: 240,
        maxWidth: 380,
      }}
    >
      <Icon size={17} style={{ color, flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--ui-text)',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}
      >
        {item.message}
      </span>
      <button
        onClick={onDismiss}
        className='transition-colors'
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 7, border: 'none', background: 'transparent',
          cursor: 'pointer', color: 'var(--ui-text-3)', flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-subtle)'; e.currentTarget.style.color = 'var(--ui-text-2)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ui-text-3)'; }}
        aria-label='close'
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default ToastContainer;
