/*
 * 全局模型设置 — token-system rewrite.
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
  Notice,
  Chip,
} from '../../../components/common/form/Primitives';

const thinkingExample = JSON.stringify(
  ['moonshotai/kimi-k2-thinking', 'kimi-k2-thinking'],
  null,
  2,
);
const policyExample = JSON.stringify(
  {
    enabled: true,
    all_channels: false,
    channel_ids: [1, 2],
    channel_types: [1],
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2,
);
const policyAllChannelsExample = JSON.stringify(
  {
    enabled: true,
    all_channels: true,
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2,
);

const POLICY_KEY = 'global.chat_completions_to_responses_policy';

const DEFAULTS = {
  'global.pass_through_request_enabled': false,
  'global.thinking_model_blacklist': '[]',
  'global.chat_completions_to_responses_policy': '{}',
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
};

export default function SettingGlobalModel(props) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (props.options?.[key] !== undefined) {
        let value = props.options[key];
        if (
          key === 'global.thinking_model_blacklist' ||
          key === POLICY_KEY
        ) {
          try {
            value =
              value && String(value).trim() !== ''
                ? JSON.stringify(JSON.parse(value), null, 2)
                : DEFAULTS[key];
          } catch {
            value = DEFAULTS[key];
          }
        }
        next[key] = value;
      }
    }
    setInputs(next);
    setOriginal(structuredClone(next));
  }, [props.options]);

  const set = (k) => (v) => setInputs((p) => ({ ...p, [k]: v }));

  const blacklistError = useMemo(() => {
    const v = inputs['global.thinking_model_blacklist'];
    if (!v || !String(v).trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs['global.thinking_model_blacklist'], t]);

  const policyError = useMemo(() => {
    const v = inputs[POLICY_KEY];
    if (!v || !String(v).trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs[POLICY_KEY], t]);

  const normalize = (key, value) => {
    if (key === 'global.thinking_model_blacklist') {
      return typeof value === 'string' && value.trim() === '' ? '[]' : value;
    }
    if (key === POLICY_KEY) {
      return typeof value === 'string' && value.trim() === '' ? '{}' : value;
    }
    return value;
  };

  const submit = () => {
    if (blacklistError || policyError) return showError(t('请检查输入'));
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    setLoading(true);
    Promise.all(
      diff.map((item) => {
        const v = normalize(item.key, inputs[item.key]);
        return API.put('/api/option/', {
          key: item.key,
          value: typeof v === 'boolean' ? String(v) : String(v ?? ''),
        });
      }),
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

  const formatPolicy = () => {
    const raw = inputs[POLICY_KEY];
    if (!raw || String(raw).trim() === '') return;
    try {
      set(POLICY_KEY)(JSON.stringify(JSON.parse(raw), null, 2));
    } catch {
      showError(t('不是合法的 JSON 字符串'));
    }
  };

  return (
    <div className='space-y-6'>
      <SectionWithSave
        title={t('全局设置')}
        hint={t('请求透传 / 思考模型黑名单')}loading={loading}
        onSave={submit}
      >
        <ToggleField
          label={t('启用请求透传')}
          hint={t('开启后，所有请求将直接透传给上游，重定向和渠道适配将失效；请谨慎开启')}
          checked={!!inputs['global.pass_through_request_enabled']}
          onChange={set('global.pass_through_request_enabled')}
        />
        <FieldRow
          label={t('禁用思考处理的模型列表')}
          hint={t('列出的模型不会自动添加或移除 -thinking / -nothinking 后缀')}
          error={blacklistError}
        >
          <TextAreaField
            value={inputs['global.thinking_model_blacklist']}
            onChange={set('global.thinking_model_blacklist')}
            placeholder={t('例如：') + '\n' + thinkingExample}
            rows={4}
            className='font-mono text-xs'
          />
        </FieldRow>
      </SectionWithSave>

      <div className='space-y-3'>
        <div className='flex items-center gap-2'>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text inline-flex items-center gap-2'>
              {t('ChatCompletions → Responses 兼容配置')}
              <Chip className='!bg-amber-500/10 !text-amber-600 dark:!text-amber-400 !border-amber-500/30'>{t('测试版')}</Chip>
            </div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>
              {t('该功能为测试版，未来配置结构与行为可能变更，请勿在生产环境使用')}
            </div>
          </div>
        </div>
        <Notice kind='warning'>
          {t('提示：该功能为测试版，未来配置结构与功能行为可能发生变更，请勿在生产环境使用。')}
        </Notice>
        <FieldRow
          label={t('参数配置')}
          hint={t('JSON 格式，可使用下方按钮填充模板或格式化')}
          error={policyError}
        >
          <TextAreaField
            value={inputs[POLICY_KEY]}
            onChange={set(POLICY_KEY)}
            placeholder={
              t('例如（指定渠道）：') +
              '\n' +
              policyExample +
              '\n\n' +
              t('例如（全渠道）：') +
              '\n' +
              policyAllChannelsExample
            }
            rows={8}
            className='font-mono text-xs'
          />
        </FieldRow>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={() => set(POLICY_KEY)(policyExample)}
            className='px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
          >
            {t('填充模板（指定渠道）')}
          </button>
          <button
            type='button'
            onClick={() => set(POLICY_KEY)(policyAllChannelsExample)}
            className='px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
          >
            {t('填充模板（全渠道）')}
          </button>
          <button
            type='button'
            onClick={formatPolicy}
            className='px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
          >
            {t('格式化 JSON')}
          </button>
        </div>
      </div>

      <SectionWithSave
        title={t('连接保活设置')}
        hint={t('开启后定期发送 ping 数据，保持上游连接活跃')}>
        <Notice kind='warning'>
          {t('警告：启用保活后，如果已写入保活数据后渠道出错，系统无法重试；若必须开启，请使用尽可能大的 Ping 间隔。')}
        </Notice>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <ToggleField
            label={t('启用 Ping 间隔')}
            hint={t('开启后定期发送 ping 数据保持连接活跃')}
            checked={!!inputs['general_setting.ping_interval_enabled']}
            onChange={set('general_setting.ping_interval_enabled')}
          />
          <FieldRow label={t('Ping 间隔（秒）')}>
            <NumberField
              value={Number(inputs['general_setting.ping_interval_seconds']) || 60}
              onChange={(v) =>
                set('general_setting.ping_interval_seconds')(Number(v))
              }
              min={1}
              step={1}
              disabled={!inputs['general_setting.ping_interval_enabled']}
            />
          </FieldRow>
        </div>
      </SectionWithSave>
    </div>
  );
}
