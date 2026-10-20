import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select } from '../../components/ui';
import type { ManagedToken } from './token-management';
import type { useTokenManagement } from './use-token-management';

type Management = ReturnType<typeof useTokenManagement>;
type Props = { management: Management; visibleRows: ManagedToken[]; onDeleteSelected: () => void };

export default function TokenListControls({ management: state, visibleRows, onDeleteSelected }: Props) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(state.search.keyword);
  const [token, setToken] = useState(state.search.token);
  const selected = Object.values(state.selected);
  const submit = () => state.applySearch({ keyword, token });
  return <div className='space-y-3'>
    <form className='flex flex-wrap items-center gap-2' onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className='min-w-40 flex-1'><Input value={keyword} onChange={setKeyword} aria-label={t('Search by key name')} placeholder={t('Search by key name')} /></div>
      <div className='min-w-40 flex-1'><Input value={token} onChange={setToken} aria-label={t('Search by API key')} placeholder={t('Search by API key')} type='password' autoComplete='off' /></div>
      <Button type='submit' size='sm' disabled={state.fetching}>{t('Search')}</Button>
      <Button type='button' size='sm' variant='toggle' onClick={() => { setKeyword(''); setToken(''); state.applySearch({ keyword: '', token: '' }); state.setStatus('all'); }}>{t('Reset')}</Button>
      <Button type='button' size='sm' variant='toggle' onClick={() => void state.refresh()} disabled={state.fetching}>{t('Refresh')}</Button>
    </form>
    <p className='text-xs text-ui-text-3'>{t('Search matches exact text; use % for wildcard matching.')}</p>
    <div className='flex flex-wrap items-center gap-3 text-xs text-ui-text-2'>
      <label className='flex items-center gap-2'>{t('Status on this page')}
        <Select aria-label={t('Status on this page')} value={state.status} onChange={state.setStatus} width={140} size={28} options={[
          { value: 'all', label: t('All statuses') }, { value: '1', label: t('Enabled') }, { value: '2', label: t('Disabled') },
          { value: '3', label: t('Expired') }, { value: '4', label: t('Exhausted') },
        ]} />
      </label>
      <label className='flex items-center gap-2'>{t('Keys per page')}
        <Select aria-label={t('Keys per page')} value={String(state.pageSize)} onChange={(value) => state.setPageSize(Number(value))} width={80} size={28}
          options={[20, 50, 100].map((value) => ({ value: String(value), label: String(value) }))} />
      </label>
      <label className='flex items-center gap-2'>
        <input type='checkbox' disabled={!visibleRows.length || state.busy}
          checked={!!visibleRows.length && visibleRows.every((row) => !!state.selected[row.id])}
          onChange={(event) => state.toggleSelection(visibleRows, event.target.checked)} />{t('Select visible keys')}
      </label>
    </div>
    {!!selected.length && <div className='flex flex-wrap items-center gap-2 rounded-lg border border-ui-border p-3 text-xs'>
      <span className='text-ui-text-2'>{t('{{count}} API keys selected across pages and filters', { count: selected.length })}</span>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={() => void state.copyTokens(selected, true)}>{t('Copy selected keys')}</Button>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={onDeleteSelected}>{t('Delete selected API keys')}</Button>
      <Button size='sm' variant='toggle' disabled={state.busy} onClick={state.clearSelection}>{t('Clear selection')}</Button>
    </div>}
    {state.error && <p role='alert' className='text-sm text-ui-danger'>{state.error}</p>}
    {state.keyError && <p role='alert' className='text-xs text-ui-danger'>{t('Some plaintext keys could not be loaded. Copy retries the selected keys.')}</p>}
  </div>;
}
