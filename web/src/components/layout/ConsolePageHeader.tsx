import type { ReactNode } from 'react';

export default function ConsolePageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return <div className='console-page-header flex items-start justify-between gap-3'>
    <h1 className='pb-2 text-2xl font-semibold text-ui-text'>{title}</h1>
    {actions && <div className='flex shrink-0 items-center gap-2'>{actions}</div>}
  </div>;
}
