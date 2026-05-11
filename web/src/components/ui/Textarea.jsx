/*
 * Textarea — 统一多行文本输入
 *
 * 支持 autoResize：根据内容自动调整高度
 *
 * 使用：
 *   <Textarea value={v} onChange={setV} rows={3} />
 *   <Textarea autoResize maxHeight={260} />
 */

import React, { useEffect, useRef } from 'react';
import { cn } from './tokens';

const Textarea = React.forwardRef(function Textarea(
  {
    value,
    onChange,
    placeholder,
    rows = 3,
    autoResize = false,
    minHeight,
    maxHeight,
    invalid = false,
    disabled = false,
    className,
    ...rest
  },
  forwardedRef,
) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;

  const handleChange = (e) => {
    if (typeof onChange === 'function') {
      if (onChange.length === 1) onChange(e.target.value);
      else onChange(e.target.value, e);
    }
    if (autoResize && ref.current) {
      ref.current.style.height = 'auto';
      const newH = Math.min(ref.current.scrollHeight, maxHeight ?? Infinity);
      ref.current.style.height = `${newH}px`;
    }
  };

  useEffect(() => {
    if (autoResize && ref.current) {
      ref.current.style.height = 'auto';
      const newH = Math.min(ref.current.scrollHeight, maxHeight ?? Infinity);
      ref.current.style.height = `${newH}px`;
    }
  }, [autoResize, value, maxHeight, ref]);

  return (
    <textarea
      ref={ref}
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={{ minHeight, maxHeight }}
      className={cn(
        'w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-ui-text placeholder:text-ui-text-3 outline-none transition-colors resize-y',
        invalid ? 'border-ui-danger' : 'border-ui-border focus:border-ui-text-3',
        disabled && 'opacity-50 cursor-not-allowed',
        autoResize && 'resize-none overflow-hidden',
        className,
      )}
      {...rest}
    />
  );
});

export default Textarea;
