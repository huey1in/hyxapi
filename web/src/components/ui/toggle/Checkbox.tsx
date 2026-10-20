/*
 * Checkbox — 复选框
 *
 * size: sm | md (默认)
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';

const SIZE = { sm: 'w-4 h-4', md: 'w-[18px] h-[18px]' };
const ICON = { sm: 10, md: 12 };

export interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'> {
  checked?: boolean; indeterminate?: boolean; onChange?: (checked: boolean) => void;
  size?: keyof typeof SIZE; label?: ReactNode;
}

const Checkbox = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  size = 'md',
  label,
  'aria-label': ariaLabel,
  ...rest
}: CheckboxProps) => {
  const inner = (
    <button
      {...rest}
      type='button'
      role='checkbox'
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(indeterminate ? true : !checked)}
      className={cn(
        'inline-flex items-center justify-center rounded-md border transition-colors shrink-0',
        SIZE[size],
        checked || indeterminate
          ? 'bg-ui-accent border-ui-accent text-ui-accent-fg'
          : 'bg-transparent border-ui-border hover:border-ui-text-3',
        FOCUS_RING,
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {indeterminate ? <Minus size={ICON[size]} /> : checked ? <Check size={ICON[size]} /> : null}
    </button>
  );
  if (!label) return inner;
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', disabled && 'cursor-not-allowed opacity-50')}>
      {inner}
      <span className='text-sm text-ui-text'>{label}</span>
    </label>
  );
};

export default Checkbox;
