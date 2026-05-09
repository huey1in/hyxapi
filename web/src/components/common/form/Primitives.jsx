/*
 * Token-system form primitives used to replace Semi UI Form.* fields.
 *
 * Each primitive is fully controlled and renders with our `--ui-*` token
 * system, so they can drop into any page that's moving off Semi.
 *
 * Compose around `<FieldRow label hint extra>` for vertical fields with
 * the standard label/extra-text layout that Semi's Form provided.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown, Save, Loader2 } from 'lucide-react';

// ── shared classes ──────────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const errorCls = 'mt-1.5 text-xs text-ui-danger';
const hintCls = 'mt-1.5 text-xs text-ui-text-3 leading-relaxed';

// ── FieldRow ────────────────────────────────────────────

export const FieldRow = ({ label, required, hint, error, extra, children }) => (
  <div>
    {(label || extra) && (
      <div className='flex items-center justify-between gap-2 mb-2'>
        {label && (
          <label className='block text-sm font-medium text-ui-text'>
            {label}
            {required && <span className='text-ui-danger ml-1'>*</span>}
          </label>
        )}
        {extra && <div className='flex items-center gap-1.5'>{extra}</div>}
      </div>
    )}
    {children}
    {error && <p className={errorCls}>{error}</p>}
    {!error && hint && <p className={hintCls}>{hint}</p>}
  </div>
);

// ── TextField ──────────────────────────────────────────

export const TextField = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  prefix,
  suffix,
  className = '',
  ...rest
}) => {
  if (prefix || suffix) {
    return (
      <div className='relative'>
        {prefix && (
          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none'>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputCls} ${prefix ? 'pl-9' : ''} ${suffix ? 'pr-9' : ''} ${className}`}
          {...rest}
        />
        {suffix && (
          <span className='absolute right-3 top-1/2 -translate-y-1/2'>{suffix}</span>
        )}
      </div>
    );
  }
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`${inputCls} ${className}`}
      {...rest}
    />
  );
};

// ── NumberField ────────────────────────────────────────

export const NumberField = ({ value, onChange, min, max, step, disabled, className = '' }) => (
  <input
    type='number'
    value={value ?? 0}
    min={min}
    max={max}
    step={step}
    disabled={disabled}
    onChange={(e) => onChange?.(Number(e.target.value))}
    className={`${inputCls} tabular-nums ${className}`}
  />
);

// ── TextAreaField (auto-resize) ────────────────────────

export const TextAreaField = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  autoResize = true,
  className = '',
  disabled,
  ...rest
}) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!autoResize || !ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.max(ref.current.scrollHeight, 32)}px`;
  }, [value, autoResize]);
  return (
    <textarea
      ref={ref}
      value={value ?? ''}
      rows={rows}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`${inputCls} resize-none ${className}`}
      {...rest}
    />
  );
};

// ── Toggle ─────────────────────────────────────────────

export const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type='button'
    disabled={disabled}
    onClick={() => onChange?.(!checked)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 disabled:opacity-40 ${
      checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform shadow ${
        checked ? 'translate-x-[18px]' : 'translate-x-0.5'
      }`}
      style={{ background: '#ffffff' }}
    />
  </button>
);

export const ToggleField = ({ label, hint, checked, onChange, disabled }) => (
  <div className='flex items-start justify-between gap-4 py-1.5'>
    <div className='min-w-0 flex-1'>
      <div className='text-sm text-ui-text'>{label}</div>
      {hint && <div className='text-[13px] text-ui-text-3 mt-0.5 leading-relaxed'>{hint}</div>}
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

// ── NativeSelect ───────────────────────────────────────

export const NativeSelect = ({ value, onChange, options = [], disabled, className = '' }) => (
  <select
    value={value ?? ''}
    disabled={disabled}
    onChange={(e) => onChange?.(e.target.value)}
    className={`${inputCls} cursor-pointer ${className}`}
  >
    {options.map((o) => {
      const v = typeof o === 'object' ? o.value : o;
      const label = typeof o === 'object' ? o.label : o;
      return (
        <option key={String(v)} value={v}>
          {label}
        </option>
      );
    })}
  </select>
);

// ── Notice (replaces Semi Banner) ─────────────────────

const noticeStyles = {
  info: 'border-blue-500/30 bg-blue-500/5 text-ui-text-2',
  warning: 'border-amber-500/30 bg-amber-500/5 text-ui-text-2',
  danger: 'border-ui-danger/30 bg-ui-danger-bg text-ui-text-2',
};

export const Notice = ({ kind = 'info', icon, children, action }) => (
  <div className={`flex items-start gap-2 px-4 py-3.5 rounded-xl border ${noticeStyles[kind]}`}>
    {icon && <span className='flex-shrink-0 mt-0.5'>{icon}</span>}
    <div className='flex-1 text-xs leading-relaxed'>{children}</div>
    {action && <div className='flex-shrink-0'>{action}</div>}
  </div>
);

// ── Section ────────────────────────────────────────────

export const Section = ({ title, children, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {title && (
      <div className='text-[11px] font-semibold uppercase tracking-widest text-ui-text-3 pb-1.5 border-b border-ui-divider'>
        {title}
      </div>
    )}
    {children}
  </div>
);

// ── Chip (used in TagInput / MultiCombobox) ────────────

export const Chip = ({ children, onRemove, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-ui-bg-subtle border border-ui-border text-ui-text-2 ${className}`}>
    {children}
    {onRemove && (
      <button
        type='button'
        onClick={onRemove}
        className='hover:text-ui-text rounded p-0.5'
      >
        <X size={10} />
      </button>
    )}
  </span>
);

// ── TagInput (text chips, free entry) ──────────────────

export const TagInput = ({ value = [], onChange, placeholder, disabled }) => {
  const [draft, setDraft] = useState('');
  const commit = (raw) => {
    const items = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...value];
    items.forEach((m) => { if (!next.includes(m)) next.push(m); });
    onChange?.(next);
    setDraft('');
  };
  return (
    <div className='flex flex-wrap items-center gap-1 min-h-[40px] p-2 bg-ui-bg-elevated border border-ui-border rounded-xl focus-within:border-ui-text-3 transition-colors'>
      {value.map((v) => (
        <Chip key={v} onRemove={disabled ? undefined : () => onChange?.(value.filter((x) => x !== v))}>
          {v}
        </Chip>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange?.(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={value.length ? '' : placeholder}
        className='flex-1 min-w-[80px] px-1 py-0.5 text-sm bg-transparent outline-none text-ui-text placeholder:text-ui-text-3'
      />
    </div>
  );
};

// ── MultiCombobox ─────────────────────────────────────

export const MultiCombobox = ({
  value = [],
  onChange,
  options = [], // [{value, label, icon?}]
  placeholder = '点击选择…',
  searchPlaceholder = '搜索…',
  allowCreate = false,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const filtered = options
    .filter((o) => !value.includes(o.value))
    .filter((o) => String(o.label || o.value).toLowerCase().includes(keyword.toLowerCase()));

  const add = (v) => onChange?.([...value, v]);
  const remove = (v) => onChange?.(value.filter((x) => x !== v));

  return (
    <div className='space-y-1.5' ref={ref}>
      <div
        onClick={() => !disabled && setOpen(true)}
        className={`flex flex-wrap items-center gap-1 min-h-[40px] p-2 bg-transparent border border-ui-border rounded-xl cursor-text ${disabled ? 'opacity-60' : ''}`}
      >
        {value.length === 0 && (
          <span className='text-[13px] text-ui-text-3 px-1.5'>{placeholder}</span>
        )}
        {value.map((v) => {
          const meta = options.find((o) => o.value === v);
          return (
            <Chip
              key={v}
              onRemove={disabled ? undefined : () => remove(v)}
            >
              {meta?.label || v}
            </Chip>
          );
        })}
      </div>
      {open && (
        <div className='border border-ui-border rounded-2xl overflow-hidden shadow-xl' style={{ backgroundColor: 'var(--page-bg)' }}>
          <div className='relative border-b border-ui-border'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={searchPlaceholder}
              className='w-full pl-9 pr-3 py-2 text-sm bg-transparent outline-none text-ui-text placeholder:text-ui-text-3'
              onKeyDown={(e) => {
                if (e.key === 'Enter' && allowCreate && keyword) {
                  add(keyword.trim());
                  setKeyword('');
                }
              }}
            />
          </div>
          <div className='max-h-60 overflow-y-auto nice-scroll p-1'>
            {filtered.length === 0 ? (
              <div className='py-3 px-3 text-[13px] text-ui-text-3 text-center'>
                {allowCreate && keyword
                  ? `按 Enter 添加 "${keyword}"`
                  : '无匹配项'}
              </div>
            ) : (
              filtered.slice(0, 200).map((o) => (
                <button
                  key={String(o.value)}
                  type='button'
                  onClick={() => add(o.value)}
                  className='flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
                >
                  {o.icon && <span className='flex-shrink-0'>{o.icon}</span>}
                  <span className='truncate'>{o.label || o.value}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Combobox (single select with search + custom render) ──

export const Combobox = ({
  value,
  onChange,
  options = [], // [{value, label, icon?}]
  placeholder = '请选择',
  disabled,
  renderOption,
  searchPlaceholder = '搜索…',
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    String(o.label || o.value).toLowerCase().includes(keyword.toLowerCase()),
  );

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center justify-between gap-2 w-full px-3.5 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text outline-none hover:border-ui-text-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${open ? 'border-ui-text-3' : ''}`}
      >
        <span className={`flex items-center gap-2 truncate ${!current ? 'text-ui-text-3' : ''}`}>
          {current?.icon}
          <span className='truncate'>{current?.label || current?.value || placeholder}</span>
        </span>
        <ChevronDown size={14} className={`text-ui-text-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className='absolute z-50 left-0 right-0 mt-1 max-h-72 border border-ui-border rounded-2xl shadow-xl overflow-hidden flex flex-col' style={{ backgroundColor: 'var(--page-bg)' }}>
          <div className='relative border-b border-ui-border flex-shrink-0'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
            <input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={searchPlaceholder}
              className='w-full pl-9 pr-3 py-2 text-sm bg-transparent outline-none text-ui-text placeholder:text-ui-text-3'
            />
          </div>
          <div className='overflow-y-auto nice-scroll p-1'>
            {filtered.length === 0 ? (
              <div className='py-3 px-3 text-[13px] text-ui-text-3 text-center'>无匹配项</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type='button'
                  onClick={() => { onChange?.(o.value); setOpen(false); setKeyword(''); }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-ui-bg-subtle transition-colors ${
                    value === o.value ? 'bg-ui-bg-subtle text-ui-text font-medium' : 'text-ui-text-2 hover:text-ui-text'
                  }`}
                >
                  {renderOption ? renderOption(o, keyword) : (
                    <>
                      {o.icon && <span className='flex-shrink-0'>{o.icon}</span>}
                      <span className='truncate'>{o.label || o.value}</span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── highlight match ────────────────────────────────────

export const HighlightText = ({ text = '', query = '' }) => {
  if (!query || !text) return <span>{text}</span>;
  const lower = String(text).toLowerCase();
  const q = String(query).toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className='bg-ui-accent/20 text-ui-text px-0.5 rounded'>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
};

// ── createFormApiAdapter ───────────────────────────────

/**
 * Build a Semi-Form-compatible adapter object backed by a useState pair.
 * Exposes the shape sub-components (JSONEditor, ParamOverrideEditorModal,
 * ModelSelectModal, etc.) currently expect from `formApi=` so they keep
 * working without internal changes during the migration.
 */
