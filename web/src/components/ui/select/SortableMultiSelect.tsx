import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, GripVertical, X } from 'lucide-react';
import { inputStyle } from '../input/Input';
import { cn, FOCUS_RING } from '../tokens';
import useDropdownState from './useDropdownState';
import useDropdownLayout from './useDropdownLayout';
import { selectorStyle } from './selectorSizing';

type Props = {
  id?: string;
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  disabled?: boolean;
  width?: CSSProperties['width'] | 'full';
};
type Drag = { pointer: number; item: string; x: number; y: number; order: string[] };

export default function SortableMultiSelect({ id, label, options, value, onChange, placeholder, maxSelected = Infinity, disabled = false, width }: Props) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef<HTMLDivElement>(null);
  const focusMenu = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [open, setOpen] = useDropdownState(container, trigger);
  const menuId = useId();
  const instructionsId = useId();
  const selected = preview ?? value;
  const selectedSet = new Set(selected);
  const ordered = [...selected, ...options.filter((item) => !selectedSet.has(item))];
  const { height, ...style } = inputStyle().style;

  useLayoutEffect(() => {
    drag.current = null;
    setPreview(null);
  }, [open, value]);

  useDropdownLayout({ open, trigger, menu, content: items, placement: 'bottom-end' });
  useLayoutEffect(() => {
    if (open && focusMenu.current) {
      items.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      focusMenu.current = false;
    }
  }, [open]);

  const toggle = (item: string) => {
    if (disabled || drag.current) return;
    if (value.includes(item)) onChange(value.filter((entry) => entry !== item));
    else if (value.length < maxSelected) onChange([...value, item]);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 4) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sortable-item]');
    if (!target || !menu.current?.contains(target)) return;
    const from = active.order.indexOf(active.item);
    const to = active.order.indexOf(target.dataset.sortableItem ?? '');
    if (from < 0 || to < 0 || from === to) return;
    const bounds = target.getBoundingClientRect();
    if (from < to && event.clientY < bounds.top + bounds.height / 2 || from > to && event.clientY > bounds.top + bounds.height / 2) return;
    const next = [...active.order];
    next.splice(from, 1);
    next.splice(to, 0, active.item);
    active.order = next;
    setPreview(next);
    const scroll = items.current;
    if (scroll) {
      const bounds = scroll.getBoundingClientRect();
      if (event.clientY > bounds.bottom - 24) scroll.scrollTop += 20;
      else if (event.clientY < bounds.top + 24) scroll.scrollTop -= 20;
    }
  };
  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (commit && inside && active.order.some((item, index) => item !== value[index])) onChange(active.order);
  };

  return <div ref={container} className='relative inline-flex' style={selectorStyle(width)} onKeyDownCapture={(event) => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true });
  }}>
    <div style={{ ...style, minHeight: height, paddingTop: 4, paddingBottom: 4 }} className={cn(inputStyle().className, 'relative flex w-full min-w-0 items-center justify-between gap-2', open && 'border-ui-text-3', disabled && 'opacity-50')}>
      <button ref={trigger} id={id} type='button' aria-label={label} aria-haspopup='dialog' aria-expanded={open} aria-controls={open ? menuId : undefined}
        disabled={disabled} onClick={() => setOpen((previous) => !previous)} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) { event.preventDefault(); focusMenu.current = true; setOpen(true); }
        }} className={cn('absolute inset-0 rounded-xl', FOCUS_RING, disabled ? 'cursor-not-allowed' : 'cursor-pointer')} />
      <div className='pointer-events-none flex min-w-0 flex-1 flex-wrap gap-1'>
        {!selected.length && <span className='min-w-0 truncate text-sm text-ui-text-3'>{placeholder ?? t('Please select')}</span>}
        {selected.map((item) => <span key={item} title={item} className='relative inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-ui-border bg-ui-bg-subtle px-1.5 py-0.5 text-xs text-ui-text-2'>
          <span className='truncate'>{item}</span>
          <button type='button' disabled={disabled || !!preview} aria-label={t('Remove {{item}}', { item })} onClick={() => { toggle(item); trigger.current?.focus({ preventScroll: true }); }}
            className={cn('pointer-events-auto flex h-4 w-4 shrink-0 items-center justify-center rounded hover:text-ui-text', FOCUS_RING)}><X size={11} /></button>
        </span>)}
      </div>
      <ChevronDown size={14} className={cn('pointer-events-none shrink-0 text-ui-text-3 transition-transform', open && 'rotate-180')} />
    </div>
    <span id={instructionsId} className='sr-only'>{t('Use Arrow Up and Arrow Down to change priority')}</span>
    {open && <div ref={menu} id={menuId} role='dialog' aria-label={label} popover='manual'
      onPointerMove={move} onPointerUp={(event) => finish(event, true)} onPointerCancel={(event) => finish(event, false)}
      onLostPointerCapture={() => { drag.current = null; setPreview(null); }}
      className='rounded-xl border border-ui-border bg-[var(--page-bg)] shadow-lg' style={{ position: 'fixed', inset: 'auto', margin: 0, padding: 0 }}>
      <div ref={items} className='max-h-72 overflow-y-auto p-1'>
        {!ordered.length && <p className='px-2 py-3 text-center text-xs text-ui-text-3'>{t('No matches')}</p>}
        {ordered.map((item, index) => {
          const checked = selectedSet.has(item);
          return <div key={item} data-sortable-item={item} className={cn('flex min-w-0 items-center gap-1 rounded-lg', checked && 'bg-ui-bg-subtle', preview && drag.current?.item === item && 'ring-1 ring-inset ring-ui-text-3', index === selected.length && index > 0 && 'mt-1 border-t border-ui-border')}>
            <button type='button' aria-label={item} aria-pressed={checked} disabled={disabled || !checked && selected.length >= maxSelected} onClick={() => toggle(item)}
              className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ui-text hover:bg-ui-bg-subtle disabled:cursor-not-allowed disabled:opacity-40', FOCUS_RING)}>
              {checked && <span className='shrink-0 text-xs text-ui-text-3'>{index + 1}</span>}
              <span title={item} className='min-w-0 flex-1 truncate'>{item}</span>
              {checked && <Check size={13} className='shrink-0 text-ui-text-3' />}
            </button>
            {checked && <button type='button' aria-label={t('Reorder {{item}}', { item })} aria-describedby={instructionsId} aria-keyshortcuts='ArrowUp ArrowDown' disabled={disabled}
              onClick={(event) => event.stopPropagation()} onPointerDown={(event) => {
                if (disabled || event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.focus({ preventScroll: true });
                drag.current = { pointer: event.pointerId, item, x: event.clientX, y: event.clientY, order: [...value] };
                setPreview([...value]);
                menu.current?.setPointerCapture(event.pointerId);
              }} onKeyDown={(event) => {
                if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                event.preventDefault();
                const from = value.indexOf(item), to = from + (event.key === 'ArrowUp' ? -1 : 1);
                if (to < 0 || to >= value.length) return;
                const next = [...value]; [next[from], next[to]] = [next[to], next[from]]; onChange(next);
              }} style={{ touchAction: 'none' }} className={cn('mr-1 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-ui-text-3 hover:text-ui-text active:cursor-grabbing', FOCUS_RING)}><GripVertical size={15} /></button>}
          </div>;
        })}
        {selected.length > 1 && <p className='px-2 pb-1 pt-2 text-xs text-ui-text-3'>{t('Drag selected items to reorder')}</p>}
      </div>
    </div>}
  </div>;
}
