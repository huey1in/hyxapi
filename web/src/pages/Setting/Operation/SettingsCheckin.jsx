/*
 * 签到设置 — token-system rewrite.
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
  NumberField,
} from '../../../components/common/form/Primitives';

const DEFAULTS = {
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 1000,
  'checkin_setting.max_quota': 10000,
};

export default function SettingsCheckin(props) {
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

  const enabled = !!inputs['checkin_setting.enabled'];

  return (
    <SectionWithSave
      title={t('签到设置')}
      hint={t('签到功能允许用户每日签到获取随机额度奖励')}loading={loading}
      onSave={submit}
    >
      <ToggleField
        label={t('启用签到功能')}
        checked={enabled}
        onChange={set('checkin_setting.enabled')}
      />
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('签到最小额度')} hint={t('签到奖励的最小额度')}>
          <NumberField
            value={inputs['checkin_setting.min_quota']}
            onChange={set('checkin_setting.min_quota')}
            disabled={!enabled}
            min={0}
          />
        </FieldRow>
        <FieldRow label={t('签到最大额度')} hint={t('签到奖励的最大额度')}>
          <NumberField
            value={inputs['checkin_setting.max_quota']}
            onChange={set('checkin_setting.max_quota')}
            disabled={!enabled}
            min={0}
          />
        </FieldRow>
      </div>
    </SectionWithSave>
  );
}
