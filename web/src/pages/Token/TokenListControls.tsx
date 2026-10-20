import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import type { useTokenManagement } from './use-token-management';

type Management = ReturnType<typeof useTokenManagement>;
type Props = { management: Management; onDeleteSelected: () => void };

export default function TokenListControls({ management: state, onDeleteSelected }: Props) {
  const { t } = useTranslation();
  const selected = Object.values(state.selected);
  if (!state.error && !selected.length) return null;
  return <div className='space-y-3'>
    {!!selected.length && <div className='flex flex-wrap items-center gap-2 rounded-lg border border-ui-border p-3 text-xs'>
      <span className='text-ui-text-2'>{t('{{count}} API keys selected across pages', { count: selected.length })}</span>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={() => void state.copyTokens(selected, true)}>{t('Copy selected keys')}</Button>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={onDeleteSelected}>{t('Delete selected API keys')}</Button>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={state.clearSelection}>{t('Clear selection')}</Button>
    </div>}
    {state.error && <div role='alert' className='flex items-center gap-3 text-sm text-ui-danger'>
      <span>{state.error}</span><Button size='sm' variant='toggle' disabled={state.fetching} onClick={() => void state.refresh()}>{t('Retry')}</Button>
    </div>}
  </div>;
}
