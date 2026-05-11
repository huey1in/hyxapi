/*
 * Toggle — 统一开关
 *
 * 使用：
 *   <Toggle checked={v} onChange={setV} />
 *   <Toggle checked={v} onChange={setV} size='sm' disabled />
 */

import React from 'react';
import { cn, FOCUS_RING } from './tokens';

const SIZE = {
  sm: { track: 'h-4 w-7', thumb: 'h-3 w-3', translate: 'translate-x-3', start: 'translate-x-0.5' },
  md: { track: 'h-5 w-8', thumb: 'h-4 w-4', translate: 'translate-x-[14px]', start: 'translate-x-0.5' },
  lg: { track: 'h-6 w-10', thumb: 'h-5 w-5', translate: 'translate-x-[18px]', start: 'translate-x-0.5' },
};

const Toggle = ({ checked, onChange, disabled = false, size = 'md', className }) => {
  const s = SIZE[size];
  return (
    <button
      type='button'
      role='switch'
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex items-center rounded-full transition-colors flex-shrink-0',
        s.track,
        checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border',
        disabled && 'opacity-50 cursor-not-allowed',
        FOCUS_RING,
        className,
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full transition-transform shadow',
          s.thumb,
          checked ? s.translate : s.start,
        )}
        style={{ background: '#ffffff' }}
      />
    </button>
  );
};

export default Toggle;
