/*
 * Radio / RadioGroup — 单选
 *
 * RadioGroup props:
 *   value:    当前选中
 *   onChange: 选中回调
 *   options:  [{ value, label, disabled? }]
 *   direction: row (默认) | column
 */

import { cn, FOCUS_RING } from '../tokens';

const Radio = ({ checked, onChange, disabled, label, name }) => (
  <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', disabled && 'cursor-not-allowed opacity-50')}>
    <button
      type='button'
      role='radio'
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.()}
      name={name}
      className={cn(
        'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border transition-colors shrink-0',
        checked ? 'border-ui-accent' : 'border-ui-border hover:border-ui-text-3',
        FOCUS_RING,
      )}
    >
      {checked && <span className='block w-2 h-2 rounded-full bg-ui-accent' />}
    </button>
    {label && <span className='text-sm text-ui-text'>{label}</span>}
  </label>
);

export const RadioGroup = ({ value, onChange, options = [], direction = 'row', name }) => (
  <div className={cn('flex gap-4', direction === 'column' && 'flex-col gap-2')}>
    {options.map((o) => (
      <Radio
        key={String(o.value)}
        name={name}
        label={o.label}
        disabled={o.disabled}
        checked={value === o.value}
        onChange={() => onChange?.(o.value)}
      />
    ))}
  </div>
);
