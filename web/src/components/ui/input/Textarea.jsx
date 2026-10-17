/*
 * Textarea — 多行文本输入
 *
 * size:        sm | md (默认) | lg
 * rows:        默认 3
 * autoResize:  true 时根据内容自动调高
 * invalid:     红边框
 * footer:      可选 ReactNode；渲染在 textarea 同一边框内的底部（聊天 toolbar 模式）
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
    footer,
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
  const { height: _h, ...flatStyle } = s.style;

  const inner = (
    <textarea
      ref={setRef}
      value={value ?? ''}
      rows={rows}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      style={footer
        ? { paddingLeft: flatStyle.paddingLeft, paddingRight: flatStyle.paddingRight, paddingTop: 10, paddingBottom: 6, fontSize: flatStyle.fontSize, backgroundColor: 'transparent' }
        : { ...flatStyle, paddingTop: 8, paddingBottom: 8 }}
      className={footer
        ? 'block w-full resize-none border-0 outline-hidden focus:ring-0 text-ui-text-1 placeholder:text-ui-text-3'
        : cn(s.className, 'resize-none', invalid && '!border-ui-danger')}
      {...rest}
    />
  );

  if (footer) {
    return (
      <div
        style={w.style}
        className={cn(
          'rounded-xl border bg-transparent transition-colors',
          invalid ? 'border-ui-danger' : 'border-ui-border focus-within:border-ui-text-3',
          w.className,
        )}
      >
        {inner}
        <div className='px-2 pb-2'>{footer}</div>
      </div>
    );
  }

  return React.cloneElement(inner, { style: { ...inner.props.style, ...w.style }, className: cn(inner.props.className, w.className) });
});

export default Textarea;

