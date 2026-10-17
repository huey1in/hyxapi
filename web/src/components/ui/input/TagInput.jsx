/*
 * TagInput — 标签自由输入
 *
 * value:    string[]
 * onChange: (next) => void
 * placeholder, disabled
 *
 * 行为：键入 Enter / 逗号 / 换行 提交当前文本为新 tag；Backspace 删最后一项。
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../tokens';
import { resolveWidth } from './Input';

const TagInput = ({ value = [], onChange, placeholder, disabled, width }) => {
  const [draft, setDraft] = useState('');

  const commit = (raw) => {
    const items = String(raw).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...value];
    items.forEach((m) => { if (!next.includes(m)) next.push(m); });
    onChange?.(next);
    setDraft('');
  };

  const removeAt = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const w = resolveWidth(width);

  return (
    <div
      style={w.style}
      className={cn(
        'flex flex-wrap items-center gap-1 min-h-[40px] p-2 bg-transparent border border-ui-border rounded-xl focus-within:border-ui-text-3 transition-colors',
        w.className,
        disabled && 'opacity-50',
      )}
    >
      {value.map((v, idx) => (
        <span key={`${v}-${idx}`} className='inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-ui-bg-subtle border border-ui-border text-ui-text-2'>
          {v}
          {!disabled && (
            <button
              type='button'
              onClick={() => removeAt(idx)}
              className='inline-flex items-center justify-center -mr-0.5 ml-0.5 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10'
              aria-label='remove'
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      <input
        type='text'
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            removeAt(value.length - 1);
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
        className='flex-1 min-w-[80px] bg-transparent outline-hidden text-sm py-0.5 placeholder:text-ui-text-3'
      />
    </div>
  );
};

export default TagInput;
