/*
 * Radio / RadioGroup — 统一单选
 *
 * 使用：
 *   <RadioGroup value={v} onChange={setV} options={[{value, label}]} />
 *   或者单独使用 Radio
 */

import React from 'react';
import { cn, FOCUS_RING } from './tokens';

export const Radio = ({ checked, onChange, disabled, label, name, value, className }) => (
  <label
    className={cn(
      'inline-flex items-center gap-2 cursor-pointer select-none',
      disabled && 'opacity-50 cursor-not-allowed',
      className,
    )}
  >
    <span
      className={cn(
        'relative inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors flex-shrink-0',
        checked ? 'border-ui-accent' : 'border-ui-border',
        FOCUS_RING,
      )}
    >
      <input
        type='radio'
        name={name}
        value={value}
        checked={!!checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className='absolute inset-0 opacity-0 cursor-inherit'
      />
      {checked && <span className='w-2 h-2 rounded-full bg-ui-accent' />}
    </span>
    {label && <span className='text-sm text-ui-text'>{label}</span>}
  </label>
);

export const RadioGroup = ({ value, onChange, options = [], disabled, name, className }) => (
  <div className={cn('flex flex-wrap items-center gap-3', className)}>
    {options.map((o) => {
      const opt = typeof o === 'string' ? { value: o, label: o } : o;
      return (
        <Radio
          key={String(opt.value)}
          name={name}
          value={opt.value}
          label={opt.label}
          checked={opt.value === value}
          disabled={disabled || opt.disabled}
          onChange={onChange}
        />
      );
    })}
  </div>
);

export default Radio;
