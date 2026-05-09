/*
 * 日志设置 — token-system rewrite (token confirm + native datetime).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
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
  DateTimeField,
} from '../../../components/common/form/Primitives';
import { showConfirm } from '../../../components/common/ConfirmDialog';

const DEFAULTS = {
  LogConsumeEnabled: false,
};

const initialDate = () => {
  const d = dayjs().subtract(1, 'month');
  return d.format('YYYY-MM-DDTHH:mm');
};

export default function SettingsLog(props) {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState(DEFAULTS);
  const [original, setOriginal] = useState(DEFAULTS);
  const [historyAt, setHistoryAt] = useState(initialDate());
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    const next = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) {
      if (k in (props.options || {})) next[k] = props.options[k];
    }
    setInputs(next);
    setOriginal(structuredClone(next));
  }, [props.options]);

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

  const cleanHistory = () => {
    if (!historyAt) return showError(t('请选择日志记录时间'));
    const target = dayjs(historyAt);
    if (!target.isValid()) return showError(t('请选择有效的时间'));
    const targetStr = target.format('YYYY-MM-DD HH:mm:ss');
    const days = dayjs().diff(target, 'day');
    showConfirm({
      title: t('确认清除历史日志'),
      content: (
        <div className='space-y-2 text-sm'>
          <div className='text-ui-text-2'>
            <span className='text-ui-text-3'>{t('当前时间')}: </span>
            <span className='text-emerald-600 dark:text-emerald-400 font-semibold'>
              {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            </span>
          </div>
          <div className='text-ui-text-2'>
            <span className='text-ui-text-3'>{t('选择时间')}: </span>
            <span className='text-ui-danger font-semibold'>{targetStr}</span>
            {days > 0 && (
              <span className='text-ui-text-3 text-xs ml-1'>
                ({t('约')} {days} {t('天前')})
              </span>
            )}
          </div>
          <div className='flex items-start gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/5'>
            <div className='text-xs text-ui-text-2 leading-relaxed'>
              {t('将删除')}{' '}
              <span className='text-ui-danger font-semibold'>{targetStr}</span>{' '}
              {t('之前的所有日志')}。{t('此操作不可恢复，请仔细确认。')}
            </div>
          </div>
        </div>
      ),
      okText: t('确认删除'),
      danger: true,
      onOk: async () => {
        setCleaning(true);
        try {
          const ts = Math.floor(target.toDate().getTime() / 1000);
          const res = await API.delete(`/api/log/?target_timestamp=${ts}`);
          const { success, message, data } = res.data;
          if (success) {
            showSuccess(`${data} ${t('条日志已清理！')}`);
          } else {
            throw new Error(t('日志清理失败：') + message);
          }
        } catch (e) {
          showError(e.message);
        } finally {
          setCleaning(false);
        }
      },
    });
  };

  return (
    <SectionWithSave
      title={t('日志设置')}
      hint={t('开关消费日志记录，并支持按时间清理历史日志')}loading={loading}
      onSave={submit}
    >
      <ToggleField
        label={t('启用额度消费日志记录')}
        checked={!!inputs.LogConsumeEnabled}
        onChange={(v) => setInputs((p) => ({ ...p, LogConsumeEnabled: v }))}
      />

      <div className='border-t border-ui-divider pt-3'>
        <FieldRow
          label={t('清除历史日志')}
          hint={t('将清除选定时间之前的所有日志')}
          extra={
            <button
              onClick={cleanHistory}
              disabled={cleaning}
              className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-xl border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg disabled:opacity-50 whitespace-nowrap'
            >
              {t('清除历史日志')}
            </button>
          }
        >
          <DateTimeField value={historyAt} onChange={setHistoryAt} />
        </FieldRow>
      </div>
    </SectionWithSave>
  );
}
