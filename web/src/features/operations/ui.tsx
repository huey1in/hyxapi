import type { PropsWithChildren, ReactNode } from 'react';
export { Button, Pagination, ConfirmDialog, Table, Input, Select } from '../../components/ui';

export function Panel({ title, actions, children }: PropsWithChildren<{ title: string; actions?: ReactNode }>) {
  return <section className='min-w-0 space-y-3'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-base font-semibold text-ui-text'>{title}</h2><div className='flex flex-wrap gap-2'>{actions}</div></div>
    {children}
  </section>;
}
export function Message({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <p role='alert' className='break-words text-sm text-ui-danger'>{error}</p>}{notice && <p role='status' className='break-words text-sm text-ui-text-2'>{notice}</p>}</>;
}
