/*
 * Slider — 单值滑块
 *
 * value:    number
 * onChange: (next) => void
 * min / max / step
 * showLabel: 右侧显示数值
 * width:    见 resolveWidth；默认 240
 */

import { cn } from '../tokens';
import { resolveWidth } from './Input';

const Slider = ({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showLabel = false,
  width,
}) => {
  const w = resolveWidth(width);
  return (
    <div className={cn('inline-flex items-center gap-3', w.className)} style={w.style}>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className='ui-slider flex-1'
      />
      {showLabel && <span className='text-xs text-ui-text-2 tabular-nums w-9 text-right'>{value}</span>}
    </div>
  );
};

export default Slider;
