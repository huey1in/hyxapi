/*
 * ConfirmDialog — 简洁确认弹窗
 *
 * open / onClose
 * title:       node
 * description: node
 * onConfirm:   确认回调
 * confirmText / cancelText
 */

import ModalShell from './ModalShell';
import Button from '../button/Button';

const ConfirmDialog = ({
  open,
  onClose,
  title,
  description,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
  loading = false,
  closeOnConfirm = true,
}) => (
  <ModalShell open={open} onClose={onClose} maxWidth={400}>
    <div className='p-6 space-y-3'>
      {title && (
        <h3 className='text-base font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>
          {title}
        </h3>
      )}
      {description && (
        <p className='text-sm text-ui-text-2 leading-relaxed'>{description}</p>
      )}
    </div>
    <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-ui-border'>
      <Button onClick={onClose}>{cancelText}</Button>
      <Button
        loading={loading}
        onClick={() => { onConfirm?.(); if (closeOnConfirm) onClose?.(); }}
      >
        {confirmText}
      </Button>
    </div>
  </ModalShell>
);

export default ConfirmDialog;
