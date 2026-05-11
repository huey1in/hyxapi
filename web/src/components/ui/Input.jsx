/*
 * Input — 统一文本输入框
 *
 * 支持 prefix/suffix（任意 React 节点或 lucide 图标组件）
 * 支持 clearable（自动渲染清除按钮）
 * 支持 invalid 状态
 *
 * 使用：
 *   <Input value={v} onChange={setV} placeholder='搜索...' />
 *   <Input prefix={<Search size={14} />} clearable value={kw} onChange={setKw} />
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn, FOCUS_RING } from './tokens';

const Input = React.forwardRef(function Input(
  {
    value,
    onChange,
    type = 'text',
    placeholder,
    prefix,
    suffix,
    clearable = false,
    invalid = false,
    disabled = false,
    className,
    inputClassName,
    ...rest
  },
  ref,
) {
  const handleChange = (e) => {
    if (typeof onChange === 'function') {
      // 兼容两种调用形式：onChange(value) 或 onChange(event)
      if (onChange.length === 1) onChange(e.target.value);
      else onChange(e.target.value, e);
    }
  };

  const showClear = clearable && value && !disabled;
  const hasPrefix = !!prefix;
  const hasSuffix = !!suffix || showClear;

  return (
    <div
      className={cn(
        'relative inline-flex items-center w-full bg-transparent border rounded-xl transition-colors',
        invalid ? 'border-ui-danger' : 'border-ui-border focus-within:border-ui-text-3',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {hasPrefix && (
        <span className='flex items-center pl-3 text-ui-text-3 pointer-events-none'>
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        type={type}
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex-1 min-w-0 bg-transparent outline-none text-sm text-ui-text placeholder:text-ui-text-3',
          hasPrefix ? 'pl-2' : 'pl-3',
          hasSuffix ? 'pr-2' : 'pr-3',
          'py-2',
          FOCUS_RING.replace('focus-visible:', '').replace('focus:', 'focus-within:'),
          inputClassName,
        )}
        {...rest}
      />
      {showClear && (
        <button
          type='button'
          onClick={() => onChange?.('')}
          className='flex items-center justify-center mr-1.5 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
          tabIndex={-1}
        >
          <X size={12} />
        </button>
      )}
      {suffix && !showClear && (
        <span className='flex items-center pr-3 text-ui-text-3'>{suffix}</span>
      )}
    </div>
  );
});

export default Input;
