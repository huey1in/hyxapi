/*
 * Channels actions bar — batch ops + display toggles, all in token style.
 */
import React from 'react';
import { ChevronDown, Trash2, Tag as TagIcon } from 'lucide-react';
import { showConfirm } from '../../common/ConfirmDialog';
import Select from '../../common/form/Select';
import { Button, Dropdown, Switch } from '../../ui';

const ToggleRow = ({ label, checked, onChange }) => (
  <div className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ui-border' style={{ backgroundColor: 'var(--page-bg)' }}>
    <span className='text-xs text-ui-text-2 whitespace-nowrap'>{label}</span>
    <Switch checked={checked} onChange={onChange} size='sm' />
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
  const confirm = (title, content, onOk, danger) => () => {
    showConfirm({ title, content, onOk, danger });
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
    <div className='flex flex-col md:flex-row justify-between gap-2 w-full min-w-0'>
      {/* Left: batch ops */}
      <div className='flex flex-wrap items-center gap-1.5'>
        <Button
          variant='danger'
          icon={Trash2}
          disabled={!enableBatchDelete}
          onClick={() =>
            showConfirm({
              title: t('确定是否要删除所选通道？'),
              content: t('此修改将不可逆'),
              danger: true,
              onOk: () => batchDeleteChannels(),
            })
          }
        >
          {t('删除所选')}
        </Button>
        <Button
          variant='ghost'
          icon={TagIcon}
          disabled={!enableBatchDelete}
          onClick={() => setShowBatchSetTag(true)}
        >
          {t('批量设置标签')}
        </Button>

        <Dropdown
          placement='bottom-start'
          items={menuItems}
          trigger={
            <Button variant='ghost' iconRight={ChevronDown}>
              {t('批量操作')}
            </Button>
          }
        />
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
        <Select
          value={statusFilter}
          onChange={(v) => {
            localStorage.setItem('channel-status-filter', v);
            setStatusFilter(v);
            setActivePage(1);
            loadChannels(1, pageSize, idSort, enableTagMode, activeTypeKey, v);
          }}
          options={[
            { label: t('全部状态'), value: 'all' },
            { label: t('已启用'), value: 'enabled' },
            { label: t('已禁用'), value: 'disabled' },
          ]}
        />
      </div>
    </div>
  );
};

export default ChannelsActions;
