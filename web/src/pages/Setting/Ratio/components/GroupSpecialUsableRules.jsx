/*
 * GroupSpecialUsableRules — per-user-group usable group overrides.
 * Token-system rewrite using native inputs.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { showConfirm } from '../../../../components/common/ConfirmDialog';
import { Button, IconButton, inputClass } from '../../../../components/ui';
import { Trash2, Plus } from 'lucide-react';

let _idCounter = 0;
const uid = () => `gsu_${++_idCounter}`;

const OP_ADD = 'add';
const OP_REMOVE = 'remove';
const OP_APPEND = 'append';

function parsePrefix(rawKey) {
  if (rawKey.startsWith('+:')) return { op: OP_ADD, groupName: rawKey.slice(2) };
  if (rawKey.startsWith('-:')) return { op: OP_REMOVE, groupName: rawKey.slice(2) };
  return { op: OP_APPEND, groupName: rawKey };
}

function toRawKey(op, groupName) {
  if (op === OP_ADD) return `+:${groupName}`;
  if (op === OP_REMOVE) return `-:${groupName}`;
  return groupName;
}

function parseJSON(str) {
  if (!str || !str.trim()) return {};
  try { return JSON.parse(str); } catch { return {}; }
}

function flattenRules(nested) {
  const rules = [];
  for (const [userGroup, inner] of Object.entries(nested)) {
    if (typeof inner !== 'object' || inner === null) continue;
    for (const [rawKey, desc] of Object.entries(inner)) {
      const { op, groupName } = parsePrefix(rawKey);
      rules.push({
        _id: uid(), userGroup, op, targetGroup: groupName,
        description: op === OP_REMOVE ? 'remove' : (typeof desc === 'string' ? desc : ''),
      });
    }
  }
  return rules;
}

function nestRules(rules) {
  const result = {};
  rules.forEach(({ userGroup, op, targetGroup, description }) => {
    if (!userGroup || !targetGroup) return;
    if (!result[userGroup]) result[userGroup] = {};
    result[userGroup][toRawKey(op, targetGroup)] = description;
  });
  return result;
}

export function serializeGroupSpecialUsable(rules) {
  const nested = nestRules(rules);
  return Object.keys(nested).length === 0 ? '' : JSON.stringify(nested, null, 2);
}

const OP_COLORS = {
  [OP_ADD]: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  [OP_REMOVE]: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  [OP_APPEND]: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
};

const OP_LABELS = {
  [OP_ADD]: '添加 (+:)',
  [OP_REMOVE]: '移除 (-:)',
  [OP_APPEND]: '追加',
};

const selectCls = inputClass({ variant: 'inline', size: 'sm' });
const inputCls = inputClass({ variant: 'inline', size: 'sm', className: 'flex-1' });

function UsableGroupSection({ groupName, items, onUpdate, onRemove, onAdd, t }) {
  const [open, setOpen] = useState(false);

  return (
    <div className='rounded-md border border-ui-border overflow-hidden'>
      <div className='flex items-center justify-between px-3 py-2 bg-ui-bg-subtle cursor-pointer' onClick={() => setOpen(!open)}>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-semibold text-ui-text'>{groupName}</span>
          <span className='inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>
            {items.length} {t('条规则')}
          </span>
        </div>
        <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
          <IconButton icon={Plus} size='sm' title={t('新增')} onClick={() => onAdd(groupName)} />
          <IconButton
            icon={Trash2}
            size='sm'
            variant='danger'
            title={t('删除')}
            onClick={() => showConfirm({
              title: t('确认删除该分组的所有规则？'), danger: true, okText: t('确认'),
              onOk: () => items.forEach((item) => onRemove(item._id)),
            })}
          />
        </div>
      </div>
      {open && (
        <div className='px-3 py-2 space-y-2 border-t border-ui-divider'>
          {items.map((rule) => (
            <div key={rule._id} className='flex items-center gap-2'>
              <select value={rule.op} onChange={(e) => onUpdate(rule._id, 'op', e.target.value)} className={`${selectCls} w-28`}>
                <option value={OP_ADD}>{t('添加 (+:)')}</option>
                <option value={OP_REMOVE}>{t('移除 (-:)')}</option>
                <option value={OP_APPEND}>{t('追加')}</option>
              </select>
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${OP_COLORS[rule.op] || OP_COLORS[OP_APPEND]}`}>
                {OP_LABELS[rule.op]}
              </span>
              <input value={rule.targetGroup} placeholder={t('分组名称')} onChange={(e) => onUpdate(rule._id, 'targetGroup', e.target.value)} className={inputCls} />
              {rule.op !== OP_REMOVE ? (
                <input value={rule.description} placeholder={t('分组描述')} onChange={(e) => onUpdate(rule._id, 'description', e.target.value)} className={inputCls} />
              ) : (
                <div className='flex-1 text-xs text-ui-text-3'>-</div>
              )}
              <IconButton
                icon={Trash2}
                size='sm'
                variant='danger'
                onClick={() => onRemove(rule._id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GroupSpecialUsableRules({ value, groupNames = [], onChange }) {
  const { t } = useTranslation();
  const [rules, setRules] = useState(() => flattenRules(parseJSON(value)));
  const [newGroupName, setNewGroupName] = useState('');

  const emitChange = useCallback((newRules) => {
    setRules(newRules);
    onChange?.(serializeGroupSpecialUsable(newRules));
  }, [onChange]);

  const updateRule = useCallback((id, field, val) => {
    emitChange(rules.map((r) => {
      if (r._id !== id) return r;
      const updated = { ...r, [field]: val };
      if (field === 'op' && val === OP_REMOVE) updated.description = 'remove';
      else if (field === 'op' && r.op === OP_REMOVE && val !== OP_REMOVE && updated.description === 'remove') updated.description = '';
      return updated;
    }));
  }, [rules, emitChange]);

  const removeRule = useCallback((id) => emitChange(rules.filter((r) => r._id !== id)), [rules, emitChange]);

  const addRuleToGroup = useCallback((groupName) => {
    emitChange([...rules, { _id: uid(), userGroup: groupName, op: OP_APPEND, targetGroup: '', description: '' }]);
  }, [rules, emitChange]);

  const addNewGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    emitChange([...rules, { _id: uid(), userGroup: name, op: OP_APPEND, targetGroup: '', description: '' }]);
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
        <UsableGroupSection key={group.name} groupName={group.name} items={group.items}
          onUpdate={updateRule} onRemove={removeRule} onAdd={addRuleToGroup} t={t} />
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
