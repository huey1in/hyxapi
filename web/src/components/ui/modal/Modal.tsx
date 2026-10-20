/*
 * Modal — 标准对话框（header + scroll body + footer）
 *
 * open / onClose
 * title:    string | node
 * width:    默认 500
 * loading:  primary 按钮 loading
 * hideFooter: 不渲染默认 footer
 * footer:   覆盖默认 footer 内容（取消/确定）
 * onConfirm: 默认 footer 主按钮回调
 * confirmText / cancelText
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { X } from 'lucide-react';
import ModalShell from './ModalShell';
import IconButton from '../button/IconButton';
import Button from '../button/Button';

type Props = PropsWithChildren<{ open?: boolean; onClose: () => void; title?: ReactNode; footer?: ReactNode; width?: number; loading?: boolean; hideFooter?: boolean; onConfirm?: () => unknown; confirmText?: string; cancelText?: string }>;

const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 500,
  loading = false,
  hideFooter = false,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
}: Props) => (
  <ModalShell open={open} onClose={onClose} maxWidth={width}>
    <div className='flex items-center justify-between px-6 pt-5 pb-3'>
      <h3 className='text-base font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      <IconButton icon={X} onClick={onClose} aria-label='close' />
    </div>

    <div className='px-6 py-2 max-h-[70vh] overflow-y-auto space-y-4 ui-scrollbar'>
      {children}
    </div>

    {!hideFooter && (
      <div className='flex justify-end gap-2.5 px-6 pt-3 pb-4'>
        {footer || (
          <>
            <Button onClick={onClose}>{cancelText}</Button>
            <Button loading={loading} onClick={onConfirm || onClose}>
              {confirmText}
            </Button>
          </>
        )}
      </div>
    )}
  </ModalShell>
);

export default Modal;
