/*
 * Switch — 滑块开关
 *
 * size:    sm (32x18) | md (44x24, 默认) | lg (52x28)
 * checked: 当前状态
 * onChange(next): 翻转回调
 */

import React from 'react';
import { cn, FOCUS_RING } from '../tokens';

const SIZES = {
  sm: { track: 'w-8 h-[18px] p-[2px]',   thumb: 'w-[14px] h-[14px]', on: 'translate-x-[14px]' },
  md: { track: 'w-11 h-6 p-[3px]',       thumb: 'w-[18px] h-[18px]', on: 'translate-x-5' },
  lg: { track: 'w-[52px] h-7 p-[3px]',   thumb: 'w-[22px] h-[22px]', on: 'translate-x-6' },
};

const Switch = React.forwardRef(function Switch(
  { checked = false, onChange, disabled = false, size = 'md', 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const s = SIZES[size] || SIZES.md;
  return (
    <button
      ref={ref}
      type='button'
      role='switch'
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        'relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200',
        s.track,
        checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle',
        !checked && 'ring-1 ring-inset ring-ui-border',
        FOCUS_RING,
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_1px_3px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out',
          s.thumb,
          checked ? s.on : 'translate-x-0',
        )}
      />
    </button>
  );
});

export default Switch;
