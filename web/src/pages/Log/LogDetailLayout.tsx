import type { PropsWithChildren, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function DetailContent({ children }: PropsWithChildren) {
  return <div className='min-w-0 space-y-4 pb-1'>{children}</div>;
}

export function DetailSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section aria-label={title} className='min-w-0 space-y-2 border-t border-ui-divider pt-4 first:border-t-0 first:pt-0'>
    <h4 className='text-sm font-semibold text-ui-text'>{title}</h4>
    {children}
  </section>;
}

export function DetailFields({ children }: PropsWithChildren) {
  return <dl className='grid min-w-0 grid-cols-1 gap-x-6 sm:grid-cols-2'>{children}</dl>;
}

export function DetailField({ label, value, mono = false, wide = false }: { label: string; value: ReactNode; mono?: boolean; wide?: boolean }) {
  return <div className={`grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-3 border-b border-ui-divider/60 py-2${wide ? ' sm:col-span-2 sm:grid-cols-[8rem_minmax(0,1fr)]' : ''}`}>
    <dt className='text-xs leading-5 text-ui-text-3'>{label}</dt>
    <dd className={`min-w-0 whitespace-pre-wrap text-sm leading-5 text-ui-text [overflow-wrap:anywhere]${mono ? ' font-mono text-xs' : ''}`}>{value}</dd>
  </div>;
}

export function DetailText({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <p className={`whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] ${error ? 'text-ui-danger' : 'text-ui-text'}`}>{children}</p>;
}

export function DetailCode({ title, value, collapsible = false }: { title: string; value: string; collapsible?: boolean }) {
  let display = value;
  try { display = JSON.stringify(JSON.parse(value), null, 2); } catch {}
  const code = <pre tabIndex={0} aria-label={title} className='max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ui-bg-subtle/60 p-3 font-mono text-xs leading-5 text-ui-text outline-offset-2 [overflow-wrap:anywhere] ui-scrollbar'>{display}</pre>;
  return collapsible ? <details className='group min-w-0 rounded-lg border border-ui-divider'>
    <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-ui-text [&::-webkit-details-marker]:hidden'>
      {title}<ChevronDown size={15} className='shrink-0 text-ui-text-3 transition-transform group-open:rotate-180' />
    </summary>
    <div className='px-3 pb-3'>{code}</div>
  </details> : <DetailSection title={title}>{code}</DetailSection>;
}
