/*
 * Channels filter bar — native inputs + select, exposes a Semi-compatible
 * formApi shim so the existing useChannelsData hook works unchanged.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, RefreshCw, Columns3, X } from 'lucide-react';
import Select from '../../common/form/Select';

const inputCls =
  'w-full pl-9 pr-8 py-2 text-sm bg-ui-bg-elevated border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const ChannelsFilters = ({
  setEditingChannel,
  setShowEdit,
  refresh,
  setShowColumnSelector,
  formInitValues,
  setFormApi,
  searchChannels,
  enableTagMode,
  groupOptions,
  loading,
  searching,
  t,
}) => {
  const initial = formInitValues || { searchKeyword: '', searchModel: '', searchGroup: '' };
  const [keyword, setKeyword] = useState(initial.searchKeyword || '');
  const [model, setModel] = useState(initial.searchModel || '');
  const [group, setGroup] = useState(initial.searchGroup || '');

  const ref = useRef({ keyword, model, group });
  ref.current = { keyword, model, group };

  // expose Semi-Form-compatible API to the hook
  useEffect(() => {
    const api = {
      getValues: () => ({
        searchKeyword: ref.current.keyword,
        searchModel: ref.current.model,
        searchGroup: ref.current.group,
      }),
      reset: () => {
        setKeyword('');
        setModel('');
        setGroup('');
        ref.current = { keyword: '', model: '', group: '' };
      },
      setValue: (field, val) => {
        if (field === 'searchKeyword') setKeyword(val || '');
        if (field === 'searchModel') setModel(val || '');
        if (field === 'searchGroup') setGroup(val || '');
      },
    };
    setFormApi(api);
  }, [setFormApi]);

  const submit = (e) => {
    e?.preventDefault();
    searchChannels(enableTagMode);
  };

  const reset = () => {
    setKeyword('');
    setModel('');
    setGroup('');
    ref.current = { keyword: '', model: '', group: '' };
    setTimeout(() => refresh(), 0);
  };

  const groupItems = useMemo(
    () => [{ label: t('全部分组'), value: '' }, ...(groupOptions || [])],
    [groupOptions, t],
  );

  return (
    <div className='flex flex-col md:flex-row justify-between items-stretch gap-2 w-full'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          onClick={() => {
            setEditingChannel({ id: undefined });
            setShowEdit(true);
          }}
          className='inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover active:scale-95 transition-all whitespace-nowrap'
        >
          <Plus size={14} />
          {t('添加渠道')}
        </button>
        <button
          onClick={refresh}
          disabled={loading || searching}
          className='inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap disabled:opacity-50'
        >
          <RefreshCw size={14} className={loading || searching ? 'animate-spin' : ''} />
          {t('刷新')}
        </button>
        <button
          onClick={() => setShowColumnSelector(true)}
          className='inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
        >
          <Columns3 size={14} />
          {t('列设置')}
        </button>
      </div>

      <form onSubmit={submit} className='flex flex-wrap items-center gap-1.5 md:flex-nowrap'>
        <SearchInput value={keyword} onChange={setKeyword} placeholder={t('ID/名称/密钥/地址')} className='w-full md:w-56' />
        <SearchInput value={model} onChange={setModel} placeholder={t('模型关键字')} className='w-full md:w-40' />
        <Select
          value={group}
          onChange={(v) => {
            setGroup(v);
            ref.current = { ...ref.current, group: v };
            setTimeout(() => searchChannels(enableTagMode), 0);
          }}
          options={groupItems}
          className='w-full md:w-36'
        />
        <button
          type='submit'
          disabled={loading || searching}
          className='inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap disabled:opacity-50'
        >
          {searching ? t('查询中...') : t('查询')}
        </button>
        <button
          type='button'
          onClick={reset}
          className='inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
        >
          {t('重置')}
        </button>
      </form>
    </div>
  );
};

const SearchInput = ({ value, onChange, placeholder, className = '' }) => (
  <div className={`relative ${className}`}>
    <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
    <input
      type='text'
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
    {value && (
      <button
        type='button'
        onClick={() => onChange('')}
        className='absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
      >
        <X size={11} />
      </button>
    )}
  </div>
);

export default ChannelsFilters;
