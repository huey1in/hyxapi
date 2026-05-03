/*
 * Channels actions bar — batch ops + display toggles, all in token style.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Trash2, Tag as TagIcon } from 'lucide-react';
import { showConfirm } from '../../common/ConfirmDialog';

const Toggle = ({ checked, onChange }) => (
  <button
    type='button'
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ${
      checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border'
    }`}
  >
    <span
      className={`inline-block h-3 w-3 transform rounded-full transition-transform shadow ${
        checked ? 'translate-x-[14px]' : 'translate-x-0.5'
      }`}
      style={{ background: '#ffffff' }}
    />
  </button>
);

const ToggleRow = ({ label, checked, onChange }) => (
  <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-ui-border bg-ui-bg'>
    <span className='text-[11px] text-ui-text-2 whitespace-nowrap'>{label}</span>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const ChannelsActions = ({
  enableBatchDelete,
  batchDeleteChannels,
  setShowBatchSetTag,
  testAllChannels,
  fixChannelsAbilities,
  updateAllChannelsBalance,
  deleteAllDisabledChannels,
  applyAllUpstreamUpdates,
  detectAllUpstreamUpdates,
  detectAllUpstreamUpdatesLoading,
  applyAllUpstreamUpdatesLoading,
  idSort,
  setIdSort,
  setEnableBatchDelete,
  enableTagMode,
  setEnableTagMode,
  statusFilter,
  setStatusFilter,
  getFormValues,
  loadChannels,
  searchChannels,
  activeTypeKey,
  activePage,
  pageSize,
  setActivePage,
  t,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const confirm = (title, content, onOk, danger) => () => {
    showConfirm({ title, content, onOk, danger });
    setMenuOpen(false);
  };

  const onIdSortChange = (v) => {
    localStorage.setItem('id-sort', v + '');
    setIdSort(v);
    const { searchKeyword, searchGroup, searchModel } = getFormValues();
    if (searchKeyword === '' && searchGroup === '' && searchModel === '') {
      loadChannels(activePage, pageSize, v, enableTagMode);
    } else {
      searchChannels(enableTagMode, activeTypeKey, statusFilter, activePage, pageSize, v);
    }
  };

  const menuItems = [
    {
      label: t('测试所有未手动禁用渠道'),
      onClick: confirm(t('确定？'), t('确定要测试所有未手动禁用渠道吗？'), testAllChannels),
    },
    {
      label: t('修复数据库一致性'),
      onClick: confirm(
        t('确定是否要修复数据库一致性？'),
        t('进行该操作时，可能导致渠道访问错误，请仅在数据库出现问题时使用'),
        fixChannelsAbilities,
      ),
    },
    {
      label: t('更新所有已启用通道余额'),
      onClick: confirm(t('确定？'), t('确定要更新所有已启用通道余额吗？'), updateAllChannelsBalance),
    },
    {
      label: t('检测全部渠道上游更新'),
      onClick: confirm(
        t('确定？'),
        t('确定要仅检测全部渠道上游模型更新吗？（不执行新增/删除）'),
        detectAllUpstreamUpdates,
      ),
      loading: detectAllUpstreamUpdatesLoading,
    },
    {
      label: t('处理全部渠道上游更新'),
      onClick: confirm(t('确定？'), t('确定要对全部渠道执行上游模型更新吗？'), applyAllUpstreamUpdates),
      loading: applyAllUpstreamUpdatesLoading,
      primary: true,
    },
    {
      label: t('删除禁用通道'),
      onClick: confirm(t('确定是否要删除禁用通道？'), t('此修改将不可逆'), deleteAllDisabledChannels, true),
      danger: true,
    },
  ];

  return (
    <div className='flex flex-col md:flex-row justify-between gap-2 w-full'>
      {/* Left: batch ops */}
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          disabled={!enableBatchDelete}
          onClick={() =>
            showConfirm({
              title: t('确定是否要删除所选通道？'),
              content: t('此修改将不可逆'),
              danger: true,
              onOk: () => batchDeleteChannels(),
            })
          }
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-danger/40 text-ui-danger hover:bg-ui-danger-bg disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap'
        >
          <Trash2 size={12} />
          {t('删除所选')}
        </button>
        <button
          disabled={!enableBatchDelete}
          onClick={() => setShowBatchSetTag(true)}
          className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 disabled:hover:bg-transparent transition-colors whitespace-nowrap'
        >
          <TagIcon size={12} />
          {t('批量设置标签')}
        </button>

        <div className='relative' ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
          >
            {t('批量操作')}
            <ChevronDown size={12} />
          </button>
          {menuOpen && (
            <div className='absolute z-30 left-0 mt-1 min-w-[200px] bg-ui-bg-elevated border border-ui-border rounded-lg shadow-lg overflow-hidden'>
              {menuItems.map((it, i) => (
                <button
                  key={i}
                  onClick={it.onClick}
                  disabled={it.loading}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-ui-bg-subtle transition-colors disabled:opacity-50 ${
                    it.danger ? 'text-ui-danger' : it.primary ? 'text-ui-brand font-medium' : 'text-ui-text-2 hover:text-ui-text'
                  }`}
                >
                  {it.label}{it.loading ? '...' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: toggles + status filter */}
      <div className='flex flex-wrap items-center gap-1.5'>
        <ToggleRow label={t('ID 排序')} checked={idSort} onChange={onIdSortChange} />
        <ToggleRow
          label={t('批量操作')}
          checked={enableBatchDelete}
          onChange={(v) => {
            localStorage.setItem('enable-batch-delete', v + '');
            setEnableBatchDelete(v);
          }}
        />
        <ToggleRow
          label={t('标签聚合')}
          checked={enableTagMode}
          onChange={(v) => {
            localStorage.setItem('enable-tag-mode', v + '');
            setEnableTagMode(v);
            setActivePage(1);
            loadChannels(1, pageSize, idSort, v);
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value;
            localStorage.setItem('channel-status-filter', v);
            setStatusFilter(v);
            setActivePage(1);
            loadChannels(1, pageSize, idSort, enableTagMode, activeTypeKey, v);
          }}
          className='px-2.5 py-1 text-xs bg-ui-bg border border-ui-border rounded-md text-ui-text outline-none focus:border-ui-text-3 cursor-pointer'
        >
          <option value='all'>{t('全部状态')}</option>
          <option value='enabled'>{t('已启用')}</option>
          <option value='disabled'>{t('已禁用')}</option>
        </select>
      </div>
    </div>
  );
};

export default ChannelsActions;
