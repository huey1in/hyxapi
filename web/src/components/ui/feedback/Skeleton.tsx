import type { CSSProperties } from 'react';
import { cn } from '../tokens';

interface SkeletonProps {
  shape?: 'rect' | 'circle' | 'line';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  count?: number;
  rounded?: string;
  className?: string;
}

export default function Skeleton({ shape = 'rect', width = '100%', height, count = 1, rounded, className }: SkeletonProps) {
  const radius = shape === 'circle' ? 'rounded-full' : shape === 'line' ? 'rounded-sm' : rounded || 'rounded-md';
  return <div aria-hidden='true' className={cn('min-w-0 space-y-2', className)} style={{ width, maxWidth: '100%' }}>
    {Array.from({ length: count }, (_, index) => <div key={index} data-skeleton=''
      className={cn('bg-ui-bg-subtle animate-pulse motion-reduce:animate-none', radius)}
      style={{ width: '100%', height: height ?? (shape === 'line' ? '0.75em' : shape === 'circle' ? width : '1rem') }} />)}
  </div>;
}
