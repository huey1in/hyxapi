/*
 * 模型倍率设置 — token-system rewrite.
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
  TextAreaField,
} from '../../../components/common/form/Primitives';
import { showConfirm } from '../../../components/common/ConfirmDialog';
import { Button } from '../../../components/ui';

const JSON_FIELDS = [
  'ModelRatio',
  'CacheRatio',
  'CreateCacheRatio',
  'CompletionRatio',
  'ImageRatio',
];

const DEFAULTS = {
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  ExposeRatioEnabled: false,
};

export default function ModelRatioSettings(props) {
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

  const jsonErrors = useMemo(() => {
    const errs = {};
    for (const k of JSON_FIELDS) {
      const v = inputs[k];
      errs[k] = v && String(v).trim() && !verifyJSON(v) ? t('不是合法的 JSON 字符串') : '';
    }
    return errs;
  }, [inputs, t]);

  const hasError = JSON_FIELDS.some((k) => jsonErrors[k]);

  const submit = () => {
    if (hasError) return showError(t('请检查输入'));
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

  const resetModelRatio = () => {
    showConfirm({
      title: t('确定重置模型倍率吗？'),
      content: t('此修改将不可逆'),
      okText: t('确认重置'),
      danger: true,
      onOk: async () => {
        try {
          const res = await API.post('/api/option/rest_model_ratio');
          if (res.data.success) {
            showSuccess(res.data.message);
            props.refresh();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e.message || t('操作失败'));
        }
      },
    });
  };

  const fields = [
    { key: 'ModelRatio', label: t('模型倍率'), hint: t('键为模型名称，值为倍率') },
    { key: 'CacheRatio', label: t('提示缓存倍率'), hint: t('键为模型名称，值为倍率') },
    {
      key: 'CreateCacheRatio',
      label: t('缓存创建倍率'),
      hint: t('默认为 5m 缓存创建倍率；1h 缓存创建倍率按固定乘法自动计算（当前为 1.6x）'),
    },
    {
      key: 'CompletionRatio',
      label: t('模型补全倍率（仅对自定义模型有效）'),
      hint: t('键为模型名称，值为倍率，仅对自定义模型有效'),
    },
    {
      key: 'ImageRatio',
      label: t('图片输入倍率'),
      hint: t('图片输入相关的倍率设置，仅部分模型支持该计费；键为模型名称，值为倍率'),
    },
  ];

  return (
    <SectionWithSave
      title={t('模型倍率设置')}
      hint={t('各类模型倍率 / 补全倍率 / 缓存倍率')}loading={loading}
      onSave={submit}
      onSaveLabel={t('保存模型倍率设置')}
      extraActions={
        <Button size='sm' variant='danger' onClick={resetModelRatio}>
          {t('重置模型倍率')}
        </Button>
      }
    >
      {fields.map((f) => (
        <FieldRow key={f.key} label={f.label} hint={f.hint} error={jsonErrors[f.key]}>
          <TextAreaField
            value={inputs[f.key]}
            onChange={set(f.key)}
            placeholder='{}'
            rows={6}
            className='font-mono text-xs'
          />
        </FieldRow>
      ))}
      <ToggleField
        label={t('暴露倍率接口')}
        hint={t('开启后外部可通过 API 查询倍率信息')}
        checked={!!inputs.ExposeRatioEnabled}
        onChange={set('ExposeRatioEnabled')}
      />
    </SectionWithSave>
  );
}
