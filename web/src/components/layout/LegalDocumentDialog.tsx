import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ShieldCheck } from 'lucide-react';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';
import { Button, EmptyState } from '../ui';
import ConfiguredContent from '../common/markdown/ConfiguredContent';

export default function LegalDocumentDialog({ type, onClose }: { type: 'terms' | 'privacy'; onClose: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLElement>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const owner = new AbortController(); setLoading(true); setError(''); setContent('');
    void (async () => {
      try {
        const response = await API.get<ApiEnvelope<string>>(type === 'terms' ? '/api/user-agreement' : '/api/privacy-policy', { signal: owner.signal, skipErrorHandler: true, disableDuplicate: true });
        owner.signal.throwIfAborted();
        if (!response.data.success || typeof response.data.data !== 'string') throw new Error('Unable to load legal document');
        setContent(response.data.data);
      } catch (error) { if (!owner.signal.aborted) setError(apiErrorMessage(error, 'Unable to load legal document')); }
      finally { if (!owner.signal.aborted) setLoading(false); }
    })();
    return () => owner.abort();
  }, [type, attempt]);
  return <div className='cursor-auth-legal-overlay' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className='cursor-auth-legal-dialog' role='dialog' aria-modal='true' aria-labelledby={titleId} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header><h2 id={titleId}>{t(type === 'terms' ? 'Terms of Service' : 'Privacy Policy')}</h2><button type='button' onClick={onClose} aria-label={t('Close')}>×</button></header>
      <div className='cursor-auth-legal-content'>
        {loading ? <p role='status'>{t('Loading...')}</p> : error ? <div role='alert' className='space-y-3'><p>{t(error)}</p><Button onClick={() => setAttempt((value) => value + 1)}>{t('Retry')}</Button></div> : content ? <ConfiguredContent content={content} title={t(type === 'terms' ? 'Terms of Service' : 'Privacy Policy')} /> : <EmptyState icon={type === 'privacy' ? ShieldCheck : FileText} padding='md' title={t('No legal document has been configured')} />}
      </div>
    </section>
  </div>;
}
