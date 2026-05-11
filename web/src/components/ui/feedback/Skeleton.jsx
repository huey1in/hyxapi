/*
 * Skeleton — 占位骨架
 *
 * shape:  rect (默认) | circle | line（单行文字）
 * width / height: CSS 字符串
 * count:  rect 模式下重复几条（间距 8px）
 */

import React from 'react';
import { cn } from '../tokens';

const Skeleton = ({
  shape = 'rect',
  width = '100%',
  height,
  count = 1,
  rounded,
}) => {
  const base = 'bg-ui-bg-subtle animate-pulse';
  const radius =
    shape === 'circle' ? 'rounded-full'
    : shape === 'line' ? 'rounded'
    : rounded || 'rounded-md';

  const h = height || (shape === 'line' ? '0.75em' : shape === 'circle' ? width : '1rem');
  const w = shape === 'circle' ? width : width;

  const items = Array.from({ length: count });
  return (
    <div className='space-y-2'>
      {items.map((_, i) => (
        <div key={i} className={cn(base, radius)} style={{ width: w, height: h }} />
      ))}
    </div>
  );
};

export default Skeleton;
