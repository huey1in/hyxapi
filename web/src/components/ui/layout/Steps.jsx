/*
 * Steps — 步骤条
 *
 * items: [{ title, description? }]
 * current: 当前步骤索引（从 0 开始）
 * direction: horizontal (默认) | vertical
 *
 * 状态推断：i < current → done；i === current → active；i > current → pending
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../tokens';

const Marker = ({ state, index }) => {
  const cls = state === 'done'
    ? 'bg-ui-accent text-ui-accent-fg border-ui-accent'
    : state === 'active'
    ? 'border-ui-accent text-ui-accent bg-[var(--page-bg)]'
    : 'border-ui-border text-ui-text-3 bg-[var(--page-bg)]';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs tabular-nums', cls)}>
      {state === 'done' ? <Check size={12} /> : index + 1}
    </span>
  );
};

const stateOf = (i, current) => (i < current ? 'done' : i === current ? 'active' : 'pending');

const Steps = ({ items = [], current = 0, direction = 'horizontal' }) => {
  if (direction === 'vertical') {
    return (
      <ol className='flex flex-col gap-3'>
        {items.map((it, i) => {
          const st = stateOf(i, current);
          return (
            <li key={i} className='flex gap-3'>
              <div className='flex flex-col items-center'>
                <Marker state={st} index={i} />
                {i < items.length - 1 && <span className={cn('w-px flex-1 mt-1', st === 'pending' ? 'bg-ui-border' : 'bg-ui-accent')} />}
              </div>
              <div className='pb-3'>
                <div className={cn('text-sm', st === 'pending' ? 'text-ui-text-3' : 'text-ui-text')}>{it.title}</div>
                {it.description && <div className='text-xs text-ui-text-3 mt-0.5'>{it.description}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className='flex items-start gap-2 w-full'>
      {items.map((it, i) => {
        const st = stateOf(i, current);
        return (
          <li key={i} className='flex items-start flex-1 min-w-0'>
            <div className='flex flex-col items-center'>
              <Marker state={st} index={i} />
              <div className={cn('mt-1.5 text-xs text-center max-w-[120px] truncate', st === 'pending' ? 'text-ui-text-3' : 'text-ui-text')}>{it.title}</div>
            </div>
            {i < items.length - 1 && (
              <span className={cn('flex-1 h-px mt-3 mx-2', i < current ? 'bg-ui-accent' : 'bg-ui-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default Steps;
