/*
 * Textarea — 多行文本输入
 *
 * size:        sm | md (默认) | lg
 * rows:        默认 3
 * autoResize:  true 时根据内容自动调高
 * invalid:     红边框
 */

import React, { useEffect, useRef } from 'react';
import { cn } from '../tokens';
import { inputStyle, resolveWidth } from './Input';

const Textarea = React.forwardRef(function Textarea(
  {
    value,
    onChange,
    placeholder,
    rows = 3,
    autoResize = false,
    invalid = false,
    disabled = false,
    size = 36,
    width,
    ...rest
  },
  refExternal,
) {
  const internalRef = useRef(null);
  const setRef = (node) => {
    internalRef.current = node;
    if (typeof refExternal === 'function') refExternal(node);
    else if (refExternal) refExternal.current = node;
  };

  useEffect(() => {
    if (!autoResize) return;
    const el = internalRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 32)}px`;
  }, [value, autoResize]);

  const handleChange = (e) => {
    if (typeof onChange === 'function') onChange(e.target.value);
  };

  const s = inputStyle({ variant: 'admin', size });
  const w = resolveWidth(width);
  /* textarea 行高由 rows 决定，不锁死高度 */
  const { height: _h, ...flatStyle } = s.style;

  return (
    <textarea
      ref={setRef}
      value={value ?? ''}
      rows={rows}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...flatStyle, paddingTop: 8, paddingBottom: 8, ...w.style }}
      className={cn(
        s.className,
        w.className,
        'resize-none',
        invalid && '!border-ui-danger',
      )}
      {...rest}
    />
  );
});

export default Textarea;
