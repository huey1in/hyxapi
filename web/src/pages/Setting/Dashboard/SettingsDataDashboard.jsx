/*
 * 数据看板设置 — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'lucide-react';
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
  NativeSelect,
} from '../../../components/common/form/Primitives';

const DEFAULTS = {
  DataExportEnabled: false,
  DataExportInterval: '',
  DataExportDefaultTime: 'hour',
};

export default function DataDashboard(props) {
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
    if (next.DataExportDefaultTime) {
      localStorage.setItem('data_export_default_time', String(next.DataExportDefaultTime));
    }
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
      .then(() => {
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  return (
    <SectionWithSave
      title={t('数据看板设置')}
      hint={t('实验性数据看板的更新间隔与默认时间粒度')}
      icon={LineChart}
      iconColor='blue'
      loading={loading}
      onSave={submit}
    >
      <ToggleField
        label={t('启用数据看板（实验性）')}
        checked={!!inputs.DataExportEnabled}
        onChange={set('DataExportEnabled')}
      />
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow
          label={t('更新间隔（分钟）')}
          hint={t('设置过短会影响数据库性能')}
        >
          <NumberField
            value={Number(inputs.DataExportInterval) || 1}
            onChange={(v) => set('DataExportInterval')(String(v))}
            min={1}
            step={1}
            disabled={!inputs.DataExportEnabled}
          />
        </FieldRow>
        <FieldRow
          label={t('默认时间粒度')}
          hint={t('仅修改展示粒度，统计精确到小时')}
        >
          <NativeSelect
            value={inputs.DataExportDefaultTime || 'hour'}
            onChange={set('DataExportDefaultTime')}
            options={[
              { value: 'hour', label: t('小时') },
              { value: 'day', label: t('天') },
              { value: 'week', label: t('周') },
            ]}
          />
        </FieldRow>
      </div>
    </SectionWithSave>
  );
}
