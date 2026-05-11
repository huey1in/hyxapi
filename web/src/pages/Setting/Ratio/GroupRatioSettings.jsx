/*
 * 分组倍率设置 — token-system rewrite.
 * Visual + manual mode toggle with 4 visual sub-editors and a guide side sheet.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import {
  FieldRow,
  TextAreaField,
  Notice,
  RadioChipGroup,
} from '../../../components/common/form/Primitives';
import { createPortal } from 'react-dom';
import GroupTable from './components/GroupTable';
import { Button, IconButton, Tabs as UITabs } from '../../../components/ui';
import { X as XIcon } from 'lucide-react';

const OPTION_KEYS = [
  'GroupRatio',
  'UserUsableGroups',
];

function parseJSONSafe(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function Collapsible({ title, icon: Icon, children, defaultOpen = false, iconColor = 'blue' }) {
  const [open, setOpen] = useState(defaultOpen);
  const ICON_COLOR_MAP = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  };
  const iconCls = ICON_COLOR_MAP[iconColor] || ICON_COLOR_MAP.blue;
  return (
    <div className='space-y-3'>
      <button
        type='button'
        className='flex items-center gap-2 w-full text-left group'
        onClick={() => setOpen(!open)}
      >
        <div className='flex-1 min-w-0 text-sm font-semibold text-ui-text'>{title}</div>
      </button>
      {open && <div className='space-y-3'>{children}</div>}
    </div>
  );
}

function GuideSideSheet({ open, onClose, t }) {
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = original; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const tabs = [
    { key: 'overview', label: t('概览') },
    { key: 'groups', label: t('套餐管理') },
  ];

  const CodeBlock = ({ children }) => (
    <pre className='bg-ui-bg-subtle border border-ui-border rounded-md p-3 font-mono text-xs text-ui-text leading-relaxed overflow-x-auto whitespace-pre-wrap'>
      {children}
    </pre>
  );

  return createPortal(
    <div className='fixed inset-0 z-[200] flex justify-end' style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className='w-full max-w-[560px] bg-ui-bg-elevated border-l border-ui-border shadow-2xl h-full flex flex-col' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center justify-between px-5 py-4 border-b border-ui-divider'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-semibold text-ui-text'>{t('分组设置使用说明')}</span>
          </div>
          <IconButton icon={XIcon} size='sm' onClick={onClose} />
        </div>
        <div className='px-5 border-b border-ui-divider'>
          <UITabs
            variant='underline'
            value={tab}
            onChange={setTab}
            items={tabs.map((tb) => ({ value: tb.key, label: tb.label }))}
          />
        </div>
        <div className='flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-ui-text-2 leading-relaxed'>
          {tab === 'overview' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('什么是定价套餐？')}</h3>
              <p>{t('套餐是用于控制 API 计费倍率的核心概念。每个令牌可以选择一个定价套餐，决定该令牌的计费倍率。')}</p>
              <p>{t('通过配置不同的套餐倍率，为不同场景提供差异化定价，例如标准套餐和高级套餐。')}</p>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div><strong>{t('套餐倍率')}</strong> — {t('计费乘数，倍率越低费用越低。例如倍率 0.5 表示半价。')}</div>
                <div><strong>{t('用户可选')}</strong> — {t('勾选后，该套餐会出现在用户创建令牌时的下拉菜单中。')}</div>
                <div><strong>{t('自动分组')}</strong> — {t('令牌分组设为 auto 时，系统按优先级顺序自动选择一个可用套餐。')}</div>
              </div>
            </>
          )}
          {tab === 'groups' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('创建和管理定价套餐')}</h3>
              <p>{t('每个分组代表一个价格档位。管理员创建分组后，可以选择哪些档位对用户开放自选。')}</p>
              <CodeBlock>
                {`${t('分组名')}      ${t('倍率')}    ${t('用户可选')}    ${t('说明')}\n──────────────────────────────────────\nstandard  1.0     ${t('是')}        ${t('标准价格')}\npremium   0.5     ${t('是')}        ${t('高级套餐，半价优惠')}`}
              </CodeBlock>
              <p className='text-ui-text-3'>{t('不勾选「用户可选」的分组只能由管理员在「用户管理」中分配。')}</p>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div><strong>GroupRatio</strong> — {t('分组名称到倍率的映射')}</div>
                <CodeBlock>{`{"default": 1, "vip": 0.5, "standard": 1, "premium": 0.5}`}</CodeBlock>
                <div className='mt-2'><strong>UserUsableGroups</strong> — {t('用户可选分组的名称和描述')}</div>
                <CodeBlock>{`{"standard": "${t('标准价格')}", "premium": "${t('高级套餐，半价优惠')}"}`}</CodeBlock>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GroupRatioSettings(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState('visual');
  const [showGuide, setShowGuide] = useState(false);

  const [inputs, setInputs] = useState({
    GroupRatio: '',
    UserUsableGroups: '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);
  const dataVersionRef = useRef(0);

  const groupNames = useMemo(() => {
    const ratioMap = parseJSONSafe(inputs.GroupRatio, {});
    return Object.keys(ratioMap);
  }, [inputs.GroupRatio]);

  useEffect(() => {
    const next = {};
    for (const key of OPTION_KEYS) {
      if (key in (props.options || {})) next[key] = props.options[key];
    }
    setInputs((prev) => ({ ...prev, ...next }));
    setInputsRow(structuredClone({ ...inputs, ...next }));
    dataVersionRef.current += 1;
  }, [props.options]);

  const submit = async () => {
    if (editMode === 'manual') {
      for (const k of ['GroupRatio', 'UserUsableGroups']) {
        const v = inputs[k];
        if (v && !verifyJSON(v)) return showError(t('请检查输入'));
      }
    }
    const diff = compareObjects(inputs, inputsRow);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    try {
      const res = await Promise.all(
        diff.map((item) =>
          API.put('/api/option/', {
            key: item.key,
            value: typeof inputs[item.key] === 'boolean' ? String(inputs[item.key]) : inputs[item.key],
          }),
        ),
      );
      if (res.includes(undefined)) return showError(t('部分保存失败，请重试'));
      for (let i = 0; i < res.length; i++) {
        if (res[i] && !res[i].data?.success) return showError(res[i].data.message);
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch { showError(t('保存失败，请重试')); }
    finally { setLoading(false); }
  };

  const handleGroupTableChange = useCallback(({ GroupRatio, UserUsableGroups }) => {
    setInputs((prev) => ({ ...prev, GroupRatio, UserUsableGroups }));
  }, []);

  const dv = dataVersionRef.current;

  const jsonFields = [
    { key: 'GroupRatio', label: t('定价套餐倍率'), hint: t('键为套餐名称，值为倍率；如 {"standard": 1, "premium": 0.5}') },
    { key: 'UserUsableGroups', label: t('用户可选套餐'), hint: t('键为套餐名称，值为套餐描述，出现在令牌创建下拉框中') },
  ];

  return (
    <div className='space-y-4'>
      {/* Header with mode toggle */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text'>{t('定价套餐设置')}</div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('管理令牌可选的定价套餐与自动分组')}</div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button size='sm' variant='secondary' onClick={() => setShowGuide(true)}>
            {t('使用说明')}
          </Button>
        </div>
      </div>

      {/* Mode selector */}
      <RadioChipGroup
        value={editMode}
        onChange={setEditMode}
        options={[
          { value: 'visual', label: t('可视化编辑') },
          { value: 'manual', label: t('手动编辑') },
        ]}
      />

      {editMode === 'visual' ? (
        <div className='space-y-4'>
          <Collapsible title={t('定价套餐管理')}defaultOpen>
            <p className='text-xs text-ui-text-3'>{t('每个套餐对应一个计费倍率，勾选「用户可选」后用户可在创建令牌时选择该套餐')}</p>
            <GroupTable key={`gt_${dv}`} groupRatio={inputs.GroupRatio} userUsableGroups={inputs.UserUsableGroups} onChange={handleGroupTableChange} />
          </Collapsible>
        </div>
      ) : (
        <div className='space-y-3'>
          {jsonFields.map((f) => {
            const err = inputs[f.key] && !verifyJSON(inputs[f.key]) ? t('不是合法的 JSON 字符串') : '';
            return (
              <FieldRow key={f.key} label={f.label} hint={f.hint} error={err}>
                <TextAreaField
                  value={inputs[f.key] || ''}
                  onChange={(v) => setInputs((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder='{}'
                  rows={6}
                  className='font-mono text-xs'
                />
              </FieldRow>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      <div className='flex items-center justify-end gap-2 pt-2 border-t border-ui-divider'>
        <Button onClick={submit} disabled={loading}>
          {t('保存分组相关设置')}
        </Button>
      </div>

      <GuideSideSheet open={showGuide} onClose={() => setShowGuide(false)} t={t} />
    </div>
  );
}
