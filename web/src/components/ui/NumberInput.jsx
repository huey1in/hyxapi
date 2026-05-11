/*
 * NumberInput — 统一数字输入
 *
 * 自动处理空值和数字转换
 *
 * 使用：
 *   <NumberInput value={n} onChange={setN} min={0} step={1} />
 */

import React from 'react';
import Input from './Input';

const NumberInput = React.forwardRef(function NumberInput(
  { value, onChange, min, max, step = 1, ...rest },
  ref,
) {
  const handleChange = (v) => {
    if (v === '' || v === null || v === undefined) {
      onChange?.(null);
      return;
    }
    const num = Number(v);
    if (Number.isNaN(num)) return;
    onChange?.(num);
  };

  return (
    <Input
      ref={ref}
      type='number'
      value={value ?? ''}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      {...rest}
    />
  );
});

export default NumberInput;
