/*
 * 渠道亲和性设置 — token-system rewrite.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import {
  CHANNEL_AFFINITY_RULE_TEMPLATES,
  cloneChannelAffinityTemplate,
} from '../../../constants/channel-affinity-template.constants';
import ParamOverrideEditorModal from '../../../components/table/channels/modals/ParamOverrideEditorModal';
import ModalDialog from '../../../components/common/ModalDialog';
import {
  SectionWithSave,
  FieldRow,
  ToggleField,
  NumberField,
  TextAreaField,
  Notice,
  RadioChipGroup,
  Chip,
} from '../../../components/common/form/Primitives';
import { showConfirm } from '../../../components/common/ConfirmDialog';

const KEY_ENABLED = 'channel_affinity_setting.enabled';
const KEY_SWITCH_ON_SUCCESS = 'channel_affinity_setting.switch_on_success';
const KEY_MAX_ENTRIES = 'channel_affinity_setting.max_entries';
const KEY_DEFAULT_TTL = 'channel_affinity_setting.default_ttl_seconds';
const KEY_RULES = 'channel_affinity_setting.rules';

const KEY_SOURCE_TYPES = [
  { label: 'context_int', value: 'context_int' },
  { label: 'context_string', value: 'context_string' },
  { label: 'gjson', value: 'gjson' },
];

const CONTEXT_KEY_PRESETS = [
  { key: 'id', label: 'id（用户 ID）' },
  { key: 'token_id', label: 'token_id' },
  { key: 'token_key', label: 'token_key' },
  { key: 'token_group', label: 'token_group' },
  { key: 'group', label: 'group（using_group）' },
  { key: 'username', label: 'username' },
  { key: 'user_group', label: 'user_group' },
  { key: 'user_email', label: 'user_email' },
  { key: 'specific_channel_id', label: 'specific_channel_id' },
];

const RULES_JSON_PLACEHOLDER = `[
  {
    "name": "prefer-by-conversation-id",
    "model_regex": ["^gpt-.*$"],
    "path_regex": ["/v1/chat/completions"],
    "key_sources": [
      { "type": "gjson", "path": "metadata.conversation_id" },
      { "type": "context_string", "key": "conversation_id" }
    ],
    "ttl_seconds": 600,
    "skip_retry_on_failure": false,
    "include_using_group": true,
    "include_model_name": false,
    "include_rule_name": true
  }
]`;

const DEFAULTS = {
  [KEY_ENABLED]: false,
  [KEY_SWITCH_ON_SUCCESS]: true,
  [KEY_MAX_ENTRIES]: 100000,
  [KEY_DEFAULT_TTL]: 3600,
  [KEY_RULES]: '[]',
};

const selectCls = 'rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';
const inputCls = 'w-full rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';
const miniTag = 'inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium';

const normalizeStringList = (text) => (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
const stringifyPretty = (v) => JSON.stringify(v, null, 2);
const stringifyCompact = (v) => JSON.stringify(v);

const parseRulesJson = (jsonString) => {
  try {
    const parsed = JSON.parse(jsonString || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((rule, index) => ({ id: index, ...(rule || {}) }));
  } catch { return []; }
};

const rulesToJson = (rules) => stringifyPretty((rules || []).map(({ id, ...rest }) => rest));

const normalizeKeySource = (src) => {
  const type = (src?.type || '').trim();
  const key = (src?.key || '').trim();
  const path = (src?.path || '').trim();
  if (type === 'gjson') return { type, key: '', path };
  return { type, key, path: '' };
};

const makeUniqueName = (existingNames, baseName) => {
  const base = (baseName || '').trim() || 'rule';
  if (!existingNames.has(base)) return base;
  for (let i = 2; i < 1000; i++) { const n = `${base}-${i}`; if (!existingNames.has(n)) return n; }
  return `${base}-${Date.now()}`;
};

const tryParseRulesJsonArray = (jsonString) => {
  const raw = jsonString || '[]';
  if (!verifyJSON(raw)) return { ok: false, message: 'Rules JSON is invalid' };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, message: 'Rules JSON must be an array' };
    return { ok: true, value: parsed };
  } catch { return { ok: false, message: 'Rules JSON is invalid' }; }
};

const parseOptionalObjectJson = (jsonString, label) => {
  const raw = (jsonString || '').trim();
  if (!raw) return { ok: true, value: null };
  if (!verifyJSON(raw)) return { ok: false, message: `${label} JSON 格式不正确` };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, message: `${label} 必须是 JSON 对象` };
    return { ok: true, value: parsed };
  } catch { return { ok: false, message: `${label} JSON 格式不正确` }; }
};

function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className='border border-ui-border rounded-md overflow-hidden'>
      <button className='flex items-center gap-2 w-full px-3 py-2 bg-ui-bg-subtle text-left' onClick={() => setOpen(!open)}>
        <span className='text-xs font-semibold text-ui-text'>{title}</span>
      </button>
      {open && <div className='p-3 space-y-3'>{children}</div>}
    </div>
  );
}

export default function SettingsChannelAffinity(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState({ enabled: false, total: 0, unknown: 0, by_rule_name: {}, cache_capacity: 0, cache_algo: '' });
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [editMode, setEditMode] = useState('visual');
  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [modalFormKey, setModalFormKey] = useState(0);
  const [paramTemplateDraft, setParamTemplateDraft] = useState('');
  const [paramTemplateEditorVisible, setParamTemplateEditorVisible] = useState(false);

  const effectiveDefaultTTL = Number(inputs[KEY_DEFAULT_TTL] || 0) > 0 ? Number(inputs[KEY_DEFAULT_TTL] || 0) : 3600;

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));

  const refreshCacheStats = async () => {
    try {
      setCacheLoading(true);
      const res = await API.get('/api/option/channel_affinity_cache', { disableDuplicate: true });
      if (res.data.success) setCacheStats(res.data.data || {});
    } catch { showError(t('刷新缓存统计失败')); }
    finally { setCacheLoading(false); }
  };

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in (props.options || {})) {
        const v = props.options[k];
        if (k === KEY_ENABLED || k === KEY_SWITCH_ON_SUCCESS) next[k] = toBoolean(v);
        else if (k === KEY_MAX_ENTRIES || k === KEY_DEFAULT_TTL) next[k] = Number(v || 0) || 0;
        else if (k === KEY_RULES) { try { next[k] = stringifyPretty(JSON.parse(v || '[]')); } catch { next[k] = v || '[]'; } }
        else next[k] = v;
      }
    }
    setInputs(next);
    setOriginal(structuredClone(next));
    setRules(parseRulesJson(next[KEY_RULES]));
    refreshCacheStats();
  }, [props.options]);

  useEffect(() => {
    if (editMode === 'visual') setRules(parseRulesJson(inputs[KEY_RULES]));
  }, [inputs[KEY_RULES], editMode]);

  const updateRulesState = (nextRules) => {
    setRules(nextRules);
    const jsonString = rulesToJson(nextRules);
    setInputs((prev) => ({ ...prev, [KEY_RULES]: jsonString }));
  };

  const submit = () => {
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    if (!verifyJSON(inputs[KEY_RULES] || '[]')) return showError(t('规则 JSON 格式不正确'));
    let compactRules;
    try { compactRules = stringifyCompact(JSON.parse(inputs[KEY_RULES] || '[]')); } catch { return showError(t('规则 JSON 格式不正确')); }
    setLoading(true);
    Promise.all(diff.map((item) => {
      let value = '';
      if (item.key === KEY_RULES) value = compactRules;
      else if (typeof inputs[item.key] === 'boolean') value = String(inputs[item.key]);
      else value = String(inputs[item.key] ?? '');
      return API.put('/api/option/', { key: item.key, value });
    }))
      .then((res) => {
        if (res.includes(undefined)) return showError(t('部分保存失败，请重试'));
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  const openAddModal = () => {
    setEditingRule({ name: '', model_regex: [], path_regex: [], user_agent_include: [], key_sources: [{ type: 'gjson', path: '' }], value_regex: '', ttl_seconds: 0, skip_retry_on_failure: false, include_using_group: true, include_model_name: false, include_rule_name: true });
    setIsEdit(false);
    setParamTemplateDraft('');
    setParamTemplateEditorVisible(false);
    setModalFormKey((k) => k + 1);
    setModalVisible(true);
  };

  const openEditModal = (rule) => {
    setEditingRule({ ...rule, user_agent_include: Array.isArray(rule.user_agent_include) ? rule.user_agent_include : [], key_sources: (rule.key_sources || []).map(normalizeKeySource) });
    setIsEdit(true);
    setParamTemplateDraft(rule.param_override_template ? stringifyPretty(rule.param_override_template) : '');
    setParamTemplateEditorVisible(false);
    setModalFormKey((k) => k + 1);
    setModalVisible(true);
  };

  const handleDeleteRule = (id) => {
    const next = rules.filter((r) => r.id !== id);
    updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
    showSuccess(t('删除成功'));
  };

  const handleModalSave = () => {
    const r = editingRule || {};
    if (!r.name?.trim()) return showError(t('名称不能为空'));
    const modelRegex = Array.isArray(r.model_regex) ? r.model_regex : normalizeStringList(typeof r.model_regex === 'string' ? r.model_regex : '');
    if (modelRegex.length === 0) return showError(t('模型正则不能为空'));
    const keySources = (r.key_sources || []).map(normalizeKeySource).filter((x) => x.type);
    if (keySources.length === 0) return showError(t('Key 来源不能为空'));
    for (const x of keySources) {
      if ((x.type === 'context_int' || x.type === 'context_string') && !x.key) return showError(t('Key 不能为空'));
      if (x.type === 'gjson' && !x.path) return showError(t('Path 不能为空'));
    }
    const paramValidation = parseOptionalObjectJson(paramTemplateDraft, '参数覆盖模板');
    if (!paramValidation.ok) return showError(t(paramValidation.message));

    const rulePayload = {
      id: isEdit ? r.id : rules.length,
      name: r.name.trim(),
      model_regex: modelRegex,
      path_regex: Array.isArray(r.path_regex) ? r.path_regex : normalizeStringList(typeof r.path_regex === 'string' ? r.path_regex : ''),
      key_sources: keySources,
      value_regex: (r.value_regex || '').trim(),
      ttl_seconds: Number(r.ttl_seconds || 0),
      include_using_group: !!r.include_using_group,
      include_model_name: !!r.include_model_name,
      include_rule_name: !!r.include_rule_name,
      skip_retry_on_failure: !!r.skip_retry_on_failure,
      ...(Array.isArray(r.user_agent_include) && r.user_agent_include.length > 0 ? { user_agent_include: r.user_agent_include } : {}),
      ...(paramValidation.value ? { param_override_template: paramValidation.value } : {}),
    };

    const next = [...rules];
    if (isEdit) {
      const idx = next.findIndex((r) => r.id === rulePayload.id);
      if (idx < 0) return showError(t('规则未找到'));
      next[idx] = rulePayload;
    } else {
      next.push(rulePayload);
    }
    updateRulesState(next.map((r, idx) => ({ ...r, id: idx })));
    setModalVisible(false);
    showSuccess(t('保存成功'));
  };

  const appendTemplates = () => {
    const doAppend = () => {
      const existingNames = new Set(rules.map((r) => (r?.name || '').trim()).filter(Boolean));
      const templates = [CHANNEL_AFFINITY_RULE_TEMPLATES.codexCli, CHANNEL_AFFINITY_RULE_TEMPLATES.claudeCli].map((tpl) => {
        const base = cloneChannelAffinityTemplate(tpl);
        const name = makeUniqueName(existingNames, tpl.name);
        existingNames.add(name);
        return { ...base, name };
      });
      updateRulesState([...rules, ...templates].map((r, idx) => ({ ...r, id: idx })));
      showSuccess(t('已填充模版'));
    };
    if (!rules.length) { doAppend(); return; }
    showConfirm({ title: t('填充 Codex CLI / Claude CLI 模版'), content: t('将追加 2 条规则到现有规则列表。'), onOk: doAppend });
  };

  const clearAllCache = () => {
    showConfirm({
      title: t('确认清空全部渠道亲和性缓存'),
      content: t('将删除所有仍在内存中的渠道亲和性缓存条目。'),
      danger: true,
      okText: t('确认清空'),
      onOk: async () => {
        const res = await API.delete('/api/option/channel_affinity_cache', { params: { all: true } });
        if (!res.data.success) { showError(t(res.data.message)); return; }
        showSuccess(t('已清空'));
        await refreshCacheStats();
      },
    });
  };

  const clearRuleCache = (rule) => {
    const name = (rule?.name || '').trim();
    if (!name) return;
    if (!rule?.include_rule_name) return showWarning(t('该规则未启用"作用域：包含规则名称"，无法按规则清空缓存。'));
    showConfirm({
      title: t('确认清空该规则缓存'),
      content: `${t('规则')}：${name}`,
      onOk: async () => {
        const res = await API.delete('/api/option/channel_affinity_cache', { params: { rule_name: name } });
        if (!res.data.success) { showError(t(res.data.message)); return; }
        showSuccess(t('已清空'));
        await refreshCacheStats();
      },
    });
  };

  const updateEditing = (patch) => setEditingRule((prev) => ({ ...(prev || {}), ...patch }));

  return (
    <div className='space-y-4'>
      <SectionWithSave
        title={t('渠道亲和性')}
        hint={t('基于请求上下文或 JSON Body 提取的 Key，优先复用上一次成功的渠道（粘滞选路）')}loading={loading}
        onSave={submit}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
          <ToggleField
            label={t('启用渠道亲和性')}
            hint={t('启用后将优先复用上一次成功的渠道')}
            checked={!!inputs[KEY_ENABLED]}
            onChange={set(KEY_ENABLED)}
          />
          <ToggleField
            label={t('成功后切换亲和')}
            hint={t('亲和到的渠道失败后，重试到其他渠道成功后更新亲和')}
            checked={!!inputs[KEY_SWITCH_ON_SUCCESS]}
            onChange={set(KEY_SWITCH_ON_SUCCESS)}
          />
          <FieldRow label={t('最大条目数')} hint={t('内存缓存最大条目数，0 使用后端默认 100000')}>
            <NumberField value={inputs[KEY_MAX_ENTRIES]} onChange={(v) => set(KEY_MAX_ENTRIES)(Number(v) || 0)} min={0} step={1} />
          </FieldRow>
          <FieldRow label={t('默认 TTL（秒）')} hint={t('规则 ttl_seconds 为 0 时使用，0 使用后端默认 3600 秒')}>
            <NumberField value={inputs[KEY_DEFAULT_TTL]} onChange={(v) => set(KEY_DEFAULT_TTL)(Number(v) || 0)} min={0} step={1} />
          </FieldRow>
        </div>
      </SectionWithSave>

      {/* Rule editor */}
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <RadioChipGroup value={editMode} onChange={(v) => {
            if (v === 'visual') {
              const validation = tryParseRulesJsonArray(inputs[KEY_RULES] || '[]');
              if (!validation.ok) { showError(t(validation.message)); return; }
            }
            if (v === 'json') setInputs((prev) => ({ ...prev, [KEY_RULES]: rulesToJson(rules) }));
            setEditMode(v);
          }} options={[{ value: 'visual', label: t('可视化') }, { value: 'json', label: t('JSON 模式') }]} />
          <button onClick={appendTemplates} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
            {t('填充模版')}
          </button>
          <button onClick={openAddModal} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-ui-accent text-ui-accent-fg hover:opacity-90'>
            {t('新增规则')}
          </button>
          <button onClick={refreshCacheStats} disabled={cacheLoading} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover disabled:opacity-50'>
            {t('刷新缓存')}
          </button>
          <button onClick={clearAllCache} className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-xl border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg'>
            {t('清空全部缓存')}
          </button>
        </div>

        {editMode === 'visual' ? (
          rules.length === 0 ? (
            <div className='text-center py-8 text-xs text-ui-text-3'>{t('暂无规则，点击「新增规则」或「填充模版」添加')}</div>
          ) : (
            <div className='rounded-md border border-ui-border overflow-hidden'>
              <div className='overflow-x-auto'>
                <table className='w-full text-xs'>
                  <thead>
                    <tr className='bg-ui-bg-subtle'>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('名称')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('模型正则')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('Key 来源')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('TTL')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('作用域')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('缓存')}</th>
                      <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[110px]'>{t('操作')}</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-ui-divider'>
                    {rules.map((rule) => (
                      <tr key={rule.id} className='hover:bg-ui-bg-hover/50'>
                        <td className='px-3 py-2 font-medium text-ui-text'>{rule.name || '-'}</td>
                        <td className='px-3 py-2'>
                          {(rule.model_regex || []).slice(0, 2).map((v, i) => (
                            <span key={`${v}-${i}`} className={`${miniTag} mr-1 !bg-blue-500/10 !text-blue-600 dark:!text-blue-400 !border-blue-500/20`}>{v}</span>
                          ))}
                          {(rule.model_regex || []).length > 2 && <span className='text-ui-text-3'>+{rule.model_regex.length - 2}</span>}
                        </td>
                        <td className='px-3 py-2'>
                          {(rule.key_sources || []).slice(0, 2).map((src, i) => {
                            const s = normalizeKeySource(src);
                            return <span key={`${s.type}-${i}`} className={`${miniTag} mr-1 !bg-purple-500/10 !text-purple-600 dark:!text-purple-400 !border-purple-500/20`}>{s.type}:{s.type === 'gjson' ? s.path : s.key}</span>;
                          })}
                        </td>
                        <td className='px-3 py-2 text-ui-text-2'>{Number(rule.ttl_seconds || 0) || '-'}</td>
                        <td className='px-3 py-2'>
                          {[
                            rule.include_using_group && t('分组'),
                            rule.include_model_name && t('模型'),
                            rule.include_rule_name && t('规则'),
                          ].filter(Boolean).map((label) => (
                            <span key={label} className={`${miniTag} mr-1 !bg-gray-400/10 !text-ui-text-2 !border-ui-border`}>{label}</span>
                          ))}
                        </td>
                        <td className='px-3 py-2 text-ui-text-2'>
                          {rule.include_rule_name && cacheStats.by_rule_name?.[rule.name?.trim()] != null
                            ? cacheStats.by_rule_name[rule.name.trim()]
                            : 'N/A'}
                        </td>
                        <td className='px-3 py-2'>
                          <div className='flex items-center gap-1'>
                            <button onClick={() => clearRuleCache(rule)} disabled={!rule.include_rule_name}
                              className='p-1 rounded text-ui-text-3 hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 transition-colors' title={t('清空缓存')}>
                              </button>
                            <button onClick={() => openEditModal(rule)}
                              className='p-1 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-hover transition-colors' title={t('编辑')}>
                              </button>
                            <button onClick={() => showConfirm({ title: t('确认删除？'), danger: true, okText: t('删除'), onOk: () => handleDeleteRule(rule.id) })}
                              className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors' title={t('删除')}>
                              </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <FieldRow label={t('规则 JSON')} hint={t('规则为 JSON 数组；可视化与 JSON 模式共用同一份数据。')}>
            <TextAreaField value={inputs[KEY_RULES]} onChange={set(KEY_RULES)} placeholder={RULES_JSON_PLACEHOLDER} rows={12} className='font-mono text-xs' />
          </FieldRow>
        )}
      </div>

      {/* Rule Edit Modal */}
      <ModalDialog
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditingRule(null); }}
        title={isEdit ? t('编辑规则') : t('新增规则')}
        width={720}
        hideFooter
      >
        {editingRule && (
          <div className='space-y-3'>
            <div>
              <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('名称')} *</label>
              <input value={editingRule.name || ''} onChange={(e) => updateEditing({ name: e.target.value })} placeholder='prefer-by-conversation-id' className={inputCls} />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('模型正则（每行一个）')} *</label>
                <textarea value={Array.isArray(editingRule.model_regex) ? editingRule.model_regex.join('\n') : ''} onChange={(e) => updateEditing({ model_regex: normalizeStringList(e.target.value) })} placeholder='^gpt-4o.*$' rows={3} className={inputCls + ' resize-y'} />
              </div>
              <div>
                <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('路径正则（每行一个）')}</label>
                <textarea value={Array.isArray(editingRule.path_regex) ? editingRule.path_regex.join('\n') : ''} onChange={(e) => updateEditing({ path_regex: normalizeStringList(e.target.value) })} placeholder='/v1/chat/completions' rows={3} className={inputCls + ' resize-y'} />
              </div>
            </div>
            <ToggleField label={t('失败后不重试')} hint={t('开启后，若该规则命中且请求失败，将不会切换渠道重试')} checked={!!editingRule.skip_retry_on_failure} onChange={(v) => updateEditing({ skip_retry_on_failure: v })} />

            <CollapsibleSection title={t('高级设置')}>
              <div>
                <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('User-Agent include（每行一个）')}</label>
                <textarea value={Array.isArray(editingRule.user_agent_include) ? editingRule.user_agent_include.join('\n') : ''} onChange={(e) => updateEditing({ user_agent_include: normalizeStringList(e.target.value) })} placeholder='curl\nPostmanRuntime' rows={2} className={inputCls + ' resize-y'} />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('Value 正则')}</label>
                  <input value={editingRule.value_regex || ''} onChange={(e) => updateEditing({ value_regex: e.target.value })} placeholder='^[-0-9A-Za-z._:]{1,128}$' className={inputCls} />
                </div>
                <div>
                  <label className='text-xs font-medium text-ui-text-2 block mb-1'>{t('TTL（秒，0 表示默认）')}</label>
                  <input type='number' value={editingRule.ttl_seconds || 0} onChange={(e) => updateEditing({ ttl_seconds: parseInt(e.target.value) || 0 })} min={0} className={inputCls} />
                  <div className='text-[11px] text-ui-text-3 mt-1'>{t('0 使用默认：')}{effectiveDefaultTTL}{t(' 秒')}</div>
                </div>
              </div>

              {/* Param override template */}
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='text-xs font-medium text-ui-text-2'>{t('参数覆盖模板')}</label>
                  <div className='flex items-center gap-1.5'>
                    <span className={`${miniTag} ${paramTemplateDraft ? '!bg-orange-500/10 !text-orange-600 dark:!text-orange-400 !border-orange-500/20' : '!bg-gray-400/10 !text-ui-text-2 !border-gray-400/20'}`}>
                      {paramTemplateDraft ? t('已设置') : t('未设置')}
                    </span>
                    <button onClick={() => setParamTemplateEditorVisible(true)} className='text-[11px] px-2 py-0.5 rounded border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>{t('可视化编辑')}</button>
                    <button onClick={() => {
                      const raw = (paramTemplateDraft || '').trim();
                      if (!raw) return;
                      if (!verifyJSON(raw)) return showError(t('JSON 格式不正确'));
                      setParamTemplateDraft(JSON.stringify(JSON.parse(raw), null, 2));
                    }} className='text-[11px] px-2 py-0.5 rounded border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>{t('格式化')}</button>
                    <button onClick={() => setParamTemplateDraft('')} className='text-[11px] px-2 py-0.5 rounded border border-ui-border text-ui-text-3 hover:bg-ui-bg-hover'>{t('清空')}</button>
                  </div>
                </div>
                <textarea value={paramTemplateDraft} onChange={(e) => setParamTemplateDraft(e.target.value)} placeholder='{}' rows={4} className={inputCls + ' font-mono resize-y'} />
              </div>

              <div className='grid grid-cols-3 gap-3'>
                <ToggleField label={t('作用域：包含分组')} checked={!!editingRule.include_using_group} onChange={(v) => updateEditing({ include_using_group: v })} />
                <ToggleField label={t('作用域：包含模型名称')} checked={!!editingRule.include_model_name} onChange={(v) => updateEditing({ include_model_name: v })} />
                <ToggleField label={t('作用域：包含规则名称')} checked={!!editingRule.include_rule_name} onChange={(v) => updateEditing({ include_rule_name: v })} />
              </div>
            </CollapsibleSection>

            {/* Key sources */}
            <div>
              <div className='flex items-center justify-between mb-2'>
                <label className='text-xs font-medium text-ui-text-2'>{t('Key 来源')}</label>
                <button onClick={() => updateEditing({ key_sources: [...(editingRule.key_sources || []), { type: 'gjson', path: '' }] })} className='inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'>
                  {t('新增')}
                </button>
              </div>
              <div className='text-[11px] text-ui-text-3 mb-2'>
                {t('常用 context key：')} {CONTEXT_KEY_PRESETS.map((p) => <span key={p.key} className={`${miniTag} mr-1 mb-1 !bg-gray-400/10 !text-ui-text-3 !border-ui-border`}>{p.label}</span>)}
              </div>
              <div className='space-y-2'>
                {(editingRule.key_sources || []).map((src, idx) => {
                  const s = normalizeKeySource(src);
                  return (
                    <div key={idx} className='flex items-center gap-2'>
                      <select value={s.type} onChange={(e) => {
                        const next = [...(editingRule.key_sources || [])];
                        next[idx] = normalizeKeySource({ ...next[idx], type: e.target.value });
                        updateEditing({ key_sources: next });
                      }} className={`${selectCls} w-36`}>
                        {KEY_SOURCE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input value={s.type === 'gjson' ? s.path : s.key}
                        onChange={(e) => {
                          const next = [...(editingRule.key_sources || [])];
                          next[idx] = normalizeKeySource({ ...next[idx], ...(s.type === 'gjson' ? { path: e.target.value } : { key: e.target.value }) });
                          updateEditing({ key_sources: next });
                        }}
                        placeholder={s.type === 'gjson' ? 'metadata.conversation_id' : 'user_id'}
                        className={inputCls + ' flex-1'} />
                      <button onClick={() => {
                        const next = (editingRule.key_sources || []).filter((_, i) => i !== idx);
                        updateEditing({ key_sources: next });
                      }} className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'>
                        </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className='flex justify-end gap-2 pt-3 border-t border-ui-divider'>
              <button onClick={() => { setModalVisible(false); setEditingRule(null); }} className='px-3.5 py-1.5 text-xs rounded-xl border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'>{t('取消')}</button>
              <button onClick={handleModalSave} className='px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存')}</button>
            </div>
          </div>
        )}
      </ModalDialog>

      <ParamOverrideEditorModal
        visible={paramTemplateEditorVisible}
        value={paramTemplateDraft || ''}
        onSave={(nextValue) => { setParamTemplateDraft(nextValue || ''); setParamTemplateEditorVisible(false); }}
        onCancel={() => setParamTemplateEditorVisible(false)}
      />
    </div>
  );
}
