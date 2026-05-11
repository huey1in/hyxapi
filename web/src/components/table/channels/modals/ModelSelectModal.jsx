/*
 * Bulk model select modal — token-system rewrite. Splits into "new" and
 * "existing" tabs (relative to current channel selection + redirect map),
 * supports per-category select-all and search.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { Search, X, Info, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getModelCategories } from '../../../../helpers/render';
import { Button, IconButton, Tabs as UITabs } from '../../../ui';

const ModelSelectModal = ({
  visible,
  models = [],
  selected = [],
  redirectModels = [],
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const getModelName = (m) => {
    if (!m) return '';
    if (typeof m === 'string') return m;
    if (typeof m === 'object' && m.model_name) return m.model_name;
    return String(m ?? '');
  };
  const normalize = (m) => (typeof m === 'string' ? m.trim() : '');

  const normalizedSelected = useMemo(() => (selected || []).map(getModelName), [selected]);

  const [checkedList, setCheckedList] = useState(normalizedSelected);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('new');
  const [openCategories, setOpenCategories] = useState({});

  const normalizedRedirectModels = useMemo(
    () => Array.from(new Set((redirectModels || []).map(normalize).filter(Boolean))),
    [redirectModels],
  );
  const normalizedSelectedSet = useMemo(() => {
    const s = new Set();
    (selected || []).forEach((m) => {
      const n = normalize(m);
      if (n) s.add(n);
    });
    return s;
  }, [selected]);
  const classificationSet = useMemo(() => {
    const s = new Set(normalizedSelectedSet);
    normalizedRedirectModels.forEach((m) => s.add(m));
    return s;
  }, [normalizedSelectedSet, normalizedRedirectModels]);
  const redirectOnlySet = useMemo(() => {
    const s = new Set();
    normalizedRedirectModels.forEach((m) => {
      if (!normalizedSelectedSet.has(m)) s.add(m);
    });
    return s;
  }, [normalizedRedirectModels, normalizedSelectedSet]);

  const filteredModels = (models || []).filter((m) =>
    String(m || '').toLowerCase().includes(keyword.toLowerCase()),
  );

  const isExistingModel = (m) => classificationSet.has(normalize(m));
  const newModels = filteredModels.filter((m) => !isExistingModel(m));
  const existingModels = filteredModels.filter((m) => isExistingModel(m));

  useEffect(() => {
    if (visible) {
      setCheckedList(normalizedSelected);
      const onKey = (e) => e.key === 'Escape' && onCancel?.();
      document.addEventListener('keydown', onKey);
      const ov = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = ov;
      };
    }
  }, [visible, normalizedSelected, onCancel]);

  useEffect(() => {
    if (visible) {
      const hasNew = newModels.length > 0;
      setActiveTab(hasNew ? 'new' : 'existing');
    }
  }, [visible, newModels.length, selected]);

  const categorize = (list) => {
    const categories = getModelCategories(t);
    const out = {};
    const uncategorized = [];
    list.forEach((m) => {
      let found = false;
      for (const [k, c] of Object.entries(categories)) {
        if (k !== 'all' && c.filter({ model_name: m })) {
          if (!out[k]) out[k] = { label: c.label, icon: c.icon, models: [] };
          out[k].models.push(m);
          found = true;
          break;
        }
      }
      if (!found) uncategorized.push(m);
    });
    if (uncategorized.length) out.other = { label: t('其他'), icon: null, models: uncategorized };
    return out;
  };

  const newByCat = categorize(newModels);
  const existingByCat = categorize(existingModels);

  const handleSelectAll = (list, checked) => {
    if (checked) {
      const next = [...checkedList];
      list.forEach((m) => {
        if (!next.includes(m)) next.push(m);
      });
      setCheckedList(next);
    } else {
      setCheckedList(checkedList.filter((m) => !list.includes(m)));
    }
  };
  const isAllSelected = (list) =>
    list.length > 0 && list.every((m) => checkedList.includes(m));
  const isIndeterminate = (list) => {
    const c = list.filter((m) => checkedList.includes(m)).length;
    return c > 0 && c < list.length;
  };

  const renderCategorySection = (byCat, prefix) => {
    const entries = Object.entries(byCat);
    if (!entries.length) return null;
    return (
      <div className='space-y-1.5'>
        {entries.map(([key, c], idx) => {
          const id = `${prefix}_${idx}`;
          const isOpen = openCategories[id] ?? true;
          const allSel = isAllSelected(c.models);
          const indet = isIndeterminate(c.models);
          return (
            <div key={id} className='border border-ui-border rounded-md overflow-hidden'>
              <div className='flex items-center justify-between px-3 py-2 bg-ui-bg-subtle text-sm text-ui-text'>
                <button
                  onClick={() => setOpenCategories((p) => ({ ...p, [id]: !isOpen }))}
                  className='flex items-center gap-2 flex-1'
                >
                  {c.icon}
                  <span>
                    {c.label} ({c.models.length})
                  </span>
                  <ChevronDown size={14} className={`text-ui-text-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <input
                  type='checkbox'
                  checked={allSel}
                  ref={(el) => { if (el) el.indeterminate = indet; }}
                  onChange={(e) => handleSelectAll(c.models, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className='ml-2 w-3.5 h-3.5 cursor-pointer accent-current'
                />
              </div>
              {isOpen && (
                <div className='p-2'>
                  <div className='text-[11px] text-ui-text-3 mb-2 flex items-center gap-2'>
                    {c.icon}
                    {t('已选择 {{selected}} / {{total}}', {
                      selected: c.models.filter((m) => checkedList.includes(m)).length,
                      total: c.models.length,
                    })}
                  </div>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-1'>
                    {c.models.map((m) => (
                      <label key={m} className='flex items-center gap-2 px-2 py-1 text-sm text-ui-text cursor-pointer hover:bg-ui-bg-subtle rounded'>
                        <input
                          type='checkbox'
                          checked={checkedList.includes(m)}
                          onChange={() => {
                            if (checkedList.includes(m)) setCheckedList(checkedList.filter((x) => x !== m));
                            else setCheckedList([...checkedList, m]);
                          }}
                          className='w-3.5 h-3.5 cursor-pointer accent-current flex-shrink-0'
                        />
                        <span className='truncate'>{m}</span>
                        {redirectOnlySet.has(normalize(m)) && (
                          <Info size={11} className='text-amber-500 flex-shrink-0' aria-label={t('来自模型重定向，尚未加入模型列表')} />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[125] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className={`border border-ui-border rounded-[20px] shadow-2xl w-full ${
          isMobile ? 'max-w-full' : 'max-w-3xl'
        } max-h-[88vh] flex flex-col overflow-hidden`}
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>{t('选择模型')}</span>
          <div className='flex items-center gap-1'>
            {(newModels.length > 0 || existingModels.length > 0) && (
              <UITabs
                size='sm'
                value={activeTab}
                onChange={setActiveTab}
                items={[
                  newModels.length > 0 && { value: 'new', label: `${t('新获取的模型')} (${newModels.length})` },
                  existingModels.length > 0 && { value: 'existing', label: `${t('已有的模型')} (${existingModels.length})` },
                ].filter(Boolean)}
              />
            )}
            <IconButton icon={X} size='sm' onClick={onCancel} className='ml-1' />
          </div>
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
            <>
              {activeTab === 'new' && renderCategorySection(newByCat, 'new')}
              {activeTab === 'existing' && renderCategorySection(existingByCat, 'existing')}
            </>
          )}
        </div>

        <div className='flex items-center justify-between px-5 py-3 border-t border-ui-border'>
          {(() => {
            const cur = activeTab === 'new' ? newModels : existingModels;
            const sel = cur.filter((m) => checkedList.includes(m)).length;
            return (
              <div className='flex items-center gap-2 text-[11px] text-ui-text-3'>
                <span>{t('已选择 {{selected}} / {{total}}', { selected: sel, total: cur.length })}</span>
                <input
                  type='checkbox'
                  checked={cur.length > 0 && sel === cur.length}
                  ref={(el) => { if (el) el.indeterminate = sel > 0 && sel < cur.length; }}
                  onChange={(e) => handleSelectAll(cur, e.target.checked)}
                  className='w-3.5 h-3.5 cursor-pointer accent-current'
                />
              </div>
            );
          })()}
          <div className='flex gap-2'>
            <Button size='sm' variant='ghost' onClick={onCancel}>
              {t('取消')}
            </Button>
            <Button size='sm' onClick={() => onConfirm?.(checkedList)}>
              {t('确定')}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ModelSelectModal;
