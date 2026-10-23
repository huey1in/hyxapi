import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Select, SlideOver, Textarea, Tag, Skeleton } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-error';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { readTickets, ticketAgentsSchema, ticketDetailSchema, ticketLabels, writeTicket } from './ticket-data';

export default function TicketDetail({ id, userID, role, identity, onClose, onChanged }: { id: number; userID: number; role: number; identity: string; onClose: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ['ticket-detail', identity, id], initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => readTickets(`/api/tickets/${id}${pageParam ? `?before=${pageParam}` : ''}`, ticketDetailSchema, signal),
    getNextPageParam: (last) => last.has_more ? last.messages.at(-1)?.id : undefined,
    gcTime: 0, retry: false, refetchInterval: 15000,
  });
  const agents = useQuery({ queryKey: ['ticket-agents', identity], enabled: role >= 10, gcTime: 0, retry: false,
    queryFn: ({ signal }) => readTickets('/api/tickets/agents', ticketAgentsSchema, signal) });
  const ticket = query.data?.pages[0]?.ticket;
  const handle = query.data?.pages[0]?.can_handle === true;
  const owner = ticket?.user_id === userID;
  const change = (payload: Record<string, unknown>, clear = false) => run(async (signal) => {
    await writeTicket(`/api/tickets/${id}`, 'patch', payload, signal);
    if (clear) setBody('');
    await query.refetch(); onChanged();
  });
  const date = (timestamp: number) => new Date(timestamp * 1000).toLocaleString(i18n.language);
  const messages = [...(query.data?.pages.flatMap((page) => page.messages) ?? [])].sort((a, b) => a.id - b.id);
  return <SlideOver open title={ticket ? <span className='break-words'>#{id} {ticket.subject}</span> : t('Support ticket')} onClose={() => { if (!busy) onClose(); }}>
    <div className='px-6 pb-6 space-y-5'>
      {query.isPending ? <div className='space-y-5'>{[0, 1, 2].map((key) => <Skeleton key={key} height={90} width='100%' />)}</div> : query.isError ? <div role='alert' className='space-y-3'><p>{t(apiErrorMessage(query.error, 'Unable to load tickets'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : ticket && <>
        <div className='space-y-3 border-b border-ui-border pb-5 text-sm'>
          <div className='flex items-center justify-between gap-3'><span className='text-ui-text-3'>{t('Category')}</span><span>{t(ticketLabels[ticket.category])}</span></div>
          <div className='flex items-center justify-between gap-3'><span className='text-ui-text-3'>{t('Status')}</span><Tag>{t(ticketLabels[ticket.status])}</Tag></div>
          {(handle || owner) && <div className='flex items-center justify-between gap-3'><span>{t('Change status')}</span><Select popover aria-label={t('Change status')} value={ticket.status} disabled={busy} options={(handle ? ['open', 'waiting_user', 'resolved', 'closed'] : ['open', 'closed']).map((value) => ({ value, label: t(ticketLabels[value]) }))} onChange={(status) => void change({ status })} /></div>}
          {handle && <div className='flex items-center justify-between gap-3'><span>{t('Priority')}</span><Select popover aria-label={t('Priority')} value={ticket.priority} disabled={busy} options={['low', 'normal', 'high'].map((value) => ({ value, label: t(ticketLabels[value]) }))} onChange={(priority) => void change({ priority })} /></div>}
          {role >= 10 && <div className='flex items-center justify-between gap-3'><span>{t('Assigned support')}</span><Select popover aria-label={t('Assigned support')} value={ticket.assignee_id} disabled={busy || agents.isPending || agents.isError} options={[{ value: 0, label: t('Unassigned') }, ...(agents.data ?? []).filter((agent) => agent.id !== ticket.user_id).map((agent) => ({ value: agent.id, label: agent.username }))]} onChange={(assignee_id) => void change({ assignee_id })} /></div>}
          {agents.isError && <p role='alert' className='text-xs text-ui-danger'>{t('Unable to load support agents')}</p>}
          {role >= 5 && ticket.assignee_id === 0 && !owner && <div className='flex justify-end'><Button disabled={busy} onClick={() => void change({ claim: true })}>{t('Claim ticket')}</Button></div>}
        </div>
        <div className='space-y-4'>
          {query.hasNextPage && <Button size='sm' variant='link' loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t('Load earlier messages')}</Button>}
          {messages.map((message) => <article key={message.id} className={`rounded-2xl px-4 py-3 ${message.internal ? 'border border-dashed border-ui-border' : message.author_id === userID ? 'bg-ui-bg-subtle' : 'border border-ui-border'}`}>
            <div className='mb-2 flex flex-wrap justify-between gap-2 text-xs text-ui-text-3'><span>{t(message.kind === 'event' ? 'Ticket updated' : message.author_id === ticket.user_id ? 'Requester' : 'Customer support')}{message.internal && ` · ${t('Internal note')}`}</span><time dateTime={new Date(message.created_at * 1000).toISOString()}>{date(message.created_at)}</time></div>
            <div className='whitespace-pre-wrap break-words text-sm leading-6 text-ui-text'>{message.kind === 'event' ? (() => {
              try { const event = JSON.parse(message.body) as { status: string; priority: string; assignee_id: number }; return `${t('Status')}: ${t(ticketLabels[event.status] || event.status)} · ${t('Priority')}: ${t(ticketLabels[event.priority] || event.priority)} · ${t('Assigned support')}: ${event.assignee_id || t('Unassigned')}`; } catch { return t('Ticket updated'); }
            })() : message.body}</div>
          </article>)}
        </div>
        {(owner || handle) && ticket.status !== 'closed' ? <div className='space-y-3 border-t border-ui-border pt-5'>
          {handle && <div className='flex items-center justify-between gap-3 text-sm'><span>{t('Reply type')}</span><Select popover aria-label={t('Reply type')} value={internal ? 'internal' : 'public'} disabled={busy} options={[{ value: 'public', label: t('Reply to requester') }, { value: 'internal', label: t('Internal note') }]} onChange={(value) => setInternal(value === 'internal')} /></div>}
          <Textarea aria-label={t('Message')} placeholder={t('Describe your issue or reply here')} value={body} onChange={setBody} rows={4} maxLength={10000} disabled={busy} width='full' />
          {handle && internal && <p className='text-xs text-ui-text-3'>{t('Internal notes are visible only to authorized support staff.')}</p>}
          <div className='flex justify-end'><Button loading={busy} disabled={!body.trim()} onClick={() => void change({ body: body.trim(), internal: handle && internal }, true)}>{t(handle && internal ? 'Add note' : 'Send reply')}</Button></div>
        </div> : <p className='text-sm text-ui-text-3'>{t(ticket.status === 'closed' ? 'Reopen the ticket to continue the conversation.' : 'Claim this ticket before replying.')}</p>}
      </>}
    </div>
  </SlideOver>;
}
