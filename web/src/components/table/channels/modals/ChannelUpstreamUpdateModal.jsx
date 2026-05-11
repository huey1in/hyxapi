/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { showConfirm } from '../../../common/ConfirmDialog';
import { TextField } from '../../../common/form/Primitives';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Button } from '../../../ui';

const normalizeModels = (models = []) =>
  Array.from(
    new Set(
      (models || []).map((model) => String(model || '').trim()).filter(Boolean),
    ),
  );

const filterByKeyword = (models = [], keyword = '') => {
  const normalizedKeyword = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!normalizedKeyword) {
    return models;
  }
  return models.filter((model) =>
    String(model).toLowerCase().includes(normalizedKeyword),
  );
};

const Checkbox = ({ checked, indeterminate, onChange, label }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className='inline-flex items-center gap-2 cursor-pointer select-none my-1'>
      <span className='relative inline-flex items-center justify-center'>
        <input
          ref={ref}
          type='checkbox'
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className='peer appearance-none w-4 h-4 rounded border border-ui-border bg-ui-bg-elevated checked:bg-ui-accent checked:border-ui-accent transition-colors cursor-pointer'
        />
        {checked && !indeterminate && (
          <Check
            size={12}
            className='absolute pointer-events-none text-ui-accent-fg'
            strokeWidth={3}
          />
        )}
        {indeterminate && (
          <span className='absolute pointer-events-none w-2 h-[2px] bg-ui-accent-fg' />
        )}
      </span>
      {label && <span className='text-sm text-ui-text truncate'>{label}</span>}
    </label>
  );
};

