import { useEffect, useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { API, copy, showSuccess } from '../../helpers';
import { Button, IconButton } from '../../components/ui';
import ModalShell from '../../components/ui/modal/ModalShell';
import type { ApiEnvelope } from '../../types/api';
import type { PermissionResourceDef } from '../../lib/admin-permissions';
import { buildAuditDetails } from './audit-details';
import { formatAuditDate } from './types';
import type { AuditLog } from './types';

function Value({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return <span>—</span>;
  if (typeof value === 'object') return <pre className='text-xs whitespace-pre-wrap break-words'>{JSON.stringify(value, null, 2)}</pre>;
  return <span>{String(value)}</span>;
}

export default function AuditDetails({ entry, identity, onClose }: { entry: AuditLog; identity: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const scopes = useQuery({
    queryKey: ['audit-scope-labels', identity],
    queryFn: async ({ signal }) => {
      const response = await API.get<ApiEnvelope<{ resources: PermissionResourceDef[] }>>('/api/user/access_tokens/scopes', { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!response.data.success || !response.data.data) throw new Error('Unable to load scope catalog');
      return response.data.data.resources;
    }, enabled: ['access_token.generate', 'access_token.update'].includes(entry.action), retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const details = buildAuditDetails(entry, t, { scopeResources: scopes.data });
  const request = [
    { label: t('Time'), value: formatAuditDate(entry.created_at, i18n.language) },
    { label: t('Result'), value: t(entry.success ? 'Success' : 'Failed') },
    { label: t('Method'), value: entry.method }, { label: t('Route'), value: entry.route },
    { label: 'HTTP', value: entry.status }, { label: 'IP', value: entry.ip },
    { label: t('Client'), value: entry.user_agent }, { label: t('Request ID'), value: entry.request_id, copyable: true },
    { label: t('Token identifier'), value: entry.token_ref, copyable: true }, { label: t('Event ID'), value: entry.event_id, copyable: true },
  ];
  const fields = [
    { label: t('Operator'), value: details.actor }, { label: t('Role'), value: details.actorRole },
    { label: t('Target'), value: details.target }, { label: t('Authentication Method'), value: details.authentication },
    ...(details.operation?.fields ?? details.fields),
  ];
  const section = (title: string, values: { label: string; value: unknown; copyable?: boolean }[]) => <section className='space-y-3'>
    <h4 className='text-sm font-medium'>{title}</h4>
    <dl className='space-y-3'>{values.filter((field) => field.value !== undefined && field.value !== null && field.value !== '').map((field, index) => <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 text-sm' key={`${field.label}-${index}`}>
      <dt className='text-ui-text-2 break-words'>{field.label}</dt><dd className='min-w-0 break-words space-y-1'><Value value={field.value} />
        {field.copyable && <div><Button variant='link' size='sm' onClick={async () => { if (await copy(String(field.value))) showSuccess(t('Copied')); }}>{t('Copy')}</Button></div>}
      </dd>
    </div>)}</dl>
  </section>;
  return <ModalShell open onClose={onClose} maxWidth={600}><section ref={dialog} role='dialog' aria-modal='true' aria-labelledby={titleId} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const items = [...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? [])];
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className='flex items-center justify-between px-6 pt-5 pb-3'><h3 id={titleId} className='text-base font-semibold text-ui-text'>{t('Log Details')}</h3><IconButton icon={X} onClick={onClose} aria-label={t('Close')} /></div>
    <div className='px-6 py-2 max-h-[70vh] overflow-y-auto space-y-4'>
    <p className='text-sm font-medium break-words'>{details.summary}</p>
    {details.operation?.description && <p className='text-sm text-ui-text-2 break-words'>{details.operation.description}</p>}
    {section(t('Operation Audit Info'), fields)}
    {details.metadataUnavailable && <p className='text-sm text-ui-text-3'>{t('Audit metadata is unavailable')}</p>}
    {scopes.isError && <p role='status' className='text-sm text-ui-text-3'>{t('Scope names are unavailable; only permission counts are shown.')} <Button variant='link' onClick={() => void scopes.refetch()}>{t('Retry')}</Button></p>}
    {section(t('Request'), request)}
    {Object.keys(details.extra).length > 0 && <section className='space-y-2'><h4 className='text-sm font-medium'>{t('Additional metadata')}</h4><Value value={details.extra} /></section>}
    </div>
  </section></ModalShell>;
}
