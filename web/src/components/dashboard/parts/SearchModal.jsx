/*
 * Search modal — uses native datetime-local inputs to drop semi-ui Form/DatePicker.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ChevronDownIcon from '../../layout/headerbar/icons/ChevronDownIcon';
import SquircleBox from '../../common/ui/SquircleBox';

const toLocalDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Dropdown = ({ value, options = [], onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find((opt) => opt.value === value);

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text hover:border-ui-text-3 transition-colors'
      >
        <span className={current ? '' : 'text-ui-text-3'}>
          {current ? current.label : (placeholder || '')}
        </span>
        <ChevronDownIcon
          size={14}
          className={`text-ui-text-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className='absolute left-0 right-0 mt-2 bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown'>
          <div className='px-2 py-2 flex flex-col gap-0.5 max-h-64 overflow-y-auto'>
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type='button'
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    selected
                      ? 'bg-ui-bg-subtle text-ui-text font-medium'
                      : 'text-ui-text hover:bg-ui-bg-subtle'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selected && (
                    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                      <path d='M2 7l3.5 3.5 6.5-7' />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  const downOnMaskRef = useRef(false);

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
    'w-full px-3 py-2 text-sm border border-ui-border rounded-xl text-ui-text outline-none focus:border-ui-text-3 transition-colors';
  const transparentBg = { backgroundColor: 'transparent', colorScheme: 'light' };

  const onChange = (key) => (e) => handleInputChange(e.target.value, key);

  return createPortal(
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={(e) => {
        downOnMaskRef.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (downOnMaskRef.current && e.target === e.currentTarget) {
          handleCloseModal();
        }
        downOnMaskRef.current = false;
      }}
    >
      <SquircleBox
        radius={40}
        smoothing={0.9}
        className={`w-full ${isMobile ? 'max-w-none' : 'max-w-md'} shadow-2xl`}
      >
        <div onMouseDown={(e) => e.stopPropagation()}>
        <div className='flex items-center justify-between px-5 py-3.5'>
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

        <div className='px-5 py-5'>
          <div className='space-y-4 max-w-[340px] mx-auto'>
            <div>
              <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
                {t('起始时间')}
              </label>
              <input
                type='datetime-local'
                value={toLocalDateTime(inputs.start_timestamp)}
                onChange={onChange('start_timestamp')}
                className={inputClass}
                style={transparentBg}
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
                style={transparentBg}
              />
            </div>

            <div>
              <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>
                {t('时间粒度')}
              </label>
              <Dropdown
                value={dataExportDefaultTime || ''}
                options={timeOptions || []}
                onChange={(v) => handleInputChange(v, 'data_export_default_time')}
                placeholder={t('请选择')}
              />
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
                  style={transparentBg}
                />
              </div>
            )}
          </div>
        </div>

        <div className='flex justify-end gap-2 px-5 py-3'>
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
      </SquircleBox>
    </div>,
    document.body,
  );
};

export default SearchModal;
