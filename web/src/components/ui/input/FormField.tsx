import { Children, cloneElement, isValidElement, useId } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../tokens';

type Props = PropsWithChildren<{
  label: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
  compact?: boolean;
}>;

export default function FormField({ label, hint, wide = false, compact = false, children }: Props) {
  const generatedId = useId();
  const child = Children.count(children) === 1 && isValidElement<{ id?: string }>(children) ? children : null;
  const id = child?.props.id ?? generatedId;
  return <div className='flex w-full min-w-0 items-start justify-between gap-3'>
    <div className='min-w-0 flex-1 space-y-1.5 pt-2'>
      <label htmlFor={id} className='block text-sm text-ui-text break-words'>{label}</label>
      {hint && <p className='text-xs text-ui-text-3 break-words'>{hint}</p>}
    </div>
    <div className={cn(
      'flex min-w-0 shrink-0 justify-end',
      compact ? 'flex min-h-9 items-center justify-end' : wide
        ? 'w-[min(320px,calc(100%_-_88px))]'
        : 'w-[min(220px,calc(100%_-_88px))]',
    )}>
      {child ? cloneElement(child, { id }) : children}
    </div>
  </div>;
}
