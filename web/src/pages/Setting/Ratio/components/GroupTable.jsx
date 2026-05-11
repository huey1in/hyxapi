/*
 * GroupTable — editable group table for GroupRatioSettings.
 * Token-system rewrite using native inputs.
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../../components/common/ConfirmDialog';
import { Button } from '../../../../components/ui';

let _idCounter = 0;
const uid = () => `gr_${++_idCounter}`;

const inputCls = 'w-full rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40 disabled:opacity-50';
const numInputCls = 'w-20 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

function parseJSON(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function buildRows(groupRatioStr, userUsableGroupsStr) {
  const ratioMap = parseJSON(groupRatioStr, {});
  const usableMap = parseJSON(userUsableGroupsStr, {});
  const allNames = new Set([...Object.keys(ratioMap), ...Object.keys(usableMap)]);
  return Array.from(allNames).map((name) => ({
    _id: uid(),
    name,
    ratio: ratioMap[name] ?? 1,
    selectable: name in usableMap,
    description: usableMap[name] ?? '',
  }));
}

export function serializeGroupTable(rows) {
  const groupRatio = {};
  const userUsableGroups = {};
  rows.forEach((row) => {
    if (!row.name) return;
    groupRatio[row.name] = row.ratio;
    if (row.selectable) {
      userUsableGroups[row.name] = row.description;
    }
  });
  return {
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
  };
}

export default function GroupTable({ groupRatio, userUsableGroups, onChange }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => buildRows(groupRatio, userUsableGroups));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitAndSet = useCallback((updater) => {
    setRows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onChangeRef.current?.(serializeGroupTable(next));
      return next;
    });
  }, []);

  const updateRow = useCallback(
    (id, field, value) => {
      emitAndSet((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)));
    },
    [emitAndSet],
  );

  const addRow = useCallback(() => {
    emitAndSet((prev) => {
      const existingNames = new Set(prev.map((r) => r.name));
      let counter = 1;
      let newName = `group_${counter}`;
      while (existingNames.has(newName)) { counter++; newName = `group_${counter}`; }
      return [...prev, { _id: uid(), name: newName, ratio: 1, selectable: true, description: '' }];
    });
  }, [emitAndSet]);

  const removeRow = useCallback(
    (id) => {
      showConfirm({
        title: t('确认删除该分组？'),
        danger: true,
        okText: t('确认'),
        onOk: () => emitAndSet((prev) => prev.filter((r) => r._id !== id)),
      });
    },
    [emitAndSet, t],
  );

  const groupNames = useMemo(() => rows.map((r) => r.name), [rows]);
  const duplicateNames = useMemo(() => {
    const counts = {};
    groupNames.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    return new Set(Object.keys(counts).filter((k) => counts[k] > 1));
  }, [groupNames]);

  return (
    <div className='space-y-2'>
      <div className='rounded-md border border-ui-border overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead>
              <tr className='bg-ui-bg-subtle'>
                <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[180px]'>{t('分组名称')}</th>
                <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[120px]'>{t('倍率')}</th>
                <th className='px-3 py-2 text-center font-semibold text-ui-text-2 w-[90px]'>{t('用户可选')}</th>
                <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('描述')}</th>
                <th className='px-3 py-2 w-[50px]'></th>
              </tr>
            </thead>
            <tbody className='divide-y divide-ui-divider'>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className='px-3 py-6 text-center text-ui-text-3'>{t('暂无分组，点击下方按钮添加')}</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className='hover:bg-ui-bg-hover/50'>
                    <td className='px-3 py-2'>
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(row._id, 'name', e.target.value)}
                        className={`${inputCls} ${duplicateNames.has(row.name) ? '!border-amber-400 focus:!ring-amber-400/40' : ''}`}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <input
                        type='number'
                        value={row.ratio}
                        min={0}
                        step={0.1}
                        onChange={(e) => updateRow(row._id, 'ratio', parseFloat(e.target.value) || 0)}
                        className={numInputCls}
                      />
                    </td>
                    <td className='px-3 py-2 text-center'>
                      <input
                        type='checkbox'
                        checked={row.selectable}
                        onChange={(e) => updateRow(row._id, 'selectable', e.target.checked)}
                        className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40'
                      />
                    </td>
                    <td className='px-3 py-2'>
                      {row.selectable ? (
                        <input
                          value={row.description}
                          placeholder={t('分组描述')}
                          onChange={(e) => updateRow(row._id, 'description', e.target.value)}
                          className={inputCls}
                        />
                      ) : (
                        <span className='text-ui-text-3'>-</span>
                      )}
                    </td>
                    <td className='px-3 py-2'>
                      <button
                        onClick={() => removeRow(row._id)}
                        className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'
                        title={t('删除')}
                      >
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className='flex justify-center'>
        <Button size='sm' variant='secondary' onClick={addRow}>
          {t('添加分组')}
        </Button>
      </div>
      {duplicateNames.size > 0 && (
        <div className='text-xs text-amber-600 dark:text-amber-400'>
          {t('存在重复的分组名称：')}{Array.from(duplicateNames).join(', ')}
        </div>
      )}
    </div>
  );
}
