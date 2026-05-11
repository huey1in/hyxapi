/*
 * Checkbox — 统一复选框
 *
 * 使用：
 *   <Checkbox checked={v} onChange={setV} />
 *   <Checkbox checked={v} onChange={setV} label='选项' />
 */

import React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn, FOCUS_RING } from './tokens';

const Checkbox = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  className,
}) => {
  const isOn = checked || indeterminate;
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0',
          isOn
            ? 'bg-ui-accent border-ui-accent text-ui-accent-fg'
            : 'bg-transparent border-ui-border',
          FOCUS_RING,
        )}
      >
        <input
          type='checkbox'
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className='absolute inset-0 opacity-0 cursor-inherit'
        />
        {indeterminate ? (
          <Minus size={12} strokeWidth={3} />
        ) : (
          checked && <Check size={12} strokeWidth={3} />
        )}
      </span>
      {label && <span className='text-sm text-ui-text'>{label}</span>}
    </label>
  );
};

export default Checkbox;
