import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import type { useTokenManagement } from './use-token-management';

type Management = ReturnType<typeof useTokenManagement>;
type Props = { management: Management };

export default function TokenListControls({ management: state }: Props) {
  const { t } = useTranslation();
  if (!state.error) return null;
  return <div role='alert' className='flex items-center gap-3 text-sm text-ui-danger'>
    <span>{state.error}</span><Button size='sm' variant='toggle' disabled={state.fetching} onClick={() => void state.refresh()}>{t('Retry')}</Button>
  </div>;
}
