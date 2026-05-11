/*
 * NumberInput — 数字输入
 *
 * size:    sm | md (默认) | lg
 * min / max / step
 * invalid: 红边框
 */

import React from 'react';
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
  const handle = (e) => {
    if (typeof onChange === 'function') onChange(e.target.value === '' ? '' : Number(e.target.value));
  };
  const s = inputStyle({ variant: 'admin', size });
  const w = resolveWidth(width);
  return (
    <input
      ref={ref}
      type='number'
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handle}
      style={{ ...s.style, ...w.style }}
      className={cn(s.className, w.className, 'tabular-nums', invalid && '!border-ui-danger')}
      {...rest}
    />
  );
});

export default NumberInput;