const ChannelUpstreamUpdateModal = ({
  visible,
  addModels = [],
  removeModels = [],
  preferredTab = 'add',
  confirmLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const normalizedAddModels = useMemo(
    () => normalizeModels(addModels),
    [addModels],
  );
  const normalizedRemoveModels = useMemo(
    () => normalizeModels(removeModels),
    [removeModels],
  );

  const [selectedAddModels, setSelectedAddModels] = useState([]);
  const [selectedRemoveModels, setSelectedRemoveModels] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('add');
  const [partialSubmitConfirmed, setPartialSubmitConfirmed] = useState(false);

  const addTabEnabled = normalizedAddModels.length > 0;
  const removeTabEnabled = normalizedRemoveModels.length > 0;
  const filteredAddModels = useMemo(
    () => filterByKeyword(normalizedAddModels, keyword),
    [normalizedAddModels, keyword],
  );
  const filteredRemoveModels = useMemo(
    () => filterByKeyword(normalizedRemoveModels, keyword),
    [normalizedRemoveModels, keyword],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedAddModels([]);
    setSelectedRemoveModels([]);
    setKeyword('');
    setPartialSubmitConfirmed(false);
    const normalizedPreferredTab = preferredTab === 'remove' ? 'remove' : 'add';
    if (normalizedPreferredTab === 'remove' && removeTabEnabled) {
      setActiveTab('remove');
      return;
    }
    if (normalizedPreferredTab === 'add' && addTabEnabled) {
      setActiveTab('add');
      return;
    }
    setActiveTab(addTabEnabled ? 'add' : 'remove');
  }, [visible, addTabEnabled, removeTabEnabled, preferredTab]);

  const currentModels =
    activeTab === 'add' ? filteredAddModels : filteredRemoveModels;
  const currentSelectedModels =
    activeTab === 'add' ? selectedAddModels : selectedRemoveModels;
  const currentSetSelectedModels =
    activeTab === 'add' ? setSelectedAddModels : setSelectedRemoveModels;
  const selectedAddCount = selectedAddModels.length;
  const selectedRemoveCount = selectedRemoveModels.length;
  const checkedCount = currentModels.filter((model) =>
    currentSelectedModels.includes(model),
  ).length;
  const isAllChecked =
    currentModels.length > 0 && checkedCount === currentModels.length;
  const isIndeterminate =
    checkedCount > 0 && checkedCount < currentModels.length;

  const handleToggleAllCurrent = (checked) => {
    if (checked) {
      const merged = normalizeModels([
        ...currentSelectedModels,
        ...currentModels,
      ]);
      currentSetSelectedModels(merged);
      return;
    }
    const currentSet = new Set(currentModels);
    currentSetSelectedModels(
      currentSelectedModels.filter((model) => !currentSet.has(model)),
    );
  };

  const tabList = [
    {
      itemKey: 'add',
      tab: `${t('新增模型')} (${selectedAddCount}/${normalizedAddModels.length})`,
      disabled: !addTabEnabled,
    },
    {
      itemKey: 'remove',
      tab: `${t('删除模型')} (${selectedRemoveCount}/${normalizedRemoveModels.length})`,
      disabled: !removeTabEnabled,
    },
  ];

  const submitSelectedChanges = () => {
    onConfirm?.({
      addModels: selectedAddModels,
      removeModels: selectedRemoveModels,
    });
  };

  const handleSubmit = () => {
    const hasAnySelected = selectedAddCount > 0 || selectedRemoveCount > 0;
    if (!hasAnySelected) {
      submitSelectedChanges();
      return;
    }

    const hasBothPending = addTabEnabled && removeTabEnabled;
    const hasUnselectedAdd = addTabEnabled && selectedAddCount === 0;
    const hasUnselectedRemove = removeTabEnabled && selectedRemoveCount === 0;
    if (hasBothPending && (hasUnselectedAdd || hasUnselectedRemove)) {
      if (partialSubmitConfirmed) {
        submitSelectedChanges();
        return;
      }
      const missingTab = hasUnselectedAdd ? 'add' : 'remove';
      const missingType = hasUnselectedAdd ? t('新增') : t('删除');
      const missingCount = hasUnselectedAdd
        ? normalizedAddModels.length
        : normalizedRemoveModels.length;
      setActiveTab(missingTab);
      showConfirm({
        title: t('仍有未处理项'),
        content: t(
          '你还没有处理{{type}}模型（{{count}}个）。是否仅提交当前已勾选内容？',
          {
            type: missingType,
            count: missingCount,
          },
        ),
        okText: t('仅提交已勾选'),
        cancelText: t('去处理{{type}}', { type: missingType }),
        onOk: () => {
          setPartialSubmitConfirmed(true);
          submitSelectedChanges();
        },
      });
      return;
    }

    submitSelectedChanges();
  };

  return (
    <ModalDialog
      open={visible}
      onClose={onCancel}
      title={t('处理上游模型更新')}
      width={isMobile ? 'calc(100vw - 16px)' : 640}
      footer={
        <>
          <Button variant='secondary' onClick={onCancel}>
            {t('取消')}
          </Button>
          <Button onClick={handleSubmit} loading={confirmLoading}>
            {t('确定')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-3'>
        <span className='text-xs text-ui-text-2'>
          {t(
            '可勾选需要执行的变更：新增会加入渠道模型列表，删除会从渠道模型列表移除。',
          )}
        </span>

        {/* Tabs */}
        <div className='flex items-center gap-0.5 border-b border-ui-border overflow-x-auto scrollbar-hide'>
          {tabList.map((tab) => {
            const isActive = activeTab === tab.itemKey;
            return (
              <Button
                key={tab.itemKey}
                variant='tab'
                size='sm'
                selected={isActive}
                disabled={tab.disabled}
                onClick={() => setActiveTab(tab.itemKey)}
              >
                {tab.tab}
              </Button>
            );
          })}
        </div>

        <div className='flex items-center gap-3 text-xs text-ui-text-3'>
          <span>
            {t('新增已选 {{selected}} / {{total}}', {
              selected: selectedAddCount,
              total: normalizedAddModels.length,
            })}
          </span>
          <span>
            {t('删除已选 {{selected}} / {{total}}', {
              selected: selectedRemoveCount,
              total: normalizedRemoveModels.length,
            })}
          </span>
        </div>

        <TextField
          prefix={<Search size={14} />}
          placeholder={t('搜索模型')}
          value={keyword}
          onChange={(value) => setKeyword(value)}
        />

        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 8 }}>
          {currentModels.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-ui-text-3'>
              <Search size={32} className='mb-2 opacity-50' />
              <span className='text-sm'>{t('暂无匹配模型')}</span>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4'>
              {currentModels.map((model) => {
                const checked = currentSelectedModels.includes(model);
                return (
                  <Checkbox
                    key={`${activeTab}:${model}`}
                    checked={checked}
                    onChange={(c) => {
                      if (c) {
                        currentSetSelectedModels(
                          normalizeModels([...currentSelectedModels, model]),
                        );
                      } else {
                        currentSetSelectedModels(
                          currentSelectedModels.filter((m) => m !== model),
                        );
                      }
                    }}
                    label={model}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className='flex items-center justify-end gap-2'>
          <span className='text-xs text-ui-text-3'>
            {t('已选择 {{selected}} / {{total}}', {
              selected: checkedCount,
              total: currentModels.length,
            })}
          </span>
          <Checkbox
            checked={isAllChecked}
            indeterminate={isIndeterminate}
            onChange={(c) => handleToggleAllCurrent(c)}
          />
        </div>
      </div>
    </ModalDialog>
  );
};

export default ChannelUpstreamUpdateModal;
