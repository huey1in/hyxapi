/*
 * ModalShell — 模态对话框的底层容器（仅提供 backdrop / 居中 / scroll lock / esc / portal）
 *
 * 业务方应优先用 `ModalDialog`（已包含 header/body/footer 标准结构）。
 * 仅当需要完全自定义模态内容（如 LoginModal、CodexOAuthModal、ModelTestModal
 * 这种带 sticky header / 复杂 flex 布局）时才用 ModalShell。
 *
 * 严禁业务方直接写 `bg-ui-bg-elevated rounded-2xl shadow-2xl ...` 自造模态面板。
 *
 * Props:
 *   open       是否显示
 *   onClose    关闭回调（点遮罩、按 ESC）
 *   maxWidth   面板最大宽度（数字 px 或 CSS 字符串），默认 500
 *   maxHeight  面板最大高度（默认 'calc(100vh - 32px)'）
 *   className  额外的面板布局类（仅允许 flex/min-h/max-w 等布局类，禁止 border/bg/radius/shadow）
 *   children   面板内容（业务方自己决定 header/body/footer 结构）
 *   closeOnBackdrop  默认 true
 *   blockScroll      默认 true
 *   zIndex     默认 200
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './tokens';

const ModalShell = ({
  open,
  onClose,
  maxWidth = 500,
  maxHeight = 'calc(100vh - 32px)',
  className,
  children,
  closeOnBackdrop = true,
  blockScroll = true,
  zIndex = 200,
}) => {
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

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', zIndex }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={cn(
          'bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full overflow-hidden',
          className,
        )}
        style={{ maxWidth, maxHeight }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default ModalShell;
