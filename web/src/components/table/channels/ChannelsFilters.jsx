/*
 * Channels filter bar — native inputs + select, exposes a Semi-compatible
 * formApi shim so the existing useChannelsData hook works unchanged.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, RefreshCw, Columns3, X } from 'lucide-react';
import Select from '../../common/form/Select';
import { Button, IconButton, inputClass } from '../../ui';

const inputCls = inputClass({ variant: 'admin', size: 'md', className: 'pl-9 pr-8 !bg-ui-bg-elevated' });

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
    <div className='flex flex-col md:flex-row justify-between items-stretch gap-2 w-full min-w-0'>
      <div className='flex flex-wrap items-center gap-1.5 flex-shrink-0'>
        <Button
          icon={Plus}
          onClick={() => {
            setEditingChannel({ id: undefined });
            setShowEdit(true);
          }}
        >
          {t('添加渠道')}
        </Button>
        <Button
          variant='ghost'
          icon={RefreshCw}
          onClick={refresh}
          disabled={loading || searching}
        >
          {t('刷新')}
        </Button>
        <Button
          variant='ghost'
          icon={Columns3}
          onClick={() => setShowColumnSelector(true)}
        >
          {t('列设置')}
        </Button>
      </div>

      <form onSubmit={submit} className='flex flex-wrap items-center gap-1.5 md:flex-nowrap min-w-0'>
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
        <Button type='submit' variant='ghost' disabled={loading || searching}>
          {searching ? t('查询中...') : t('查询')}
        </Button>
        <Button variant='ghost' onClick={reset}>
          {t('重置')}
        </Button>
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
      <IconButton
        size='sm'
        variant='ghost'
        icon={X}
        onClick={() => onChange('')}
        className='absolute right-1 top-1/2 -translate-y-1/2'
      />
    )}
  </div>
);

export default ChannelsFilters;
