/*
 * Channel key display — token-system rewrite.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, Copy, Info } from 'lucide-react';
import { copy, showSuccess } from '../../../helpers';

const parseChannelKeys = (keyData, t) => {
  if (!keyData) return [];
  const trimmed = keyData.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: index,
          content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
          type: typeof item === 'string' ? 'text' : 'json',
          label: `${t('密钥')} ${index + 1}`,
        }));
      }
    } catch {}
  }
  const lines = trimmed.split('\n').filter((line) => line.trim());
  if (lines.length > 1) {
    return lines.map((line, index) => ({
      id: index,
      content: line.trim(),
      type: 'text',
      label: `${t('密钥')} ${index + 1}`,
    }));
  }
  return [{ id: 0, content: trimmed, type: trimmed.startsWith('{') ? 'json' : 'text', label: t('密钥') }];
};

const ChannelKeyDisplay = ({
  keyData,
  showSuccessIcon = true,
  successText,
  showWarning = true,
  warningText,
}) => {
  const { t } = useTranslation();
  const parsedKeys = parseChannelKeys(keyData, t);
  const isMultiple = parsedKeys.length > 1;

  const handleCopyAll = () => {
    copy(keyData);
    showSuccess(t('所有密钥已复制到剪贴板'));
  };
  const handleCopyKey = (content) => {
    copy(content);
    showSuccess(t('密钥已复制到剪贴板'));
  };

  return (
    <div className='space-y-4'>
      {showSuccessIcon && (
        <div className='flex items-center gap-2'>
          <CheckCircle2 size={18} className='text-emerald-500' />
          <span className='text-sm font-semibold text-emerald-600 dark:text-emerald-400'>
            {successText || t('验证成功')}
          </span>
        </div>
      )}

      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-semibold text-ui-text'>
            {isMultiple ? t('渠道密钥列表') : t('渠道密钥')}
          </span>
          {isMultiple && (
            <div className='flex items-center gap-2'>
              <span className='text-[11px] text-ui-text-3'>
                {t('共 {{count}} 个密钥', { count: parsedKeys.length })}
              </span>
              <button
                onClick={handleCopyAll}
                className='inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
              >
                <Copy size={11} />
                {t('复制全部')}
              </button>
            </div>
          )}
        </div>

        <div className='space-y-3 max-h-80 overflow-auto'>
          {parsedKeys.map((it) => (
            <div key={it.id} className='border border-ui-border rounded-lg p-3 bg-ui-bg'>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-xs font-semibold text-ui-text-2'>{it.label}</span>
                <div className='flex items-center gap-1.5'>
                  {it.type === 'json' && (
                    <span className='inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'>
                      JSON
                    </span>
                  )}
                  <button
                    onClick={() => handleCopyKey(it.content)}
                    className='inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
                  >
                    <Copy size={11} />
                    {t('复制')}
                  </button>
                </div>
              </div>
              <div className='bg-ui-bg-subtle rounded-md p-2 max-h-40 overflow-auto'>
                <pre className='text-xs font-mono break-all whitespace-pre-wrap text-ui-text m-0'>
                  {it.content}
                </pre>
              </div>
              {it.type === 'json' && (
                <p className='mt-1.5 text-[11px] text-ui-text-3'>{t('JSON格式密钥，请确保格式正确')}</p>
              )}
            </div>
          ))}
        </div>

        {isMultiple && (
          <div className='flex items-start gap-2 px-3 py-2 rounded-md border border-blue-500/30 bg-blue-500/5'>
            <Info size={14} className='text-blue-500 flex-shrink-0 mt-0.5' />
            <span className='text-[11px] text-ui-text-2 leading-relaxed'>
              {t('检测到多个密钥，您可以单独复制每个密钥，或点击复制全部获取完整内容。')}
            </span>
          </div>
        )}
      </div>

      {showWarning && (
        <div className='flex items-start gap-2 px-3 py-3 rounded-md border border-amber-500/30 bg-amber-500/5'>
          <AlertTriangle size={16} className='text-amber-500 flex-shrink-0 mt-0.5' />
          <div className='flex-1'>
            <div className='text-sm font-semibold text-amber-700 dark:text-amber-300 mb-1'>{t('安全提醒')}</div>
            <div className='text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed'>
              {warningText || t('请妥善保管密钥信息，不要泄露给他人。如有安全疑虑，请及时更换密钥。')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelKeyDisplay;
