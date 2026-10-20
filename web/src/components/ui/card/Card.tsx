import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../tokens';

const VARIANT = { plain: 'border border-ui-border bg-[var(--page-bg)]', filled: 'bg-ui-bg-subtle' };
const INTERACTIVE = { hover: 'cursor-pointer hover:border-ui-text-3 hover:bg-ui-bg-subtle/40 transition-colors', lift: 'cursor-pointer hover:border-ui-text-3 hover:bg-ui-bg-subtle/40 hover:shadow-md transition-all' };
export interface CardProps extends HTMLAttributes<HTMLElement> { variant?: keyof typeof VARIANT; interactive?: keyof typeof INTERACTIVE; header?: ReactNode; footer?: ReactNode; disabled?: boolean }

const Card = forwardRef<HTMLDivElement | HTMLButtonElement, CardProps>(function Card(
  { children, variant = 'plain', interactive, onClick, header, footer, className, disabled, ...rest }, ref,
) {
  const hasSections = !!(header || footer);
  const setRef = (element: HTMLDivElement | HTMLButtonElement | null) => { if (typeof ref === 'function') ref(element); else if (ref) ref.current = element; };
  const style = cn(VARIANT[variant], 'rounded-2xl', !hasSections && 'p-4', 'overflow-hidden', interactive && INTERACTIVE[interactive], onClick && 'text-left w-full', className);
  const content = <>{header && <div className='px-4 pt-4'>{header}</div>}{hasSections ? <div className='p-4'>{children}</div> : children}{footer && <div className='px-4 pb-4'>{footer}</div>}</>;
  return onClick ? <button type='button' ref={setRef} onClick={onClick} disabled={disabled} className={style} {...rest}>{content}</button> : <div ref={setRef} className={style} {...rest}>{content}</div>;
});
export default Card;
