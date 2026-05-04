/*
 * 用户额度设置 — token-system rewrite.
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
  QuotaForNewUser: '',
  PreConsumedQuota: '',
  QuotaForInviter: '',
  QuotaForInvitee: '',
  'quota_setting.enable_free_model_pre_consume': true,
};

export default function SettingsCreditLimit(props) {
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
      title={t('额度设置')}
      hint={t('用户初始 / 预扣费 / 邀请奖励 等')}loading={loading}
      onSave={submit}
    >
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
        <FieldRow label={t('新用户初始额度')}>
          <NumberField
            value={Number(inputs.QuotaForNewUser) || 0}
            onChange={(v) => set('QuotaForNewUser')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
        <FieldRow
          label={t('请求预扣费额度')}
          hint={t('请求结束后多退少补')}
        >
          <NumberField
            value={Number(inputs.PreConsumedQuota) || 0}
            onChange={(v) => set('PreConsumedQuota')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
        <FieldRow label={t('邀请新用户奖励额度')}>
          <NumberField
            value={Number(inputs.QuotaForInviter) || 0}
            onChange={(v) => set('QuotaForInviter')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
        <FieldRow label={t('新用户使用邀请码奖励额度')}>
          <NumberField
            value={Number(inputs.QuotaForInvitee) || 0}
            onChange={(v) => set('QuotaForInvitee')(String(v))}
            min={0}
            step={1}
          />
        </FieldRow>
      </div>
      <ToggleField
        label={t('对免费模型启用预消耗')}
        hint={t('开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度')}
        checked={!!inputs['quota_setting.enable_free_model_pre_consume']}
        onChange={set('quota_setting.enable_free_model_pre_consume')}
      />
    </SectionWithSave>
  );
}
