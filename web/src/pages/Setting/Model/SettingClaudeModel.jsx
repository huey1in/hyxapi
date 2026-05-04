/*
 * Claude 设置 — token-system rewrite.
 */
import React, { useEffect, useState, useMemo } from 'react';
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
  SectionWithSave,
  FieldRow,
  ToggleField,
  NumberField,
  TextAreaField,
} from '../../../components/common/form/Primitives';

const CLAUDE_HEADER = {
  'claude-3-7-sonnet-20250219-thinking': {
    'anthropic-beta': ['output-128k-2025-02-19', 'token-efficient-tools-2025-02-19'],
  },
};

const CLAUDE_DEFAULT_MAX_TOKENS = {
  default: 8192,
  'claude-3-haiku-20240307': 4096,
  'claude-3-opus-20240229': 4096,
  'claude-3-7-sonnet-20250219-thinking': 8192,
};

const DEFAULTS = {
  'claude.model_headers_settings': '',
  'claude.thinking_adapter_enabled': true,
  'claude.default_max_tokens': '',
  'claude.thinking_adapter_budget_tokens_percentage': 0.8,
};

export default function SettingClaudeModel(props) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in (props.options || {})) next[k] = props.options[k];
    }
    setInputs(next);
    setOriginal(structuredClone(next));
  }, [props.options]);

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));

  const headersError = useMemo(() => {
    const v = inputs['claude.model_headers_settings'];
    if (!v || !v.trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs, t]);
  const maxTokensError = useMemo(() => {
    const v = inputs['claude.default_max_tokens'];
    if (!v || !v.trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs, t]);

  const submit = () => {
    if (headersError) return showError(headersError);
    if (maxTokensError) return showError(maxTokensError);
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    Promise.all(
      diff.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value: String(inputs[item.key]),
        }),
      ),
    )
      .then(() => {
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  return (
    <SectionWithSave
      title={t('Claude 设置')}
      hint={t('请求头覆盖、缺省 MaxTokens、思考适配')}loading={loading}
      onSave={submit}
    >
      <FieldRow
        label={t('请求头追加（JSON）')}
        hint={t(
          'Claude 会在原请求头基础上追加这些值，不会覆盖已有同名头；重复值自动忽略。',
        )}
        error={headersError}
      >
        <TextAreaField
          value={inputs['claude.model_headers_settings']}
          onChange={set('claude.model_headers_settings')}
          placeholder={JSON.stringify(CLAUDE_HEADER, null, 2)}
          rows={6}
          className='font-mono text-xs'
        />
      </FieldRow>
      <FieldRow
        label={t('缺省 MaxTokens（JSON）')}
        hint={t('按模型设置默认 max_tokens。default 为兜底值。')}
        error={maxTokensError}
      >
        <TextAreaField
          value={inputs['claude.default_max_tokens']}
          onChange={set('claude.default_max_tokens')}
          placeholder={JSON.stringify(CLAUDE_DEFAULT_MAX_TOKENS, null, 2)}
          rows={6}
          className='font-mono text-xs'
        />
      </FieldRow>
      <ToggleField
        label={t('启用 Claude 思考适配（-thinking 后缀）')}
        checked={!!inputs['claude.thinking_adapter_enabled']}
        onChange={set('claude.thinking_adapter_enabled')}
      />
      <FieldRow
        label={t('思考 BudgetTokens 百分比')}
        hint={t('BudgetTokens = MaxTokens × 此百分比；建议 ≥ 0.1')}
      >
        <NumberField
          value={inputs['claude.thinking_adapter_budget_tokens_percentage']}
          onChange={set('claude.thinking_adapter_budget_tokens_percentage')}
          min={0.1}
          max={1}
          step={0.05}
          disabled={!inputs['claude.thinking_adapter_enabled']}
        />
      </FieldRow>
    </SectionWithSave>
  );
}
