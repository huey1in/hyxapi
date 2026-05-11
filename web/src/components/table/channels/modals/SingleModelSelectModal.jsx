/*
 * Single model select modal — token-system rewrite.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, ChevronDown } from 'lucide-react';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { getModelCategories } from '../../../../helpers/render';
import { Button, IconButton } from '../../../ui';

const SingleModelSelectModal = ({
  visible,
  models = [],
  selected = '',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const normalize = (m) => String(m ?? '').trim();
  const normalizedModels = useMemo(() => {
    const list = Array.isArray(models) ? models : [];
    return Array.from(new Set(list.map(normalize).filter(Boolean)));
  }, [models]);

  const [keyword, setKeyword] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [openCategories, setOpenCategories] = useState({});

  useEffect(() => {
    if (visible) {
      setKeyword('');
      setSelectedModel(normalize(selected));
      setOpenCategories({});
      const onKey = (e) => e.key === 'Escape' && onCancel?.();
      document.addEventListener('keydown', onKey);
      const ov = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = ov;
      };
    }
  }, [visible, selected, onCancel]);

  const filteredModels = useMemo(() => {
    const lower = keyword.trim().toLowerCase();
    if (!lower) return normalizedModels;
    return normalizedModels.filter((m) => m.toLowerCase().includes(lower));
  }, [normalizedModels, keyword]);

  const modelsByCategory = useMemo(() => {
    const categories = getModelCategories(t);
    const categorized = {};
    const uncategorized = [];
    filteredModels.forEach((model) => {
      let found = false;
      for (const [key, category] of Object.entries(categories)) {
        if (key !== 'all' && category.filter({ model_name: model })) {
          if (!categorized[key]) {
            categorized[key] = { label: category.label, icon: category.icon, models: [] };
          }
          categorized[key].models.push(model);
          found = true;
          break;
        }
      }
      if (!found) uncategorized.push(model);
    });
    if (uncategorized.length > 0) {
      categorized.other = { label: t('其他'), icon: null, models: uncategorized };
    }
    return categorized;
  }, [filteredModels, t]);

  const categoryEntries = useMemo(() => Object.entries(modelsByCategory), [modelsByCategory]);

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[125] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className={`border border-ui-border rounded-[20px] shadow-2xl w-full ${
          isMobile ? 'max-w-full' : 'max-w-2xl'
        } max-h-[88vh] flex flex-col overflow-hidden`}
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>{t('选择模型')}</span>
          <IconButton icon={X} size='sm' onClick={onCancel} />
        </div>
        <div className='p-5 space-y-3 overflow-y-auto flex-1'>
          <div className='relative'>
            <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
            <input
              type='text'
              placeholder={t('搜索模型')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className='w-full pl-8 pr-3 py-2 text-sm bg-transparent border border-ui-border rounded-md text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3'
            />
          </div>

          {filteredModels.length === 0 ? (
            <div className='py-12 text-center text-ui-text-3 text-sm'>{t('暂无匹配模型')}</div>
          ) : (
            <div className='space-y-1.5'>
              {categoryEntries.map(([key, cat], idx) => {
                const isOpen = openCategories[key] ?? idx === 0;
                return (
                  <div key={key} className='border border-ui-border rounded-md overflow-hidden'>
                    <Button
                      variant='ghost'
                      size='sm'
                      block
                      onClick={() => setOpenCategories((p) => ({ ...p, [key]: !isOpen }))}
                      className='justify-between'
                      iconRight={<ChevronDown size={14} className={`text-ui-text-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                    >
                      <span className='flex items-center gap-2'>
                        {cat.icon}
                        <span>
                          {cat.label} ({cat.models.length})
                        </span>
                      </span>
                    </Button>
                    {isOpen && (
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-1 p-2'>
                        {cat.models.map((model) => (
                          <label key={model} className='flex items-center gap-2 px-2 py-1 text-sm text-ui-text cursor-pointer hover:bg-ui-bg-subtle rounded'>
                            <input
                              type='radio'
                              name='single-model'
                              checked={selectedModel === model}
                              onChange={() => setSelectedModel(model)}
                              className='w-3.5 h-3.5 cursor-pointer accent-current'
                            />
                            <span className='truncate'>{model}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <Button variant='ghost' size='sm' onClick={onCancel}>
            {t('取消')}
          </Button>
          <Button
            size='sm'
            disabled={!selectedModel}
            onClick={() => onConfirm?.(selectedModel)}
          >
            {t('确定')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SingleModelSelectModal;
