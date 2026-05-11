/*
 * ModalDialog — token-system centered modal for CRUD forms.
 * 内部基于 ui/ModalShell。
 */
import React from 'react';
import { X } from 'lucide-react';
import { Button, IconButton, ModalShell } from '../ui';

const ModalDialog = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 500,
  loading = false,
  hideFooter = false,
}) => (
  <ModalShell open={open} onClose={onClose} maxWidth={width}>
    <div className='flex items-center justify-between px-6 pt-5 pb-4 border-b border-ui-border'>
      <h3 className='text-base font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>
        {title}
      </h3>
      <IconButton icon={X} onClick={onClose} aria-label='close' />
    </div>

    <div className='px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4'>
      {children}
    </div>

    {!hideFooter && (
      <div className='flex justify-end gap-2.5 px-6 py-4 border-t border-ui-border'>
        {footer || (
          <>
            <Button variant='secondary' onClick={onClose}>取消</Button>
            <Button variant='primary' loading={loading} onClick={onClose}>确定</Button>
          </>
        )}
      </div>
    )}
  </ModalShell>
);

export default ModalDialog;
