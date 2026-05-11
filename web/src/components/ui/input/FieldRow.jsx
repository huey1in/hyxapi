/*
 * FieldRow — 表单字段包装（label / hint / error）
 *
 * width: 控制整个字段（含 label 与 children）的宽度
 *   - undefined  默认 360px
 *   - 'full'     占满父容器
 *   - 数字 / CSS 字符串  原样作为 width
 */

import React from 'react';
import { resolveWidth } from './Input';

const FIELD_DEFAULT_WIDTH = 360;

const FieldRow = ({ label, required, hint, error, extra, children, width }) => {
  const w = resolveWidth(width === undefined ? FIELD_DEFAULT_WIDTH : width);
  return (
    <div style={w.style} className={w.className}>
      {(label || extra) && (
        <div className='flex items-center justify-between gap-2 mb-2'>
          {label && (
            <label className='block text-sm font-medium text-ui-text'>
              {label}
              {required && <span className='text-ui-danger ml-1'>*</span>}
            </label>
          )}
          {extra && <div className='flex items-center gap-1.5'>{extra}</div>}
        </div>
      )}
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && typeof child.type !== 'string' && child.props.width === undefined
          ? React.cloneElement(child, { width: 'full' })
          : child,
      )}
      {error && <p className='mt-1.5 text-xs text-ui-danger'>{error}</p>}
      {!error && hint && <p className='mt-1.5 text-xs text-ui-text-3 leading-relaxed'>{hint}</p>}
    </div>
  );
};

export default FieldRow;
