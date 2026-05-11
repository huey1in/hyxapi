/*
 * Skeleton — 统一骨架屏
 *
 * 使用：
 *   <Skeleton className='h-6 w-32' />
 *   <Skeleton variant='circle' className='w-10 h-10' />
 */

import React from 'react';
import { cn } from './tokens';

const VARIANT = {
  rect: 'rounded-md',
  text: 'rounded-md h-3',
  circle: 'rounded-full',
};

const Skeleton = ({ variant = 'rect', className }) => (
  <div
    className={cn(
      'animate-pulse bg-ui-bg-subtle',
      VARIANT[variant],
      className,
    )}
  />
);

export default Skeleton;
