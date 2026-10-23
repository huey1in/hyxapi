import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Headset, Plus, Search, SlidersHorizontal } from 'lucide-react';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { Button, Input, Modal, Pagination, Select, Table, Tag, Textarea, showSuccess } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useLiveSearch } from '../../hooks/useLiveSearch';
import { apiErrorMessage } from '../../lib/api-error';
import { readTickets, ticketLabels, ticketPageSchema, writeTicket } from './ticket-data';
import type { SupportTicket } from './ticket-data';
import TicketDetail from './TicketDetail';

function NewTicket({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [subject, setSubject] = useState(''); const [category, setCategory] = useState('other'); const [body, setBody] = useState('');
  return <Modal open width={480} title={t('New ticket')} loading={busy} onClose={() => { if (!busy) onClose(); }} confirmText={t('Create')} cancelText={t('Cancel')} onConfirm={() => void run(async (signal) => {
    if (!subject.trim() || !body.trim()) throw new Error('Enter a subject and message');
    const ticket = await writeTicket('/api/tickets', 'post', { subject: subject.trim(), category, body: body.trim() }, signal);
    showSuccess(t('Ticket created')); onCreated(ticket.id);
  })}>
    <div className='space-y-2 text-sm'>
      <label htmlFor='ticket-subject'>{t('Subject')}</label>
      <div className='flex min-w-0 items-center gap-2'>
        <div className='min-w-0 flex-1'><Input id='ticket-subject' aria-label={t('Subject')} value={subject} onChange={setSubject} maxLength={160} disabled={busy} width='full' /></div>
        <div className='max-w-[40%] shrink-0'><Select popover placement='bottom-end' aria-label={t('Category')} value={category} disabled={busy} onChange={setCategory} options={['account', 'billing', 'api', 'other'].map((value) => ({ value, label: t(ticketLabels[value]) }))} /></div>
      </div>
    </div>
    <label className='block space-y-2 text-sm'><span>{t('Message')}</span><Textarea aria-label={t('Message')} placeholder={t('Describe your issue or reply here')} value={body} onChange={setBody} rows={5} maxLength={10000} disabled={busy} width='full' /></label>
  </Modal>;
}

export default function Tickets({ management = false }: { management?: boolean }) {
  const user = useAuthStore((state) => state.auth.user);
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return user && (!management || user.role >= 5) ? <TicketWorkspace key={`${identity}:${management}`} userID={user.id} role={user.role} identity={identity} management={management} /> : null;
}

function TicketWorkspace({ userID, role, identity, management }: { userID: number; role: number; identity: string; management: boolean }) {
  const { t, i18n } = useTranslation(); const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false); const [filtering, setFiltering] = useState(false);
  const [status, setStatus] = useState(''); const [queue, setQueue] = useState('');
  const [keyword, setKeyword] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const selected = Number(searchParams.get('ticket')); const filters = !!status || !!queue;
  useLiveSearch(search.trim(), (value) => { setKeyword(value); setPage(1); });
  const query = useQuery({ queryKey: ['tickets', identity, management, status, queue, keyword, page], gcTime: 0, retry: false, refetchInterval: 30000,
    queryFn: ({ signal }) => readTickets(`/api/tickets${management ? '/manage' : ''}?${new URLSearchParams({ status, ...(management ? { queue } : {}), keyword, p: String(page) })}`, ticketPageSchema, signal) });
  const changed = () => { void client.invalidateQueries({ queryKey: ['tickets', identity] }); };
  const open = (id: number | null) => { setSearchParams((params) => { if (id) params.set('ticket', String(id)); else params.delete('ticket'); return params; }); };
  const columns: TableColumn<SupportTicket>[] = [
    { key: 'subject', title: t('Subject'), mobileRole: 'wide', render: (ticket) => <Button variant='link' onClick={(event) => { event.stopPropagation(); open(ticket.id); }}><span className='text-left break-words'>#{ticket.id} {ticket.subject}</span></Button> },
    { key: 'category', title: t('Category'), render: (ticket) => t(ticketLabels[ticket.category]) },
    { key: 'status', title: t('Status'), render: (ticket) => <Tag tone={ticket.status === 'resolved' ? 'green' : 'grey'}>{t(ticketLabels[ticket.status])}</Tag> },
    ...(management ? [{ key: 'user', title: t('Requester'), render: (ticket: SupportTicket) => `#${ticket.user_id}` }, { key: 'priority', title: t('Priority'), render: (ticket: SupportTicket) => t(ticketLabels[ticket.priority]) }, { key: 'assignee', title: t('Assigned support'), render: (ticket: SupportTicket) => ticket.assignee_id ? ticket.assignee_id === userID ? t('Me') : `#${ticket.assignee_id}` : t('Unassigned') }] : []),
    { key: 'updated_at', title: t('Updated time'), render: (ticket) => <span className='whitespace-nowrap text-ui-text-3'>{new Date(ticket.updated_at * 1000).toLocaleString(i18n.language)}</span> },
  ];
  return <div className='console-content-page'>
    <ConsolePageHeader title={t(management ? 'Ticket management' : 'Support tickets')} />
    <div className='mb-5 flex flex-wrap items-center gap-2'>
      <div className='w-40 min-w-0 max-w-full sm:w-64'><Input aria-label={t('Search tickets')} placeholder={t('Search tickets')} prefix={<Search size={15} />} value={search} onChange={setSearch} clearable /></div>
      <Button icon={SlidersHorizontal} variant={filters ? 'secondary' : 'toggle'} onClick={() => setFiltering(true)}>{t('Filters')}</Button>
      {filters && <Button variant='link' onClick={() => { setStatus(''); setQueue(''); setPage(1); }}>{t('Reset')}</Button>}
      {!management && <div className='ml-auto'><Button icon={Plus} onClick={() => setCreating(true)}>{t('New ticket')}</Button></div>}
    </div>
    {query.isError && <div role='alert' className='mb-4 flex items-center gap-3 text-sm text-ui-danger'>{t(apiErrorMessage(query.error, 'Unable to load tickets'))}<Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div>}
    <div className='min-h-[320px]'><Table columns={columns} rows={query.isError ? [] : query.data?.items ?? []} loading={query.isPending} skeletonRows={5} emptyIcon={Headset} emptyText={t('No support tickets')}
      onRowClick={(ticket) => open(ticket.id)}
      rowProps={(ticket) => ({
        tabIndex: 0,
        'aria-label': `#${ticket.id} ${ticket.subject}`,
        onKeyDown: (event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            open(ticket.id);
          }
        },
      })}
    /></div>
    <div className='mt-4 flex justify-end'><Pagination page={page} pageSize={10} total={query.data?.total ?? 0} onChange={setPage} /></div>
    {filtering && <Modal open width={380} title={t('Filters')} onClose={() => setFiltering(false)} hideFooter>
      <div className='flex items-center justify-between gap-3 py-2 text-sm'><span>{t('Status')}</span><Select popover aria-label={t('Ticket status')} value={status} options={[{ value: '', label: t('All statuses') }, ...['open', 'waiting_user', 'resolved', 'closed'].map((value) => ({ value, label: t(ticketLabels[value]) }))]} onChange={(value) => { setStatus(value); setPage(1); }} /></div>
      {management && <div className='flex items-center justify-between gap-3 pb-4 text-sm'><span>{t('Queue')}</span><Select popover aria-label={t('Queue')} value={queue} options={[{ value: '', label: t('All accessible tickets') }, { value: 'mine', label: t('Assigned to me') }, { value: 'unassigned', label: t('Unassigned') }]} onChange={(value) => { setQueue(value); setPage(1); }} /></div>}
    </Modal>}
    {creating && <NewTicket onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); changed(); open(id); }} />}
    {Number.isSafeInteger(selected) && selected > 0 && <TicketDetail key={`${identity}:${selected}`} id={selected} userID={userID} role={role} identity={identity} management={management} onClose={() => open(null)} onChanged={changed} />}
  </div>;
}
