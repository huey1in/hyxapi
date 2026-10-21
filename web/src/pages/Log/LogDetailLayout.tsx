import type { PropsWithChildren, ReactNode } from 'react';

export function DetailContent({ children }: PropsWithChildren) {
  return <div className='min-w-0 space-y-6 pb-4'>{children}</div>;
}

export function DetailSection({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section aria-label={title} className='min-w-0 space-y-4 border-t border-ui-divider pt-5 first:border-t-0 first:pt-0'>
    <h4 className='text-sm font-semibold text-ui-text'>{title}</h4>
    {children}
  </section>;
}

export function DetailFields({ children }: PropsWithChildren) {
  return <dl className='grid min-w-0 grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2'>{children}</dl>;
}

export function DetailField({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return <div className='min-w-0'>
    <dt className='text-xs leading-5 text-ui-text-3'>{label}</dt>
    <dd className={`mt-1 whitespace-pre-wrap text-sm leading-6 text-ui-text [overflow-wrap:anywhere]${mono ? ' font-mono' : ''}`}>{value}</dd>
  </div>;
}

export function DetailText({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <p className={`whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere] ${error ? 'text-ui-danger' : 'text-ui-text'}`}>{children}</p>;
}

export function DetailCode({ title, value }: { title: string; value: string }) {
  let display = value;
  try { display = JSON.stringify(JSON.parse(value), null, 2); } catch {}
  return <DetailSection title={title}>
    <pre tabIndex={0} aria-label={title} className='max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-ui-border bg-ui-bg-subtle/50 p-4 font-mono text-xs leading-6 text-ui-text outline-offset-2 [overflow-wrap:anywhere] ui-scrollbar'>{display}</pre>
  </DetailSection>;
}
