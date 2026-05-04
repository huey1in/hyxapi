/*
 * Grok 设置 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import {
  SectionWithSave,
  FieldRow,
  ToggleField,
  NumberField,
} from '../../../components/common/form/Primitives';

const XAI_VIOLATION_FEE_DOC_URL =
  'https://docs.x.ai/docs/models#usage-guidelines-violation-fee';

const DEFAULTS = {
  'grok.violation_deduction_enabled': true,
  'grok.violation_deduction_amount': 0.05,
};

export default function SettingGrokModel(props) {
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

  const enabled = !!inputs['grok.violation_deduction_enabled'];

  const docLink = (
    <a
      href={XAI_VIOLATION_FEE_DOC_URL}
      target='_blank'
      rel='noreferrer'
      className='text-ui-brand hover:underline'
    >
      {t('官方说明')}
    </a>
  );

  return (
    <SectionWithSave
      title={t('Grok 设置')}
      hint={t('xAI Grok 模型违规扣费')}loading={loading}
      onSave={submit}
    >
      <ToggleField
        label={t('启用违规扣费')}
        hint={
          <>
            {t('开启后，违规请求将额外扣费。')} {docLink}
          </>
        }
        checked={enabled}
        onChange={set('grok.violation_deduction_enabled')}
      />
      <FieldRow
        label={t('违规扣费金额')}
        hint={
          <>
            {t('基础金额，实际扣费 = 基础金额 × 系统分组倍率。')} {docLink}
          </>
        }
      >
        <NumberField
          value={inputs['grok.violation_deduction_amount']}
          onChange={set('grok.violation_deduction_amount')}
          min={0}
          step={0.01}
          disabled={!enabled}
        />
      </FieldRow>
    </SectionWithSave>
  );
}
