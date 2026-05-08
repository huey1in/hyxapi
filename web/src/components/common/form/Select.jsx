/*
 * Token-system Select dropdown — thin wrapper over the shared
 * <Dropdown> primitive in components/common/ui. Kept for backwards
 * compatibility with the channels table.
 */
import React from 'react';
import Dropdown from '../ui/Dropdown';

const Select = ({
  value,
  onChange,
  options = [],
  placeholder,
  className = '',
  width,
}) => (
  <Dropdown
    options={options}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    portal
    placement='bottom-start'
    triggerClassName={`${className} ${width ? '' : ''}`}
    popupClassName='w-56'
    renderTrigger={
      width
        ? ({ open, current, ref, onClick }) => (
            <button
              ref={ref}
              type='button'
              onClick={onClick}
              style={{ width, backgroundColor: 'var(--page-bg)' }}
              className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-sm border border-ui-border rounded-xl text-ui-text outline-none hover:border-ui-text-3 transition-colors cursor-pointer ${className}`}
            >
              <span className='truncate'>{current?.label || placeholder || ''}</span>
              <svg
                width='12'
                height='12'
                viewBox='0 0 20 20'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.75'
                strokeLinecap='round'
                strokeLinejoin='round'
                className={`text-ui-text-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden
              >
                <path d='M5 8l5 5 5-5' />
              </svg>
            </button>
          )
        : undefined
    }
  />
);

export default Select;
