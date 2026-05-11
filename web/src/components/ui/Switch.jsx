/*
 * Switch — 滑块开关（不是按钮组件的视觉，是滑块）
 *
 * size: sm (32x18) | md (40x22)
 *
 * 业务方禁止自己写滑块 className，所有开关用此组件。
 */

import React from 'react';
import { cn, FOCUS_RING } from './tokens';

const SIZE_TRACK = {
  sm: 'w-8 h-[18px]',
  md: 'w-10 h-[22px]',
};

const SIZE_THUMB = {
  sm: 'w-[14px] h-[14px]',
  md: 'w-[18px] h-[18px]',
};

const TRANSLATE = {
  sm: 'translate-x-[14px]',
  md: 'translate-x-[18px]',
};

const Switch = React.forwardRef(function Switch(
  { checked = false, onChange, disabled = false, size = 'md', className, 'aria-label': ariaLabel, ...rest },
  ref,
) {
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
        'relative inline-flex items-center flex-shrink-0 rounded-full transition-colors',
        SIZE_TRACK[size],
        checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border',
        FOCUS_RING,
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform',
          SIZE_THUMB[size],
          checked ? TRANSLATE[size] : 'translate-x-[2px]',
        )}
      />
    </button>
  );
});

export default Switch;
