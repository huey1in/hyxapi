/*
 * RiskAcknowledgementModal — token-system rewrite of risk-confirm dialog.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import MarkdownRenderer from '../markdown/MarkdownRenderer';

const RiskAcknowledgementModal = React.memo(function RiskAcknowledgementModal({
  visible,
  title,
  markdownContent = '',
  detailTitle = '',
  detailItems = [],
  checklist = [],
  inputPrompt = '',
  requiredText = '',
  inputPlaceholder = '',
  mismatchText = '',
  cancelText = '',
  confirmText = '',
  onCancel,
  onConfirm,
}) {
  const isMobile = useIsMobile();
  const [checkedItems, setCheckedItems] = useState([]);
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCheckedItems(Array(checklist.length).fill(false));
    setTypedText('');
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = ov;
    };
  }, [visible, checklist.length]);

  const allChecked = useMemo(() => {
    if (checklist.length === 0) return true;
    return checkedItems.length === checklist.length && checkedItems.every(Boolean);
  }, [checkedItems, checklist.length]);

  const typedMatched = useMemo(() => {
    if (!requiredText) return true;
    return typedText.trim() === requiredText.trim();
  }, [typedText, requiredText]);

  const detailText = useMemo(() => detailItems.join(', '), [detailItems]);
  const canConfirm = allChecked && typedMatched;

  const handleChecklistChange = useCallback((index, checked) => {
    setCheckedItems((previous) => {
      const next = [...previous];
      next[index] = checked;
      return next;
    });
  }, []);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[140] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className={`border border-ui-border rounded-[28px] shadow-2xl w-full ${
          isMobile ? 'max-w-full max-h-[90vh]' : 'max-w-3xl max-h-[80vh]'
        } flex flex-col overflow-hidden`}
        style={{ backgroundColor: 'var(--page-bg)' }}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-4 border-b border-ui-border'>
          <span className='text-base font-semibold text-ui-text'>
            {title}
          </span>
          <button
            onClick={onCancel}
            className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <X size={16} />
          </button>
        </div>
        <div className='flex-1 overflow-y-auto nice-scroll p-5 space-y-3'>
          {markdownContent && (
            <div className='rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3'>
              <MarkdownRenderer content={markdownContent} />
            </div>
          )}

          {detailItems.length > 0 && (
            <div className='rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2'>
              {detailTitle && <div className='text-sm font-semibold text-ui-text'>{detailTitle}</div>}
              <div className='font-mono text-xs break-all rounded-xl p-2 bg-amber-500/10 border border-amber-500/20 text-ui-text-2'>
                {detailText}
              </div>
            </div>
          )}

          {checklist.length > 0 && (
            <div className='rounded-2xl border border-ui-border p-3 space-y-2'>
              {checklist.map((item, index) => (
                <label key={`risk-check-${index}`} className='flex items-start gap-2 text-sm text-ui-text cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={!!checkedItems[index]}
                    onChange={(e) => handleChecklistChange(index, e.target.checked)}
                    className='w-3.5 h-3.5 mt-1 cursor-pointer accent-current flex-shrink-0'
                  />
                  <span className='leading-relaxed'>{item}</span>
                </label>
              ))}
            </div>
          )}

          {requiredText && (
            <div className='rounded-2xl border border-ui-danger/30 bg-ui-danger-bg p-3 space-y-2'>
              {inputPrompt && <div className='text-sm font-semibold text-ui-text'>{inputPrompt}</div>}
              <div className='font-mono text-xs break-all rounded-xl p-2 border border-ui-border text-ui-text'>
                {requiredText}
              </div>
              <input
                type='text'
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={inputPlaceholder}
                autoFocus
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                className='w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
              />
              {!typedMatched && typedText && (
                <div className='text-[11px] text-ui-danger'>{mismatchText}</div>
              )}
            </div>
          )}
        </div>
        <div className='flex justify-end gap-2 px-5 py-4 border-t border-ui-border'>
          <button
            onClick={onCancel}
            className='inline-flex items-center h-9 px-4 text-sm font-medium rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
          >
            {cancelText}
          </button>
          <button
            disabled={!canConfirm}
            onClick={onConfirm}
            className='inline-flex items-center h-9 px-4 text-sm font-semibold rounded-xl bg-ui-danger text-white hover:opacity-90 disabled:opacity-40 transition-colors whitespace-nowrap'
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});

export default RiskAcknowledgementModal;
