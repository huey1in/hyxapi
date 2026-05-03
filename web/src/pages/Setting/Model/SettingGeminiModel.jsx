/*
 * Gemini 模型设置 — token-system rewrite.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Brain } from 'lucide-react';
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

const GEMINI_SETTING_EXAMPLE = { default: 'OFF' };
const GEMINI_VERSION_EXAMPLE = { default: 'v1beta' };
const IMAGINE_EXAMPLE = ['gemini-2.0-flash-exp-image-generation'];

const DEFAULTS = {
  'gemini.safety_settings': '',
  'gemini.version_settings': '',
  'gemini.supported_imagine_models': '',
  'gemini.thinking_adapter_enabled': false,
  'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
  'gemini.function_call_thought_signature_enabled': true,
  'gemini.remove_function_response_id_enabled': true,
};

export default function SettingGeminiModel(props) {
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

  const safetyError = useMemo(() => {
    const v = inputs['gemini.safety_settings'];
    if (!v || !String(v).trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs['gemini.safety_settings'], t]);

  const versionError = useMemo(() => {
    const v = inputs['gemini.version_settings'];
    if (!v || !String(v).trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs['gemini.version_settings'], t]);

  const imagineError = useMemo(() => {
    const v = inputs['gemini.supported_imagine_models'];
    if (!v || !String(v).trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs['gemini.supported_imagine_models'], t]);

  const submit = () => {
    if (safetyError || versionError || imagineError) {
      return showError(t('请检查输入'));
    }
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    Promise.all(
      diff.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value:
            typeof inputs[item.key] === 'boolean'
              ? String(inputs[item.key])
              : String(inputs[item.key] ?? ''),
        }),
      ),
    )
      .then((res) => {
        if (res.includes(undefined) && diff.length > 1) {
          return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  return (
    <div className='space-y-6'>
      <SectionWithSave
        title={t('Gemini 设置')}
        hint={t('安全策略 / 版本路由 / 图像模型支持')}
        icon={Sparkles}
        iconColor='blue'
        loading={loading}
        onSave={submit}
      >
        <FieldRow
          label={t('Gemini 安全设置')}
          hint={t('default 为默认设置，可单独设置每个分类的安全等级')}
          error={safetyError}
        >
          <TextAreaField
            value={inputs['gemini.safety_settings']}
            onChange={set('gemini.safety_settings')}
            placeholder={
              t('为一个 JSON 文本，例如：') +
              '\n' +
              JSON.stringify(GEMINI_SETTING_EXAMPLE, null, 2)
            }
            rows={6}
            className='font-mono text-xs'
          />
        </FieldRow>

        <FieldRow
          label={t('Gemini 版本设置')}
          hint={t('default 为默认设置，可单独设置每个模型的版本')}
          error={versionError}
        >
          <TextAreaField
            value={inputs['gemini.version_settings']}
            onChange={set('gemini.version_settings')}
            placeholder={
              t('为一个 JSON 文本，例如：') +
              '\n' +
              JSON.stringify(GEMINI_VERSION_EXAMPLE, null, 2)
            }
            rows={6}
            className='font-mono text-xs'
          />
        </FieldRow>

        <FieldRow
          label={t('支持的图像模型')}
          hint={t('JSON 数组，列出可用于图像生成的模型 ID')}
          error={imagineError}
        >
          <TextAreaField
            value={inputs['gemini.supported_imagine_models']}
            onChange={set('gemini.supported_imagine_models')}
            placeholder={t('例如：') + '\n' + JSON.stringify(IMAGINE_EXAMPLE, null, 2)}
            rows={4}
            className='font-mono text-xs'
          />
        </FieldRow>

        <ToggleField
          label={t('启用 FunctionCall 思维签名填充')}
          hint={t('仅为使用 OpenAI 格式的 Gemini/Vertex 渠道填充 thoughtSignature')}
          checked={!!inputs['gemini.function_call_thought_signature_enabled']}
          onChange={set('gemini.function_call_thought_signature_enabled')}
        />
        <ToggleField
          label={t('移除 functionResponse.id 字段')}
          hint={t('Vertex AI 不支持该字段，开启后将自动移除')}
          checked={!!inputs['gemini.remove_function_response_id_enabled']}
          onChange={set('gemini.remove_function_response_id_enabled')}
        />
      </SectionWithSave>

      <SectionWithSave
        title={t('Gemini 思考适配设置')}
        hint={t(
          '默认情况下 Gemini 思考模型会自动决定是否思考；如需计费，推荐将无后缀模型按思考价格设置。支持 gemini-2.5-pro-preview-06-05-thinking-128 格式精确传递预算。',
        )}
        icon={Brain}
        iconColor='purple'
      >
        <ToggleField
          label={t('启用 Gemini 思考后缀适配')}
          hint={t('适配 -thinking、-thinking-预算数字 和 -nothinking 后缀')}
          checked={!!inputs['gemini.thinking_adapter_enabled']}
          onChange={set('gemini.thinking_adapter_enabled')}
        />
        <FieldRow
          label={t('思考预算占比')}
          hint={t('BudgetTokens = MaxTokens × 占比；范围 0.002 - 1')}
        >
          <NumberField
            value={Number(inputs['gemini.thinking_adapter_budget_tokens_percentage']) || 0.6}
            onChange={(v) =>
              set('gemini.thinking_adapter_budget_tokens_percentage')(Number(v))
            }
            min={0.002}
            max={1}
            step={0.01}
            disabled={!inputs['gemini.thinking_adapter_enabled']}
          />
        </FieldRow>
      </SectionWithSave>
    </div>
  );
}
