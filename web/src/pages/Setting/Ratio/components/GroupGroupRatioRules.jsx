/*
 * GroupGroupRatioRules — nested per-user-group ratio rules editor.
 * Token-system rewrite using native inputs.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../../components/common/ConfirmDialog';
import { Button } from '../../../../components/ui';

let _idCounter = 0;
const uid = () => `ggr_${++_idCounter}`;

function parseJSON(str) {
  if (!str || !str.trim()) return {};
  try { return JSON.parse(str); } catch { return {}; }
}

function flattenRules(nested) {
  const rules = [];
  for (const [userGroup, inner] of Object.entries(nested)) {
    if (typeof inner !== 'object' || inner === null) continue;
    for (const [usingGroup, ratio] of Object.entries(inner)) {
      rules.push({ _id: uid(), userGroup, usingGroup, ratio: typeof ratio === 'number' ? ratio : 1 });
    }
  }
  return rules;
}

function nestRules(rules) {
  const result = {};
  rules.forEach(({ userGroup, usingGroup, ratio }) => {
    if (!userGroup || !usingGroup) return;
    if (!result[userGroup]) result[userGroup] = {};
    result[userGroup][usingGroup] = ratio;
  });
  return result;
}

export function serializeGroupGroupRatio(rules) {
  const nested = nestRules(rules);
  return Object.keys(nested).length === 0 ? '' : JSON.stringify(nested, null, 2);
}

const inputCls = 'flex-1 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';
const numCls = 'w-24 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

function GroupSection({ groupName, items, groupOptions, onUpdate, onRemove, onAdd, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='rounded-md border border-ui-border overflow-hidden'>
      <div
        className='flex items-center justify-between px-3 py-2 bg-ui-bg-subtle cursor-pointer'
        onClick={() => setOpen(!open)}
      >
        <div className='flex items-center gap-2'>
          <span className='text-xs font-semibold text-ui-text'>{groupName}</span>
          <span className='inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>
            {items.length} {t('条规则')}
          </span>
        </div>
        <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onAdd(groupName)} className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-hover transition-colors'>
            </button>
          <button
            onClick={() => showConfirm({
              title: t('确认删除该分组的所有规则？'), danger: true, okText: t('确认'),
              onOk: () => items.forEach((item) => onRemove(item._id)),
            })}
            className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'
          >
            </button>
        </div>
      </div>
      {open && (
        <div className='px-3 py-2 space-y-2 border-t border-ui-divider'>
          {items.map((rule) => (
            <div key={rule._id} className='flex items-center gap-2'>
              <select
                value={rule.usingGroup || ''}
                onChange={(e) => onUpdate(rule._id, 'usingGroup', e.target.value)}
                className={inputCls}
              >
                <option value=''>{t('选择使用分组')}</option>
                {groupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                type='number' min={0} step={0.1} value={rule.ratio}
                onChange={(e) => onUpdate(rule._id, 'ratio', parseFloat(e.target.value) || 0)}
                className={numCls}
              />
              <button onClick={() => onRemove(rule._id)}
                className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'>
                </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GroupGroupRatioRules({ value, groupNames = [], onChange }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState(() => flattenRules(parseJSON(value)));
  const [newGroupName, setNewGroupName] = useState('');

  const emitChange = useCallback((newRules) => {
    setRules(newRules);
    onChange?.(serializeGroupGroupRatio(newRules));
  }, [onChange]);

  const updateRule = useCallback((id, field, val) => {
    emitChange(rules.map((r) => (r._id === id ? { ...r, [field]: val } : r)));
  }, [rules, emitChange]);

  const removeRule = useCallback((id) => {
    emitChange(rules.filter((r) => r._id !== id));
  }, [rules, emitChange]);

  const addRuleToGroup = useCallback((groupName) => {
    emitChange([...rules, { _id: uid(), userGroup: groupName, usingGroup: '', ratio: 1 }]);
  }, [rules, emitChange]);

  const addNewGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    emitChange([...rules, { _id: uid(), userGroup: name, usingGroup: '', ratio: 1 }]);
    setNewGroupName('');
  }, [rules, emitChange, newGroupName]);

  const groupOptions = useMemo(() => groupNames.map((n) => ({ value: n, label: n })), [groupNames]);

  const grouped = useMemo(() => {
    const map = {};
    const order = [];
    rules.forEach((r) => {
      if (!r.userGroup) return;
      if (!map[r.userGroup]) { map[r.userGroup] = []; order.push(r.userGroup); }
      map[r.userGroup].push(r);
    });
    return order.map((name) => ({ name, items: map[name] }));
  }, [rules]);

  if (grouped.length === 0 && rules.length === 0) {
    return (
      <div>
        <div className='text-center text-xs text-ui-text-3 py-4'>{t('暂无规则，点击下方按钮添加')}</div>
        <div className='flex justify-center gap-2'>
          <select value={newGroupName || ''} onChange={(e) => setNewGroupName(e.target.value)}
            className='w-48 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'>
            <option value=''>{t('选择用户分组')}</option>
            {groupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button size='sm' variant='secondary' onClick={addNewGroup}>
            {t('添加分组规则')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {grouped.map((group) => (
        <GroupSection key={group.name} groupName={group.name} items={group.items}
          groupOptions={groupOptions} onUpdate={updateRule} onRemove={removeRule} onAdd={addRuleToGroup} t={t} />
      ))}
      <div className='flex justify-center gap-2'>
        <select value={newGroupName || ''} onChange={(e) => setNewGroupName(e.target.value)}
          className='w-48 rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'>
          <option value=''>{t('选择用户分组')}</option>
          {groupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button size='sm' variant='secondary' onClick={addNewGroup}>
          {t('添加分组规则')}
        </Button>
      </div>
    </div>
  );
}
