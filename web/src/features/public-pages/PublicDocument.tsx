import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { Button, Card, PageShell } from '../../components/ui';
import ConfiguredContent from '../../components/common/markdown/ConfiguredContent';
import { configuredContentKind } from '../../lib/configured-content';
import { usePageTitle } from '../../hooks/common/usePageTitle';

const documents = {
  about: { endpoint: '/api/about', title: 'About', empty: 'No About Content Set' },
  terms: { endpoint: '/api/user-agreement', title: 'Terms of Service', empty: 'No legal document has been configured' },
  privacy: { endpoint: '/api/privacy-policy', title: 'Privacy Policy', empty: 'No legal document has been configured' },
} as const;

export default function PublicDocument({ kind }: { kind: keyof typeof documents }) {
  const { t } = useTranslation();
  const document = documents[kind];
  const title = t(document.title);
  usePageTitle(title);
  const query = useQuery({
    queryKey: ['public-document', kind], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await API.get<ApiEnvelope<string>>(document.endpoint, { signal, skipAuthRefresh: true, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted();
      if (!response.data.success || typeof response.data.data !== 'string') throw new Error(response.data.message || 'Unable to load document');
      return response.data.data;
    },
  });
  const content = query.data?.trim() ?? '';
  return <PageShell title={title} maxWidth='960px'>
    {query.isPending ? <p role='status' className='text-sm text-ui-text-2'>{t('Loading...')}</p> : query.isError ? <Card><div role='alert' className='space-y-3'><p className='text-sm text-ui-text-2'>{t('Unable to load document')}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div></Card> : !content ? <Card><p className='text-sm text-ui-text-2'>{t(document.empty)}</p></Card> : kind === 'about' && configuredContentKind(content) === 'url' ? <iframe src={content} title={title} sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts' referrerPolicy='no-referrer' className='w-full h-[70vh] border-0 rounded-lg' /> : <Card><ConfiguredContent content={content} title={title} /></Card>}
    {kind === 'about' && <p className='mt-6 text-xs text-ui-text-3'><a href='https://github.com/QuantumNous/new-api' target='_blank' rel='noopener noreferrer' className='underline'>New API</a> · <a href='https://github.com/QuantumNous/new-api/blob/main/LICENSE' target='_blank' rel='noopener noreferrer' className='underline'>AGPL-3.0</a></p>}
  </PageShell>;
}