export function createFormApiAdapter(getInputs, setInputs) {
  return {
    getValues: () => getInputs(),
    getValue: (field) => getInputs()?.[field],
    setValue: (field, value) => setInputs((prev) => ({ ...prev, [field]: value })),
    setValues: (values) => setInputs((prev) => ({ ...prev, ...(values || {}) })),
    reset: () => {},
    submitForm: () => {},
  };
}

// ── DateTimeField ─────────────────────────────────────

export const DateTimeField = ({ value, onChange, disabled, min, max }) => (
  <input
    type='datetime-local'
    value={value || ''}
    min={min}
    max={max}
    disabled={disabled}
    onChange={(e) => onChange?.(e.target.value)}
    className={inputCls}
  />
);

// ── DateField (date-only) ─────────────────────────────

export const DateField = ({ value, onChange, disabled, min, max }) => (
  <input
    type='date'
    value={value || ''}
    min={min}
    max={max}
    disabled={disabled}
    onChange={(e) => onChange?.(e.target.value)}
    className={inputCls}
  />
);

// ── ColorField ────────────────────────────────────────

export const ColorField = ({ value, onChange, disabled }) => (
  <div className='flex items-center gap-2'>
    <input
      type='color'
      value={value || '#3b82f6'}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className='w-9 h-9 rounded-md border border-ui-border bg-ui-bg cursor-pointer disabled:opacity-50'
      style={{ padding: 2 }}
    />
    <input
      type='text'
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder='#3b82f6'
      className={`${inputCls} flex-1 font-mono text-xs`}
    />
  </div>
);

