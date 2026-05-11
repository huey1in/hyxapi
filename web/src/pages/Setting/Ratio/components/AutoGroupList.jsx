/*
 * AutoGroupList — ordered auto-group selector.
 * Token-system rewrite using native select.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../../components/common/ConfirmDialog';
import { Button, IconButton } from '../../../../components/ui';

let _idCounter = 0;
const uid = () => `ag_${++_idCounter}`;

function parseAutoGroups(str) {
  if (!str || !str.trim()) return [];
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string').map((name) => ({ _id: uid(), name }));
  } catch { return []; }
}

function serializeAutoGroups(items) {
  const names = items.map((i) => i.name).filter(Boolean);
  return names.length === 0 ? '' : JSON.stringify(names);
}

export default function AutoGroupList({ value, groupNames = [], onChange }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(() => parseAutoGroups(value));

  const emitChange = useCallback((newItems) => {
    setItems(newItems);
    onChange?.(serializeAutoGroups(newItems));
  }, [onChange]);

  const addItem = useCallback(() => {
    emitChange([...items, { _id: uid(), name: '' }]);
  }, [items, emitChange]);

  const removeItem = useCallback((id) => {
    showConfirm({
      title: t('确认移除？'),
      danger: true,
      okText: t('确认'),
      onOk: () => emitChange(items.filter((i) => i._id !== id)),
    });
  }, [items, emitChange, t]);

  const updateItem = useCallback((id, name) => {
    emitChange(items.map((i) => (i._id === id ? { ...i, name } : i)));
  }, [items, emitChange]);

  const moveUp = useCallback((index) => {
    if (index <= 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    emitChange(next);
  }, [items, emitChange]);

  const moveDown = useCallback((index) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    emitChange(next);
  }, [items, emitChange]);

  const selectCls = 'flex-1 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

  if (items.length === 0) {
    return (
      <div>
        <div className='text-center text-xs text-ui-text-3 py-4'>{t('暂无自动分组，点击下方按钮添加')}</div>
        <div className='flex justify-center'>
          <Button size='sm' variant='secondary' onClick={addItem}>
            {t('添加分组')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {items.map((item, index) => (
        <div key={item._id} className='flex items-center gap-2'>
          <span className='inline-block w-6 h-6 text-center text-[10px] font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 leading-6 shrink-0'>
            {index + 1}
          </span>
          <select
            value={item.name || ''}
            onChange={(e) => updateItem(item._id, e.target.value)}
            className={selectCls}
          >
            <option value=''>{t('选择分组')}</option>
            {groupNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <button onClick={() => moveUp(index)} disabled={index === 0}
            className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-hover disabled:opacity-30 transition-colors'>
            </button>
          <button onClick={() => moveDown(index)} disabled={index === items.length - 1}
            className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-hover disabled:opacity-30 transition-colors'>
            </button>
          <button onClick={() => removeItem(item._id)}
            className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'>
            </button>
        </div>
      ))}
      <div className='flex justify-center'>
        <Button size='sm' variant='secondary' onClick={addItem}>
          {t('添加分组')}
        </Button>
      </div>
    </div>
  );
}
