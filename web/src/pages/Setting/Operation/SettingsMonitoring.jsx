/*
 * 监控设置 — token-system rewrite.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  parseHttpStatusCodeRules,
} from '../../../helpers';
import {
  SectionWithSave,
  FieldRow,
  ToggleField,
  NumberField,
  TextAreaField,
} from '../../../components/common/form/Primitives';
import HttpStatusCodeRulesInput from '../../../components/settings/HttpStatusCodeRulesInput';

const DEFAULTS = {
  ChannelDisableThreshold: '',
  QuotaRemindThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
};

export default function SettingsMonitoring(props) {
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

  const parsedDisable = useMemo(
    () => parseHttpStatusCodeRules(inputs.AutomaticDisableStatusCodes || ''),
    [inputs.AutomaticDisableStatusCodes],
  );
  const parsedRetry = useMemo(
    () => parseHttpStatusCodeRules(inputs.AutomaticRetryStatusCodes || ''),
    [inputs.AutomaticRetryStatusCodes],
  );

  const submit = () => {
    const diff = compareObjects(inputs, original);
    if (!diff.length) return showWarning(t('你似乎并没有修改什么'));
    if (!parsedDisable.ok) {
      const details = parsedDisable.invalidTokens?.length
        ? `: ${parsedDisable.invalidTokens.join(', ')}`
        : '';
      return showError(`${t('自动禁用状态码格式不正确')}${details}`);
    }
    if (!parsedRetry.ok) {
      const details = parsedRetry.invalidTokens?.length
        ? `: ${parsedRetry.invalidTokens.join(', ')}`
        : '';
      return showError(`${t('自动重试状态码格式不正确')}${details}`);
    }

    setLoading(true);
    Promise.all(
      diff.map((item) => {
        let value = '';
        if (typeof inputs[item.key] === 'boolean') {
          value = String(inputs[item.key]);
        } else {
          const normalizedMap = {
            AutomaticDisableStatusCodes: parsedDisable.normalized,
            AutomaticRetryStatusCodes: parsedRetry.normalized,
          };
          value = String(normalizedMap[item.key] ?? inputs[item.key] ?? '');
        }
        return API.put('/api/option/', { key: item.key, value });
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

  return (
    <SectionWithSave
      title={t('监控设置')}
      hint={t('通道健康检测、自动启用 / 禁用、状态码与关键词规则')}loading={loading}
      onSave={submit}
      onSaveLabel={t('保存监控设置')}
    >
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <ToggleField
          label={t('定时测试所有通道')}
          checked={!!inputs['monitor_setting.auto_test_channel_enabled']}
          onChange={set('monitor_setting.auto_test_channel_enabled')}
        />
        <FieldRow
          label={t('自动测试间隔（分钟）')}
          hint={t('每隔多少分钟测试一次所有通道')}
        >
          <NumberField
            value={Number(inputs['monitor_setting.auto_test_channel_minutes']) || 10}
            onChange={(v) =>
              set('monitor_setting.auto_test_channel_minutes')(parseInt(v) || 0)
            }
            min={1}
            step={1}
            disabled={!inputs['monitor_setting.auto_test_channel_enabled']}
          />
        </FieldRow>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow
          label={t('测试响应时间阈值（秒）')}
          hint={t('超过此时间将自动禁用通道；0 表示不限制')}
        >
          <NumberField
            value={Number(inputs.ChannelDisableThreshold) || 0}
            onChange={(v) => set('ChannelDisableThreshold')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
        <FieldRow
          label={t('额度提醒阈值（Token）')}
          hint={t('低于此额度时将发送邮件提醒用户')}
        >
          <NumberField
            value={Number(inputs.QuotaRemindThreshold) || 0}
            onChange={(v) => set('QuotaRemindThreshold')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <ToggleField
          label={t('失败时自动禁用通道')}
          checked={!!inputs.AutomaticDisableChannelEnabled}
          onChange={set('AutomaticDisableChannelEnabled')}
        />
        <ToggleField
          label={t('成功时自动启用通道')}
          checked={!!inputs.AutomaticEnableChannelEnabled}
          onChange={set('AutomaticEnableChannelEnabled')}
        />
      </div>

      <HttpStatusCodeRulesInput
        label={t('自动禁用状态码')}
        placeholder={t('例如：401, 403, 429, 500-599')}
        hint={t('支持单个状态码或范围（含首尾），逗号分隔')}
        value={inputs.AutomaticDisableStatusCodes}
        onChange={set('AutomaticDisableStatusCodes')}
        parsed={parsedDisable}
        invalidText={t('自动禁用状态码格式不正确')}
      />
      <HttpStatusCodeRulesInput
        label={t('自动重试状态码')}
        placeholder={t('例如：401, 403, 429, 500-599')}
        hint={t('支持单个状态码或范围；504 和 524 始终不重试')}
        value={inputs.AutomaticRetryStatusCodes}
        onChange={set('AutomaticRetryStatusCodes')}
        parsed={parsedRetry}
        invalidText={t('自动重试状态码格式不正确')}
      />

      <FieldRow
        label={t('自动禁用关键词')}
        hint={t('一行一个，不区分大小写；上游返回错误中包含关键词时自动禁用通道')}
      >
        <TextAreaField
          value={inputs.AutomaticDisableKeywords}
          onChange={set('AutomaticDisableKeywords')}
          placeholder={t('一行一个关键词')}
          rows={6}
          className='font-mono text-xs'
        />
      </FieldRow>
    </SectionWithSave>
  );
}
