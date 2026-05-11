/*
 * 全局命令式确认弹窗：
 *   import { showConfirm, ConfirmHost } from '@/components/business/confirm';
 *   showConfirm({ title, content, danger, onOk, onCancel, okText, cancelText });
 *
 * 在 App 根部挂一份 <ConfirmHost />。
 */

import React, { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../ui';

let externalShow = null;

export const showConfirm = (opts) => {
  if (typeof externalShow === 'function') externalShow(opts);
};

export const ConfirmHost = () => {
  const [stack, setStack] = useState([]);

  useEffect(() => {
    externalShow = (opts) => setStack((s) => [...s, { id: Math.random().toString(36).slice(2), ...opts }]);
    return () => { externalShow = null; };
  }, []);

  if (stack.length === 0) return null;
  return stack.map((item) => (
    <ConfirmDialog
      key={item.id}
      open
      title={item.title}
      description={item.content || item.description}
      confirmText={item.okText || '确定'}
      cancelText={item.cancelText || '取消'}
      onConfirm={() => { item.onOk?.(); setStack((s) => s.filter((x) => x.id !== item.id)); }}
      onClose={() => { item.onCancel?.(); setStack((s) => s.filter((x) => x.id !== item.id)); }}
    />
  ));
};

export default ConfirmHost;
