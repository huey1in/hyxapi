import React, { useEffect, useState } from 'react';
import { API, showError } from '../../helpers';
import { PageShell, Loading, EmptyState } from '../../components/ui';
import { FileText } from 'lucide-react';

const CACHE_KEY = 'user_agreement';

const UserAgreement = () => {
  const [content, setContent] = useState(() => localStorage.getItem(CACHE_KEY) || '');
  const [loading, setLoading] = useState(!content);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/user-agreement');
        const { success, data } = res.data || {};
        if (success && data) {
          setContent(data);
          localStorage.setItem(CACHE_KEY, data);
        }
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageShell title='用户协议'>
      {loading ? (
        <Loading />
      ) : content ? (
        <article
          className='prose max-w-none text-ui-text-1'
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <EmptyState icon={FileText} title='暂无内容' description='加载用户协议内容失败' />
      )}
    </PageShell>
  );
};

export default UserAgreement;
