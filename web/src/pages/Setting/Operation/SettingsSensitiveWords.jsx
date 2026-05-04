/*
 * 屏蔽词过滤设置 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import {
  SectionWithSave,
  FieldRow,
  ToggleField,
  TextAreaField,
} from '../../../components/common/form/Primitives';

const DEFAULTS = {
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
};

export default function SettingsSensitiveWords(props) {
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

  const submit = () => {
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
    <SectionWithSave
      title={t('屏蔽词过滤设置')}
      hint={t('配置敏感词列表，命中词的请求将被拒绝')}
      loading={loading}
      onSave={submit}
    >
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <ToggleField
          label={t('启用屏蔽词过滤')}
          checked={!!inputs.CheckSensitiveEnabled}
          onChange={set('CheckSensitiveEnabled')}
        />
        <ToggleField
          label={t('启用 Prompt 检查')}
          hint={t('对每条 prompt 内容也进行检查')}
          checked={!!inputs.CheckSensitiveOnPromptEnabled}
          onChange={set('CheckSensitiveOnPromptEnabled')}
          disabled={!inputs.CheckSensitiveEnabled}
        />
      </div>
      <FieldRow
        label={t('屏蔽词列表')}
        hint={t('一行一个屏蔽词，不需要符号分割')}
      >
        <TextAreaField
          value={inputs.SensitiveWords}
          onChange={set('SensitiveWords')}
          placeholder={t('一行一个屏蔽词')}
          rows={8}
          className='font-mono text-xs'
        />
      </FieldRow>
    </SectionWithSave>
  );
}
