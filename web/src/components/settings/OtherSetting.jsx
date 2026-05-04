/*
 * 其他设置 — token-system rewrite.
 * 公告 / 用户协议 / 隐私政策 + 检查更新 Modal
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { FieldRow, TextAreaField, Notice } from '../common/form/Primitives';

const LEGAL_USER_AGREEMENT_KEY = 'legal.user_agreement';
const LEGAL_PRIVACY_POLICY_KEY = 'legal.privacy_policy';

function UpdateModal({ open, onClose, tagName, content, t }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[200] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 pt-4 pb-3 border-b border-ui-divider'>
          <h3 className='text-sm font-semibold text-ui-text'>
            {t('新版本')}：{tagName}
          </h3>
          <button
            onClick={onClose}
            className='w-7 h-7 inline-flex items-center justify-center rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            </button>
        </div>
        <div
          className='flex-1 overflow-y-auto px-5 py-4 text-xs text-ui-text-2 leading-relaxed prose prose-xs dark:prose-invert max-w-none'
          dangerouslySetInnerHTML={{ __html: content }}
        />
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-divider'>
          <button
            onClick={onClose}
            className='px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'
          >
            {t('关闭')}
          </button>
          <a
            href={`https://github.com/Calcium-Ion/new-api/releases/tag/${tagName}`}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'
          >
            {t('详情')}
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const OtherSetting = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    Notice: '',
    [LEGAL_USER_AGREEMENT_KEY]: '',
    [LEGAL_PRIVACY_POLICY_KEY]: '',
  });
  const [loadingKeys, setLoadingKeys] = useState({});
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [statusState] = useContext(StatusContext);
  const [updateData, setUpdateData] = useState({ tag_name: '', content: '' });

  const updateOption = async (key, value, successMsg) => {
    setLoadingKeys((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await API.put('/api/option/', { key, value });
      if (res.data.success) {
        setInputs((prev) => ({ ...prev, [key]: value }));
        showSuccess(successMsg);
      } else showError(res.data.message);
    } catch {
      showError(t('保存失败'));
    } finally {
      setLoadingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const checkUpdate = async () => {
    setLoadingKeys((prev) => ({ ...prev, CheckUpdate: true }));
    try {
      const res = await fetch(
        'https://api.github.com/repos/Calcium-Ion/new-api/releases/latest',
        { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
      ).then((r) => r.json());
      const { tag_name, body } = res;
      if (tag_name === statusState?.status?.version) {
        showSuccess(`${t('已是最新版本')}：${tag_name}`);
      } else {
        setUpdateData({ tag_name, content: marked.parse(body) });
        setShowUpdateModal(true);
      }
    } catch {
      showError(t('检查更新失败，请稍后再试'));
    } finally {
      setLoadingKeys((prev) => ({ ...prev, CheckUpdate: false }));
    }
  };

  useEffect(() => {
    (async () => {
      const res = await API.get('/api/option/');
      if (res.data.success) {
        const newInputs = {};
        res.data.data.forEach((item) => {
          if (item.key in inputs) newInputs[item.key] = item.value;
        });
        setInputs((prev) => ({ ...prev, ...newInputs }));
      }
    })();
  }, []);

  const fields = [
    {
      key: 'Notice',
      label: t('公告'),
      hint: t('在此输入新的公告内容，支持 Markdown & HTML 代码'),
      successMsg: t('公告已更新'),
    },
    {
      key: LEGAL_USER_AGREEMENT_KEY,
      label: t('用户协议'),
      hint: t('填写用户协议内容后，用户注册时将被要求勾选已阅读用户协议'),
      successMsg: t('用户协议已更新'),
    },
    {
      key: LEGAL_PRIVACY_POLICY_KEY,
      label: t('隐私政策'),
      hint: t('填写隐私政策内容后，用户注册时将被要求勾选已阅读隐私政策'),
      successMsg: t('隐私政策已更新'),
    },
  ];

  return (
    <div className='space-y-6'>
      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-semibold text-ui-text'>{t('通用设置')}</div>
            <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('公告 / 用户协议 / 隐私政策')}</div>
          </div>
          <button
            onClick={checkUpdate}
            disabled={!!loadingKeys.CheckUpdate}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover disabled:opacity-50'
          >
            {t('检查更新')}
          </button>
        </div>

        {fields.map((f) => (
          <div key={f.key} className='space-y-2'>
            <FieldRow label={f.label} hint={f.hint}>
              <TextAreaField
                value={inputs[f.key] || ''}
                onChange={(v) => setInputs((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={t('在此输入内容，支持 Markdown & HTML 代码')}
                rows={6}
                className='font-mono text-xs'
              />
            </FieldRow>
            <div className='flex justify-end'>
              <button
                onClick={() => updateOption(f.key, inputs[f.key], f.successMsg)}
                disabled={!!loadingKeys[f.key]}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
              >
                {t('保存')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <UpdateModal
        open={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        tagName={updateData.tag_name}
        content={updateData.content}
        t={t}
      />
    </div>
  );
};

export default OtherSetting;