// ── RangeSlider ───────────────────────────────────────

export const RangeSlider = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  formatValue,
}) => (
  <div className='flex items-center gap-3'>
    <input
      type='range'
      min={min}
      max={max}
      step={step}
      value={value ?? min}
      disabled={disabled}
      onChange={(e) => onChange?.(Number(e.target.value))}
      className='flex-1 accent-current cursor-pointer disabled:opacity-50'
    />
    <span className='inline-flex items-center min-w-[60px] justify-end text-xs tabular-nums text-ui-text-2'>
      {formatValue ? formatValue(value ?? min) : value ?? min}
    </span>
  </div>
);

// ── RadioChipGroup ────────────────────────────────────
// Segmented-button radio replacement (was Semi RadioGroup type='button').

export const RadioChipGroup = ({ value, onChange, options = [], disabled }) => (
  <div className='inline-flex items-center gap-0.5 p-0.5 bg-ui-bg-subtle rounded-md border border-ui-border'>
    {options.map((o) => {
      const v = typeof o === 'object' ? o.value : o;
      const label = typeof o === 'object' ? o.label : o;
      const active = v === value;
      return (
        <button
          key={String(v)}
          type='button'
          disabled={disabled}
          onClick={() => onChange?.(v)}
          className={`px-3 py-1 text-xs rounded transition-colors whitespace-nowrap disabled:opacity-50 ${
            active
              ? 'bg-ui-bg-elevated text-ui-text font-semibold shadow-sm'
              : 'text-ui-text-2 hover:text-ui-text'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

// ── SectionWithSave ───────────────────────────────────
// Standard wrapper used by every leaf settings page:
//   - SectionHeader (icon, title, hint)
//   - Children (FieldRow rows)
//   - SaveBar (right-aligned save button, disabled when not dirty)

export const SectionWithSave = ({
  title,
  hint,
  icon: Icon,
  iconColor = 'blue',
  children,
  loading,
  dirty = true,
  onSave,
  onSaveLabel,
  extraActions,
}) => {
  const ICON_COLOR_MAP = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    orange: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  };
  const iconCls = ICON_COLOR_MAP[iconColor] || ICON_COLOR_MAP.blue;

  return (
    <div className='space-y-4'>
      {(title || Icon) && (
        <div className='flex items-center gap-2'>
          {Icon && (
            <div className={`w-8 h-8 rounded-md inline-flex items-center justify-center border ${iconCls}`}>
              <Icon size={15} />
            </div>
          )}
          <div className='flex-1 min-w-0'>
            {title && <div className='text-sm font-semibold text-ui-text'>{title}</div>}
            {hint && <div className='text-[11px] text-ui-text-3 mt-0.5'>{hint}</div>}
          </div>
        </div>
      )}

      <div className='space-y-3'>{children}</div>

      {(onSave || extraActions) && (
        <div className='flex items-center justify-end gap-2 pt-2 border-t border-ui-divider'>
          {extraActions}
          {onSave && (
            <button
              onClick={onSave}
              disabled={loading || !dirty}
              className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 transition-all whitespace-nowrap'
            >
              {loading ? <Loader2 size={11} className='animate-spin' /> : <Save size={11} />}
              {onSaveLabel || (loading ? '保存中...' : '保存')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
