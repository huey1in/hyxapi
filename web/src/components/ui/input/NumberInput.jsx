/*
 * NumberInput — 数字输入
 *
 * size:    sm | md (默认) | lg
 * min / max / step
 * invalid: 红边框
 *
 * 内部维护字符串 state，解决受控模式下删到一位数或输入过程中被父组件
 * 校验拦截导致无法继续编辑的问题。父组件的 onChange 只在值合法时触发。
 */

import React, { useEffect, useRef, useState } from 'react';
import { inputStyle, resolveWidth } from './Input';
import { cn } from '../tokens';

const NumberInput = React.forwardRef(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step,
    placeholder,
    invalid = false,
    disabled = false,
    size = 36,
    width,
    ...rest
  },
  ref,
) {
  // 内部字符串 state，保留用户正在输入的中间态
  const [display, setDisplay] = useState(value == null || value === '' ? '' : String(value));

  // 父组件 value 变化时同步（仅在非聚焦状态，避免覆盖用户正在输入的内容）
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) {
      setDisplay(value == null || value === '' ? '' : String(value));
    }
  }, [value]);

  const handle = (e) => {
    const raw = e.target.value;
    setDisplay(raw);
    if (raw === '') {
      if (typeof onChange === 'function') onChange('');
      return;
    }
    const num = Number(raw);
    if (!isNaN(num)) {
      if (typeof onChange === 'function') onChange(num);
    }
  };

  const s = inputStyle({ variant: 'admin', size });
  const w = resolveWidth(width);
  return (
    <input
      ref={ref}
      type='number'
      value={display}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handle}
      onFocus={() => { focused.current = true; }}
      onBlur={() => {
        focused.current = false;
        // 失焦时若为空或不合法，重置为父组件的 value
        if (display === '' || isNaN(Number(display))) {
          setDisplay(value == null || value === '' ? '' : String(value));
        }
      }}
      style={{ ...s.style, ...w.style }}
      className={cn(s.className, w.className, 'tabular-nums', invalid && '!border-ui-danger')}
      {...rest}
    />
  );
});

export default NumberInput;
