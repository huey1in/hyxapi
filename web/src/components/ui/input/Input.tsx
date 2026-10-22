/*
 * Input — 文本输入框
 *
 * 业务方禁止传 className —— 通过 props 表达视觉。
 *
 * variant:  admin (默认 rounded-xl) | inline (rounded-sm + bg-subtle)
 * size:     数字，控制高度(px) 与字号；默认 36 → 字号 14
 * width:    见 resolveWidth；默认 100%（自适应容器）
 * prefix:   左侧 React 节点
 * suffix:   右侧 React 节点
 * clearable: value 非空时显示 × 清除按钮
 * invalid:  显示红色边框
 *
 * 当无法用包装组件时（textarea / select 等），用样式工厂：
 *   import { inputStyle } from '...';
 *   const s = inputStyle({ variant, size });
 *   <textarea className={s.className} style={s.style} />
 */

import React from 'react';
import type { CSSProperties, InputHTMLAttributes, ReactNode, ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../tokens';

const VARIANT = {
  admin:  'border border-ui-border rounded-xl bg-transparent text-ui-text outline-hidden focus:border-ui-text-3 transition-colors',
  auth:   'border border-ui-border rounded-lg bg-transparent text-ui-text outline-hidden focus:ring-2 focus:ring-ui-accent transition-shadow',
  inline: 'border border-ui-border rounded-sm bg-ui-bg-subtle text-ui-text outline-hidden focus:ring-1 focus:ring-ui-accent/40 transition-shadow',
};
const COMMON = 'placeholder:text-ui-text-3 disabled:opacity-50 disabled:cursor-not-allowed';

type InputVariant = keyof typeof VARIANT;
type InputStyleOptions = { variant?: InputVariant; size?: number };
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'width' | 'prefix' | 'onChange'> {
  onChange?: (value: string, event?: ChangeEvent<HTMLInputElement>) => void;
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearable?: boolean;
  invalid?: boolean;
  variant?: InputVariant;
  size?: number;
  width?: CSSProperties['width'] | 'full';
}

const fontSizeFor = (size: number) => (size <= 28 ? 12 : size <= 36 ? 14 : 16);

export const inputStyle = ({ variant = 'admin', size = 36 }: InputStyleOptions = {}): { className: string; style: CSSProperties } => {
  const padX = Math.max(8, Math.round(size * 0.34));
  return {
    className: cn(COMMON, VARIANT[variant]),
    style: {
      height: size,
      paddingLeft: padX,
      paddingRight: padX,
      fontSize: fontSizeFor(size),
    },
  };
};

/* 解析 width prop：
 *   undefined  -> 默认 100%（自适应容器）
 *   'full'     -> 占满父容器
 *   number     -> px
 *   其它字符串 -> 原样作为 CSS width（如 '20rem'、'50%'）
 */
export const resolveWidth = (width?: CSSProperties['width'] | 'full'): { className: string; style?: CSSProperties } => {
  if (width === 'full') return { className: 'w-full', style: undefined };
  if (width == null)    return { className: '',       style: { width: '100%' } };
  if (typeof width === 'number') return { className: '', style: { width: `${width}px` } };
  return { className: '', style: { width } };
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
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
    size = 36,
    width,
    className,
    ...rest
  },
  ref,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (typeof onChange !== 'function') return;
    if (onChange.length === 1) onChange(e.target.value);
    else onChange(e.target.value, e);
  };

  const showClear = clearable && value && !disabled;
  const hasPrefix = !!prefix;
  const hasSuffix = !!suffix || showClear;

  const wrapper =
    variant === 'admin'
      ? cn(
          'border rounded-xl bg-transparent transition-colors',
          invalid ? 'border-ui-danger' : 'border-ui-border focus-within:border-ui-text-3',
        )
      : variant === 'auth'
        ? cn(
            'border rounded-lg bg-transparent transition-shadow focus-within:ring-2 focus-within:ring-ui-accent',
            invalid ? 'border-ui-danger' : 'border-ui-border',
          )
        : cn(
            'border rounded-sm bg-ui-bg-subtle transition-shadow focus-within:ring-1 focus-within:ring-ui-accent/40',
            invalid ? 'border-ui-danger' : 'border-ui-border',
          );

  const padX = Math.max(8, Math.round(size * 0.34));
  const fz = fontSizeFor(size);
  const w = resolveWidth(width);

  return (
    <div
      style={{ ...w.style, height: size }}
      className={cn('relative inline-flex items-center', w.className, wrapper, className, disabled && 'opacity-50 cursor-not-allowed')}
    >
      {hasPrefix && (
        <span className='flex items-center text-ui-text-3 pointer-events-none' style={{ paddingLeft: padX }}>
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
        style={{
          paddingLeft: hasPrefix ? 8 : padX,
          paddingRight: hasSuffix ? 8 : padX,
          fontSize: fz,
        }}
        className='flex-1 min-w-0 h-full bg-transparent outline-hidden text-ui-text placeholder:text-ui-text-3'
        {...rest}
      />
      {showClear && (
        <button
          type='button'
          onClick={() => onChange?.('')}
          className='flex items-center justify-center mr-1.5 p-0.5 rounded-sm text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
          tabIndex={-1}
          aria-label='clear'
        >
          <X size={12} />
        </button>
      )}
      {suffix && !showClear && (
        <span className='flex items-center text-ui-text-3' style={{ paddingRight: padX }}>{suffix}</span>
      )}
    </div>
  );
});

export default Input;
