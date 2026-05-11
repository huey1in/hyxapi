/*
 * Input — 全站统一文本输入框
 *
 * 优先用法（包装组件）：
 *   <Input value={v} onChange={setV} placeholder='...' />
 *   <Input prefix={<Search size={14}/>} clearable value={kw} onChange={setKw} />
 *
 * 当无法用包装组件（原生 <textarea>/<select>/<input type='date'> 等）时，
 * 用 className 工厂保持视觉一致：
 *   import { inputClass } from '@/components/ui';
 *   <textarea className={inputClass({ variant: 'admin' })} ... />
 *
 * 业务方禁止再写 'border border-ui-border rounded-xl px-X py-Y ...' 自造 input。
 *
 * variant: admin (默认 rounded-xl) | auth (rounded-lg + focus ring)
 * size:    sm | md (默认) | lg
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn, FOCUS_RING } from './tokens';

// ─── 常量 ─────────────────────────────────────────
const VARIANT_BORDER = {
  admin: 'border border-ui-border rounded-xl bg-transparent text-ui-text outline-none focus:border-ui-text-3 transition-colors',
  auth: 'border border-ui-border rounded-lg bg-transparent text-ui-text outline-none focus:ring-2 focus:ring-ui-accent transition-shadow',
  inline: 'border border-ui-border rounded bg-ui-bg-subtle text-ui-text outline-none focus:ring-1 focus:ring-ui-accent/40 transition-shadow',
};

const SIZE_PAD = { sm: 'px-2.5 py-1.5', md: 'px-3 py-2', lg: 'px-4 py-2.5' };
const SIZE_TEXT = { sm: 'text-xs', md: 'text-sm', lg: 'text-sm' };
const COMMON = 'w-full placeholder:text-ui-text-3 disabled:opacity-50 disabled:cursor-not-allowed';

// className 工厂（无法用组件时使用）
export const inputClass = ({ variant = 'admin', size = 'md', className = '' } = {}) =>
  cn(COMMON, VARIANT_BORDER[variant], SIZE_PAD[size], SIZE_TEXT[size], className);

// 包装组件
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
    variant = 'admin',
    size = 'md',
    className,
    inputClassName,
    ...rest
  },
  ref,
) {
  const handleChange = (e) => {
    if (typeof onChange !== 'function') return;
    if (onChange.length === 1) onChange(e.target.value);
    else onChange(e.target.value, e);
  };

  const showClear = clearable && value && !disabled;
  const hasPrefix = !!prefix;
  const hasSuffix = !!suffix || showClear;

  // 容器只负责 border/radius/focus 状态（去掉 outline/transition 重复）
  const wrapperVariant = (() => {
    if (variant === 'admin') {
      return cn(
        'border rounded-xl bg-transparent transition-colors',
        invalid ? 'border-ui-danger' : 'border-ui-border focus-within:border-ui-text-3',
      );
    }
    if (variant === 'auth') {
      return cn(
        'border rounded-lg bg-transparent transition-shadow focus-within:ring-2 focus-within:ring-ui-accent',
        invalid ? 'border-ui-danger' : 'border-ui-border',
      );
    }
    // inline
    return cn(
      'border rounded bg-ui-bg-subtle transition-shadow focus-within:ring-1 focus-within:ring-ui-accent/40',
      invalid ? 'border-ui-danger' : 'border-ui-border',
    );
  })();

  // 内部 input 不重复 border，由容器负责；padding 按 size + prefix/suffix 调整
  const sidePad = (which) => {
    const has = which === 'left' ? hasPrefix : hasSuffix;
    if (has) return which === 'left' ? 'pl-2' : 'pr-2';
    return SIZE_PAD[size].split(' ')[0]; // px-X
  };
  const verticalPad = SIZE_PAD[size].split(' ')[1]; // py-X

  return (
    <div
      className={cn(
        'relative inline-flex items-center w-full',
        wrapperVariant,
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
          'flex-1 min-w-0 bg-transparent outline-none text-ui-text placeholder:text-ui-text-3',
          SIZE_TEXT[size],
          sidePad('left'),
          sidePad('right'),
          verticalPad,
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
          aria-label='clear'
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
