/*
 * 模型请求速率限制 — token-system rewrite.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
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

const DEFAULTS = {
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: -1,
  ModelRequestRateLimitSuccessCount: 1000,
  ModelRequestRateLimitDurationMinutes: 1,
  ModelRequestRateLimitGroup: '',
};

export default function RequestRateLimit(props) {
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

  const groupJsonError = useMemo(() => {
    const v = inputs.ModelRequestRateLimitGroup;
    if (!v || !v.trim()) return '';
    return verifyJSON(v) ? '' : t('不是合法的 JSON 字符串');
  }, [inputs.ModelRequestRateLimitGroup, t]);

  const submit = () => {
    if (groupJsonError) return showError(groupJsonError);
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
        for (let i = 0; i < res.length; i++) {
          if (res[i] && !res[i].data?.success) {
            return showError(res[i].data.message);
          }
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  return (
    <SectionWithSave
      title={t('模型请求速率限制')}
      hint={t('针对每个用户限制单位时间内的模型调用次数')}
      icon={Gauge}
      iconColor='orange'
      loading={loading}
      onSave={submit}
    >
      <ToggleField
        label={t('启用速率限制')}
        hint={t('可能会影响高并发性能')}
        checked={!!inputs.ModelRequestRateLimitEnabled}
        onChange={set('ModelRequestRateLimitEnabled')}
      />

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <FieldRow label={t('限制周期（分钟）')} hint={t('频率限制的周期')}>
          <NumberField
            value={Number(inputs.ModelRequestRateLimitDurationMinutes) || 1}
            onChange={(v) => set('ModelRequestRateLimitDurationMinutes')(String(v))}
            min={1}
            step={1}
            disabled={!inputs.ModelRequestRateLimitEnabled}
          />
        </FieldRow>
        <FieldRow
          label={t('每周期最多请求次数')}
          hint={t('包括失败请求；0 代表不限')}
        >
          <NumberField
            value={Number(inputs.ModelRequestRateLimitCount)}
            onChange={(v) => set('ModelRequestRateLimitCount')(String(v))}
            min={0}
            max={100000000}
            step={1}
            disabled={!inputs.ModelRequestRateLimitEnabled}
          />
        </FieldRow>
        <FieldRow
          label={t('每周期最多请求完成次数')}
          hint={t('只包括请求成功的次数')}
        >
          <NumberField
            value={Number(inputs.ModelRequestRateLimitSuccessCount) || 1000}
            onChange={(v) => set('ModelRequestRateLimitSuccessCount')(String(v))}
            min={1}
            max={100000000}
            step={1}
            disabled={!inputs.ModelRequestRateLimitEnabled}
          />
        </FieldRow>
      </div>

      <FieldRow
        label={t('分组速率限制（JSON）')}
        hint={t('格式：{"组名": [最多请求次数, 最多请求完成次数]}。前者必须 ≥ 0，后者必须 ≥ 1，最大值 2147483647。分组优先级高于全局，限制周期沿用上方设置。')}
        error={groupJsonError}
      >
        <TextAreaField
          value={inputs.ModelRequestRateLimitGroup}
          onChange={set('ModelRequestRateLimitGroup')}
          placeholder='{\n  "default": [200, 100],\n  "vip": [0, 1000]\n}'
          rows={6}
          className='font-mono text-xs'
        />
      </FieldRow>
    </SectionWithSave>
  );
}
