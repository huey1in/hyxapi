import { ParagraphSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { Button, Card, PageShell } from '../../components/ui';
import ConfiguredContent from '../../components/common/markdown/ConfiguredContent';
import { usePageTitle } from '../../hooks/common/usePageTitle';

const documents = {
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
    {query.isPending ? <Card><ParagraphSkeleton lines={6} /></Card> : query.isError ? <Card><div role='alert' className='space-y-3'><p className='text-sm text-ui-text-2'>{t('Unable to load document')}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div></Card> : !content ? <Card><p className='text-sm text-ui-text-2'>{t(document.empty)}</p></Card> : <Card><ConfiguredContent content={content} title={title} /></Card>}
  </PageShell>;
}
