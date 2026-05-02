/*
 * Search modal — uses native datetime-local inputs to drop semi-ui Form/DatePicker.
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const toLocalDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SearchModal = ({
  searchModalVisible,
  handleSearchConfirm,
  handleCloseModal,
  isMobile,
  isAdminUser,
  inputs,
  dataExportDefaultTime,
  timeOptions,
  handleInputChange,
  t,
}) => {
  useEffect(() => {
    if (!searchModalVisible) return;
    const onKey = (e) => e.key === 'Escape' && handleCloseModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [searchModalVisible, handleCloseModal]);

  if (!searchModalVisible) return null;
  if (typeof document === 'undefined') return null;

  const inputClass =
    'w-full px-3 py-2 text-sm bg-ui-bg border border-ui-border rounded-lg text-ui-text outline-none focus:border-ui-text-3 transition-colors';

  const onChange = (key) => (e) => handleInputChange(e.target.value, key);

  return createPortal(
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={handleCloseModal}
    >
      <div
        className={`bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full ${
          isMobile ? 'max-w-none' : 'max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>
            {t('搜索条件')}
          </span>
          <button
            onClick={handleCloseModal}
            aria-label='close'
            className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <X size={16} />
          </button>
        </div>

        <div className='p-5 space-y-4'>
          <div>
            <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
              {t('起始时间')}
            </label>
            <input
              type='datetime-local'
              value={toLocalDateTime(inputs.start_timestamp)}
              onChange={onChange('start_timestamp')}
              className={inputClass}
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
              {t('结束时间')}
            </label>
            <input
              type='datetime-local'
              value={toLocalDateTime(inputs.end_timestamp)}
              onChange={onChange('end_timestamp')}
              className={inputClass}
            />
          </div>

          <div>
            <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
              {t('时间粒度')}
            </label>
            <select
              value={dataExportDefaultTime || ''}
              onChange={onChange('data_export_default_time')}
              className={inputClass}
            >
              {(timeOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isAdminUser && (
            <div>
              <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
                {t('用户名称')}
              </label>
              <input
                type='text'
                value={inputs.username || ''}
                onChange={onChange('username')}
                placeholder={t('可选值')}
                className={`${inputClass} placeholder:text-ui-text-3`}
              />
            </div>
          )}
        </div>

        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <button
            onClick={handleCloseModal}
            className='px-4 py-1.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={handleSearchConfirm}
            className='px-4 py-1.5 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
          >
            {t('确定')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SearchModal;
