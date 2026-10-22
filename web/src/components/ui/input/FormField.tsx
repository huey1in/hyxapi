import { Children, cloneElement, isValidElement, useId } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../tokens';

type Props = PropsWithChildren<{
  label: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
  compact?: boolean;
  inline?: boolean;
}>;

export default function FormField({ label, hint, wide = false, compact = false, inline = false, children }: Props) {
  const generatedId = useId();
  const child = Children.count(children) === 1 && isValidElement<{ id?: string }>(children) ? children : null;
  const id = child?.props.id ?? generatedId;
  return <div className={cn('min-w-0 items-start gap-3', inline ? 'inline-flex max-w-full' : 'flex w-full justify-between')}>
    <div className={cn('min-w-0 space-y-1.5 pt-2', inline ? 'shrink-0' : 'flex-1')}>
      <label htmlFor={id} className='block text-sm text-ui-text break-words'>{label}</label>
      {hint && <p className='text-xs text-ui-text-3 break-words'>{hint}</p>}
    </div>
    <div className={cn(
      'flex min-w-0',
      inline ? 'flex-1 [&>*]:min-w-0 [&>*]:max-w-full' : [
        'shrink-0 justify-end',
        compact ? 'min-h-9 items-center' : wide
          ? 'w-[min(320px,calc(100%_-_88px))]'
          : 'w-[min(220px,calc(100%_-_88px))]',
      ],
    )}>
      {child ? cloneElement(child, { id }) : children}
    </div>
  </div>;
}
