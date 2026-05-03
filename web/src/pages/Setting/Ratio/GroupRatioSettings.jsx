/*
 * 分组倍率设置 — token-system rewrite.
 * Visual + manual mode toggle with 4 visual sub-editors and a guide side sheet.
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  HelpCircle,
  Layers,
  Shuffle,
  Sparkles,
  ShieldCheck,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  X,
} from 'lucide-react';
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
  ToggleField,
  TextAreaField,
  Notice,
  RadioChipGroup,
} from '../../../components/common/form/Primitives';
import { createPortal } from 'react-dom';
import GroupTable from './components/GroupTable';
import AutoGroupList from './components/AutoGroupList';
import GroupGroupRatioRules from './components/GroupGroupRatioRules';
import GroupSpecialUsableRules from './components/GroupSpecialUsableRules';

const OPTION_KEYS = [
  'GroupRatio',
  'UserUsableGroups',
  'GroupGroupRatio',
  'group_ratio_setting.group_special_usable_group',
  'AutoGroups',
  'DefaultUseAutoGroup',
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
        {Icon && (
          <div className={`w-7 h-7 rounded-md inline-flex items-center justify-center border ${iconCls}`}>
            <Icon size={13} />
          </div>
        )}
        <div className='flex-1 min-w-0 text-sm font-semibold text-ui-text'>{title}</div>
        {open
          ? <ChevronDown size={14} className='text-ui-text-3 group-hover:text-ui-text transition-colors' />
          : <ChevronRight size={14} className='text-ui-text-3 group-hover:text-ui-text transition-colors' />}
      </button>
      {open && <div className='pl-9 space-y-3'>{children}</div>}
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
    { key: 'groups', label: t('分组管理') },
    { key: 'auto', label: t('自动分组') },
    { key: 'ratios', label: t('特殊倍率') },
    { key: 'usable', label: t('可用分组') },
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
            <BookOpen size={16} className='text-ui-accent' />
            <span className='text-sm font-semibold text-ui-text'>{t('分组设置使用说明')}</span>
          </div>
          <button onClick={onClose} className='w-7 h-7 inline-flex items-center justify-center rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'>
            <X size={14} />
          </button>
        </div>
        <div className='flex gap-0 px-5 border-b border-ui-divider overflow-x-auto'>
          {tabs.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === tb.key ? 'border-ui-accent text-ui-accent' : 'border-transparent text-ui-text-3 hover:text-ui-text-2'}`}>
              {tb.label}
            </button>
          ))}
        </div>
        <div className='flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs text-ui-text-2 leading-relaxed'>
          {tab === 'overview' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('什么是分组？')}</h3>
              <p>{t('分组是用于控制计费倍率和模型访问权限的核心概念。每个用户属于一个分组，每个令牌也可以指定使用某个分组。')}</p>
              <p>{t('通过分组可以实现不同用户等级的差异化定价，例如 VIP 用户享受更低的 API 调用费用。')}</p>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-2'>
                <div><strong>{t('用户分组')}</strong> — {t('由管理员分配，决定用户身份等级（如 default、vip）。')}</div>
                <div><strong>{t('令牌分组')}</strong> — {t('用户创建令牌时选择的分组，决定该令牌的实际计费倍率。')}</div>
                <div><strong>{t('倍率')}</strong> — {t('计费乘数，倍率越低费用越低。例如倍率 0.5 表示半价。')}</div>
                <div><strong>{t('用户可选')}</strong> — {t('勾选后，该分组会出现在用户创建令牌时的下拉菜单中。')}</div>
                <div><strong>{t('自动分组')}</strong> — {t('令牌分组设为 auto 时，系统按优先级顺序自动选择一个可用分组。')}</div>
              </div>
            </>
          )}
          {tab === 'groups' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('创建和管理分组')}</h3>
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
          {tab === 'auto' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('自动分组选择')}</h3>
              <p>{t('当令牌分组设为 auto 时，系统按列表顺序依次选择可用分组。排在前面的优先级更高。')}</p>
              <CodeBlock>{`1. default    ${t('最高优先级')}\n2. vip`}</CodeBlock>
              <p>{t('开启「默认使用 auto 分组」后，新建令牌和初始令牌都会自动设为 auto。')}</p>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3'>
                <strong>AutoGroups</strong> — {t('有序字符串数组')}
                <CodeBlock>{`["default", "vip"]`}</CodeBlock>
              </div>
            </>
          )}
          {tab === 'ratios' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('跨分组特殊倍率')}</h3>
              <p>{t('正常情况下，令牌的计费倍率由令牌所选的分组决定。特殊倍率可以根据「用户所在分组」进一步覆盖这个倍率。')}</p>
              <p>{t('简单来说：同一个令牌分组，不同等级的用户可以享受不同的价格。')}</p>
              <CodeBlock>
                {`${t('用户分组')}    ${t('使用分组')}    ${t('倍率')}\n────────────────────────────\nvip       standard   0.8\nvip       premium    0.3`}
              </CodeBlock>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3'>
                <strong>GroupGroupRatio</strong> — {t('嵌套映射：用户分组 → 使用分组 → 倍率')}
                <CodeBlock>{`{\n  "vip": {\n    "standard": 0.8,\n    "premium": 0.3\n  }\n}`}</CodeBlock>
              </div>
            </>
          )}
          {tab === 'usable' && (
            <>
              <h3 className='text-sm font-semibold text-ui-text'>{t('特殊可用分组规则')}</h3>
              <p>{t('默认情况下，所有用户创建令牌时看到的可选分组列表是一样的。通过此功能，可以根据用户所在分组展示不同的可选列表。')}</p>
              <CodeBlock>
                {`${t('用户分组')}    ${t('操作')}        ${t('目标分组')}    ${t('说明')}\n──────────────────────────────────────────\nvip       ${t('添加')} (+:)   exclusive   ${t('专属分组')}\nvip       ${t('移除')} (-:)   standard    -`}
              </CodeBlock>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-1'>
                <div><strong>{t('添加')} (+:)</strong> — {t('在默认列表基础上新增一个分组')}</div>
                <div><strong>{t('移除')} (-:)</strong> — {t('从默认列表中去掉一个分组')}</div>
                <div><strong>{t('追加')}</strong> — {t('直接追加（和添加类似，但无前缀）')}</div>
              </div>
              <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3'>
                <strong>group_special_usable_group</strong>
                <CodeBlock>{`{\n  "vip": {\n    "+:exclusive": "${t('专属分组')}",\n    "-:standard": "remove"\n  }\n}`}</CodeBlock>
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
    GroupGroupRatio: '',
    'group_ratio_setting.group_special_usable_group': '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
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
      for (const k of ['GroupRatio', 'UserUsableGroups', 'GroupGroupRatio', 'group_ratio_setting.group_special_usable_group']) {
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

  const handleAutoGroupsChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, AutoGroups: value }));
  }, []);

  const handleGroupGroupRatioChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, GroupGroupRatio: value }));
  }, []);

  const handleSpecialUsableChange = useCallback((value) => {
    setInputs((prev) => ({ ...prev, 'group_ratio_setting.group_special_usable_group': value }));
  }, []);

  const dv = dataVersionRef.current;

  const jsonFields = [
    { key: 'GroupRatio', label: t('分组倍率'), hint: t('键为分组名称，值为倍率；如 {"vip": 0.5}') },
    { key: 'UserUsableGroups', label: t('用户可选分组'), hint: t('键为分组名称，值为分组描述') },
    { key: 'GroupGroupRatio', label: t('分组特殊倍率'), hint: t('嵌套映射：用户分组 → 使用分组 → 倍率') },
    { key: 'group_ratio_setting.group_special_usable_group', label: t('分组特殊可用分组'), hint: t('键为用户分组，值为操作映射（+: 添加，-: 移除，无前缀追加）') },
    { key: 'AutoGroups', label: t('自动分组'), hint: t('有序字符串数组，如 ["default","vip"]') },
  ];

  return (
    <div className='space-y-4'>
      {/* Header with mode toggle */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <div className='w-8 h-8 rounded-md inline-flex items-center justify-center border bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'>
            <Users size={15} />
          </div>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text'>{t('分组倍率设置')}</div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('管理用户分组、倍率、自动分组及跨分组规则')}</div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => setShowGuide(true)}
            className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
          >
            <HelpCircle size={12} /> {t('使用说明')}
          </button>
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
          <Collapsible title={t('分组管理')} icon={Layers} iconColor='blue' defaultOpen>
            <p className='text-xs text-ui-text-3'>{t('倍率用于计费乘数，勾选「用户可选」后用户可在创建令牌时选择该分组')}</p>
            <GroupTable key={`gt_${dv}`} groupRatio={inputs.GroupRatio} userUsableGroups={inputs.UserUsableGroups} onChange={handleGroupTableChange} />
          </Collapsible>

          <Collapsible title={t('自动分组')} icon={Shuffle} iconColor='emerald'>
            <p className='text-xs text-ui-text-3'>{t('令牌分组设为 auto 时，按以下顺序依次尝试选择可用分组，排在前面的优先级更高')}</p>
            <ToggleField
              label={t('默认使用 auto 分组')}
              hint={t('开启后创建令牌默认选择 auto 分组，初始令牌也将设为 auto')}
              checked={!!inputs.DefaultUseAutoGroup}
              onChange={(v) => setInputs((prev) => ({ ...prev, DefaultUseAutoGroup: v }))}
            />
            <AutoGroupList key={`ag_${dv}`} value={inputs.AutoGroups} groupNames={groupNames} onChange={handleAutoGroupsChange} />
          </Collapsible>

          <Collapsible title={t('分组特殊倍率')} icon={Sparkles} iconColor='purple'>
            <p className='text-xs text-ui-text-3'>{t('当某个分组的用户使用另一个分组的令牌时，可设置特殊倍率覆盖基础倍率')}</p>
            <GroupGroupRatioRules key={`ggr_${dv}`} value={inputs.GroupGroupRatio} groupNames={groupNames} onChange={handleGroupGroupRatioChange} />
          </Collapsible>

          <Collapsible title={t('分组特殊可用分组')} icon={ShieldCheck} iconColor='amber'>
            <p className='text-xs text-ui-text-3'>{t('为特定用户分组配置可用分组的增减规则。「添加」为该分组新增可用分组，「移除」移除默认可用分组，「追加」直接追加分组')}</p>
            <GroupSpecialUsableRules key={`gsu_${dv}`} value={inputs['group_ratio_setting.group_special_usable_group']} groupNames={groupNames} onChange={handleSpecialUsableChange} />
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
          <ToggleField
            label={t('创建令牌默认选择 auto 分组')}
            hint={t('开启后初始令牌也将设为 auto')}
            checked={!!inputs.DefaultUseAutoGroup}
            onChange={(v) => setInputs((prev) => ({ ...prev, DefaultUseAutoGroup: v }))}
          />
        </div>
      )}

      {/* Save bar */}
      <div className='flex items-center justify-end gap-2 pt-2 border-t border-ui-divider'>
        <button
          onClick={submit}
          disabled={loading}
          className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
        >
          {loading ? <Loader2 size={11} className='animate-spin' /> : <Save size={11} />}
          {t('保存分组相关设置')}
        </button>
      </div>

      <GuideSideSheet open={showGuide} onClose={() => setShowGuide(false)} t={t} />
    </div>
  );
}
