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

import React from 'react';
import { Check } from 'lucide-react';
import ModalDialog from '../../../common/ModalDialog';
import { getChannelsColumns } from '../ChannelsColumnDefs';

const Checkbox = ({ checked, indeterminate, onChange, children }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className='inline-flex items-center gap-2 cursor-pointer select-none'>
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
      {children && <span className='text-sm text-ui-text'>{children}</span>}
    </label>
  );
};

const ColumnSelectorModal = ({
  showColumnSelector,
  setShowColumnSelector,
  visibleColumns,
  handleColumnVisibilityChange,
  handleSelectAll,
  initDefaultColumns,
  COLUMN_KEYS,
  t,
  // Props needed for getChannelsColumns
  updateChannelBalance,
  manageChannel,
  manageTag,
  submitTagEdit,
  testChannel,
  setCurrentTestChannel,
  setShowModelTestModal,
  setEditingChannel,
  setShowEdit,
  setShowEditTag,
  setEditingTag,
  copySelectedChannel,
  refresh,
  activePage,
  channels,
}) => {
  // Get all columns for display in selector
  const allColumns = getChannelsColumns({
    t,
    COLUMN_KEYS,
    updateChannelBalance,
    manageChannel,
    manageTag,
    submitTagEdit,
    testChannel,
    setCurrentTestChannel,
    setShowModelTestModal,
    setEditingChannel,
    setShowEdit,
    setShowEditTag,
    setEditingTag,
    copySelectedChannel,
    refresh,
    activePage,
    channels,
  });

  const close = () => setShowColumnSelector(false);
  const allChecked = Object.values(visibleColumns).every((v) => v === true);
  const someChecked = Object.values(visibleColumns).some((v) => v === true);

  return (
    <ModalDialog
      open={showColumnSelector}
      onClose={close}
      title={t('列设置')}
      width={560}
      footer={
        <>
          <button
            onClick={() => initDefaultColumns()}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('重置')}
          </button>
          <button
            onClick={close}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={close}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div className='mb-4'>
        <Checkbox
          checked={allChecked}
          indeterminate={someChecked && !allChecked}
          onChange={(checked) => handleSelectAll(checked)}
        >
          {t('全选')}
        </Checkbox>
      </div>
      <div className='flex flex-wrap max-h-96 overflow-y-auto rounded-xl p-4 border border-ui-border bg-ui-bg-elevated'>
        {allColumns.map((column) => {
          // Skip columns without title
          if (!column.title) {
            return null;
          }

          return (
            <div key={column.key} className='w-1/2 mb-4 pr-2'>
              <Checkbox
                checked={!!visibleColumns[column.key]}
                onChange={(checked) =>
                  handleColumnVisibilityChange(column.key, checked)
                }
              >
                {column.title}
              </Checkbox>
            </div>
          );
        })}
      </div>
    </ModalDialog>
  );
};

export default ColumnSelectorModal;
