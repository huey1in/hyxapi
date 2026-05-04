/*
 * ModelPricingEditor — visual model pricing editor.
 * Token-system rewrite. Per-request and audio billing removed.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PRICE_SUFFIX,
  buildSummaryText,
  hasValue,
  useModelPricingEditorState,
} from '../hooks/useModelPricingEditorState';
import { Notice } from '../../../../components/common/form/Primitives';
import Pagination from '../../../../components/common/table/Pagination';
import ModalDialog from '../../../../components/common/ModalDialog';

const inputCls = 'w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40 disabled:opacity-50';

function PriceInput({
  label, value, placeholder, onChange, suffix = PRICE_SUFFIX,
  disabled = false, extraText = '', headerAction = null, hidden = false,
}) {
  if (hidden) return null;
  return (
    <div className='mb-3'>
      <div className='flex items-center justify-between gap-3 mb-1'>
        <label className='text-xs font-medium text-ui-text-2'>{label}</label>
        {headerAction}
      </div>
      <div className='flex items-center gap-1'>
        <input
          type='text'
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        />
        {suffix && <span className='text-[10px] text-ui-text-3 whitespace-nowrap'>{suffix}</span>}
      </div>
      {extraText && <div className='mt-1 text-[11px] text-ui-text-3'>{extraText}</div>}
    </div>
  );
}

function ToggleSmall({ checked, onChange, disabled = false }) {
  return (
    <button
      type='button'
      role='switch'
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border'}`}
    >
      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function MiniTag({ color = 'blue', children }) {
  const colors = {
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${colors[color] || colors.blue}`}>
      {children}
    </span>
  );
}

export default function ModelPricingEditor({
  options,
  refresh,
  allowAddModel = true,
  allowDeleteModel = true,
  showConflictFilter = true,
  listDescription = '',
  emptyTitle = '',
  emptyDescription = '',
}) {
  const { t } = useTranslation();
  const [addVisible, setAddVisible] = useState(false);
  const [batchVisible, setBatchVisible] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  const {
    selectedModel, selectedModelName, selectedModelNames,
    setSelectedModelName, setSelectedModelNames,
    searchText, setSearchText, currentPage, setCurrentPage,
    loading, conflictOnly, setConflictOnly,
    filteredModels, pagedData, selectedWarnings, previewRows,
    isOptionalFieldEnabled, handleOptionalFieldToggle,
    handleNumericFieldChange, handleSubmit, addModel, deleteModel, applySelectedModelPricing,
  } = useModelPricingEditorState({ options, refresh, t });

  const handleAddModel = () => {
    if (addModel(newModelName)) { setNewModelName(''); setAddVisible(false); }
  };

  const allSelected = pagedData.length > 0 && pagedData.every((m) => selectedModelNames.includes(m.name));
  const toggleAll = () => { if (allSelected) setSelectedModelNames([]); else setSelectedModelNames(pagedData.map((m) => m.name)); };
  const toggleRow = (name) => {
    setSelectedModelNames(selectedModelNames.includes(name) ? selectedModelNames.filter((n) => n !== name) : [...selectedModelNames, name]);
  };

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-2'>
        {allowAddModel && (
          <button onClick={() => setAddVisible(true)} className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>
            {t('添加模型')}
          </button>
        )}
        <button onClick={handleSubmit} disabled={loading} className='inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'>
          {t('应用更改')}
        </button>
        <button disabled={!selectedModel || selectedModelNames.length === 0} onClick={() => setBatchVisible(true)}
          className='inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover disabled:opacity-40'>
          {t('批量应用当前模型价格')}{selectedModelNames.length > 0 ? ` (${selectedModelNames.length})` : ''}
        </button>
        <div className='relative flex-1 min-w-[180px] max-w-[220px]'>
          <input type='text' value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t('搜索模型名称')}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40' />
        </div>
        {showConflictFilter && (
          <label className='flex items-center gap-1.5 text-xs text-ui-text-2 cursor-pointer'>
            <input type='checkbox' checked={conflictOnly} onChange={(e) => setConflictOnly(e.target.checked)} className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
            {t('仅显示未设置价格')}
          </label>
        )}
      </div>

      {listDescription && <div className='text-xs text-ui-text-3'>{listDescription}</div>}

      {selectedModelNames.length > 0 && (
        <div className='px-3 py-2 rounded-md border border-blue-500/30 bg-blue-500/5 text-xs font-semibold text-blue-600 dark:text-blue-400'>
          {t('已勾选 {{count}} 个模型', { count: selectedModelNames.length })}
        </div>
      )}

      {/* Main grid */}
      <div className='grid gap-4 lg:grid-cols-[minmax(360px,1.1fr)_minmax(420px,1fr)]'>
        {/* Table */}
        <div className='rounded-md border border-ui-border overflow-hidden order-2 lg:order-1'>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='bg-ui-bg-subtle'>
                  <th className='w-9 px-3 py-2 text-left'>
                    <input type='checkbox' checked={allSelected} onChange={toggleAll} className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
                  </th>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('模型名称')}</th>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('价格摘要')}</th>
                  {allowDeleteModel && <th className='w-10'></th>}
                </tr>
              </thead>
              <tbody className='divide-y divide-ui-divider'>
                {pagedData.length === 0 ? (
                  <tr><td colSpan={4} className='px-3 py-8 text-center text-ui-text-3'>{emptyTitle || t('暂无模型')}</td></tr>
                ) : pagedData.map((record) => {
                  const isSelected = selectedModelNames.includes(record.name);
                  const isActive = record.name === selectedModelName;
                  return (
                    <tr key={record.name} onClick={() => setSelectedModelName(record.name)}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-blue-500/5' : 'hover:bg-ui-bg-hover/50'} ${isSelected ? 'bg-emerald-500/5' : ''}`}
                      style={{ borderLeft: isSelected ? '3px solid rgb(16,185,129)' : isActive ? '3px solid rgb(59,130,246)' : '3px solid transparent' }}>
                      <td className='px-3 py-2'>
                        <input type='checkbox' checked={isSelected} onChange={() => toggleRow(record.name)} onClick={(e) => e.stopPropagation()} className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
                      </td>
                      <td className='px-3 py-2'>
                        <div className='flex items-center gap-1.5'>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedModelName(record.name); }}
                            className={`text-xs hover:underline bg-transparent border-none p-0 cursor-pointer ${isActive ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-ui-text'}`}>
                            {record.name}
                          </button>
                          {isSelected && <MiniTag color='green'>{t('已勾选')}</MiniTag>}
                        </div>
                      </td>
                      <td className='px-3 py-2 text-ui-text-2'>{buildSummaryText(record, t)}</td>
                      {allowDeleteModel && (
                        <td className='px-3 py-2'>
                          <button onClick={(e) => { e.stopPropagation(); deleteModel(record.name); }}
                            className='p-1 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'>
                            </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredModels.length > PAGE_SIZE && (
            <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filteredModels.length} onChange={setCurrentPage} />
          )}
        </div>

        {/* Editor panel */}
        <div className='rounded-md border border-ui-border order-1 lg:order-2'>
          <div className='px-4 py-3 border-b border-ui-divider'>
            <div className='text-sm font-semibold text-ui-text'>{selectedModel ? selectedModel.name : t('模型计费编辑器')}</div>
          </div>
          <div className='p-4'>
            {!selectedModel ? (
              <div className='text-center py-8 text-ui-text-3 text-xs'>
                {emptyTitle || t('暂无模型')}
                <div className='mt-1'>{emptyDescription || t('请先新增模型或从左侧列表选择一个模型')}</div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='text-[11px] text-ui-text-3'>{t('这个界面默认按价格填写，保存时会自动换算回后端需要的倍率 JSON。')}</div>

                {selectedWarnings.length > 0 && (
                  <Notice kind='warning'><div className='space-y-1'>{selectedWarnings.map((w) => <div key={w}>{w}</div>)}</div></Notice>
                )}

                {/* Base pricing */}
                <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3 space-y-1'>
                  <div className='text-xs font-semibold text-ui-text mb-2'>{t('基础价格')}</div>
                  <PriceInput label={t('输入价格')} value={selectedModel.inputPrice} placeholder={t('输入 $/1M tokens')}
                    onChange={(v) => handleNumericFieldChange('inputPrice', v)} />
                  {selectedModel.completionRatioLocked && (
                    <Notice kind='warning'>{t('该模型补全倍率由后端固定为 {{ratio}}。', { ratio: selectedModel.lockedCompletionRatio || '-' })}</Notice>
                  )}
                  <PriceInput label={t('补全价格')} value={selectedModel.completionPrice} placeholder={t('输入 $/1M tokens')}
                    onChange={(v) => handleNumericFieldChange('completionPrice', v)}
                    headerAction={<ToggleSmall checked={isOptionalFieldEnabled(selectedModel, 'completionPrice')} disabled={selectedModel.completionRatioLocked} onChange={(c) => handleOptionalFieldToggle('completionPrice', c)} />}
                    hidden={!isOptionalFieldEnabled(selectedModel, 'completionPrice')}
                    disabled={!hasValue(selectedModel.inputPrice) || selectedModel.completionRatioLocked}
                    extraText={!isOptionalFieldEnabled(selectedModel, 'completionPrice') ? t('当前未启用，需要时再打开即可。') : ''} />
                  <PriceInput label={t('缓存读取价格')} value={selectedModel.cachePrice} placeholder={t('输入 $/1M tokens')}
                    onChange={(v) => handleNumericFieldChange('cachePrice', v)}
                    headerAction={<ToggleSmall checked={isOptionalFieldEnabled(selectedModel, 'cachePrice')} onChange={(c) => handleOptionalFieldToggle('cachePrice', c)} />}
                    hidden={!isOptionalFieldEnabled(selectedModel, 'cachePrice')}
                    disabled={!hasValue(selectedModel.inputPrice)}
                    extraText={!isOptionalFieldEnabled(selectedModel, 'cachePrice') ? t('当前未启用，需要时再打开即可。') : ''} />
                  <PriceInput label={t('缓存创建价格')} value={selectedModel.createCachePrice} placeholder={t('输入 $/1M tokens')}
                    onChange={(v) => handleNumericFieldChange('createCachePrice', v)}
                    headerAction={<ToggleSmall checked={isOptionalFieldEnabled(selectedModel, 'createCachePrice')} onChange={(c) => handleOptionalFieldToggle('createCachePrice', c)} />}
                    hidden={!isOptionalFieldEnabled(selectedModel, 'createCachePrice')}
                    disabled={!hasValue(selectedModel.inputPrice)}
                    extraText={!isOptionalFieldEnabled(selectedModel, 'createCachePrice') ? t('当前未启用，需要时再打开即可。') : ''} />
                  <PriceInput label={t('图片输入价格')} value={selectedModel.imagePrice} placeholder={t('输入 $/1M tokens')}
                    onChange={(v) => handleNumericFieldChange('imagePrice', v)}
                    headerAction={<ToggleSmall checked={isOptionalFieldEnabled(selectedModel, 'imagePrice')} onChange={(c) => handleOptionalFieldToggle('imagePrice', c)} />}
                    hidden={!isOptionalFieldEnabled(selectedModel, 'imagePrice')}
                    disabled={!hasValue(selectedModel.inputPrice)}
                    extraText={!isOptionalFieldEnabled(selectedModel, 'imagePrice') ? t('当前未启用，需要时再打开即可。') : ''} />
                </div>

                {/* Preview */}
                <div className='rounded-md border border-ui-border bg-ui-bg-subtle p-3'>
                  <div className='text-xs font-semibold text-ui-text mb-2'>{t('保存预览')}</div>
                  <div className='text-[11px] text-ui-text-3 mb-3'>{t('下面展示这个模型保存后会写入哪些后端字段。')}</div>
                  <div className='grid grid-cols-[minmax(140px,180px)_1fr] gap-1'>
                    {previewRows.map((row) => (
                      <React.Fragment key={row.key}>
                        <span className='text-xs font-semibold text-ui-text-2'>{row.label}</span>
                        <span className='text-xs text-ui-text'>{row.value}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add model modal */}
      {allowAddModel && (
        <ModalDialog open={addVisible} onClose={() => { setAddVisible(false); setNewModelName(''); }} title={t('添加模型')} width={400}
          footer={
            <div className='flex justify-end gap-2'>
              <button onClick={() => { setAddVisible(false); setNewModelName(''); }} className='px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'>{t('取消')}</button>
              <button onClick={handleAddModel} className='px-3.5 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('确定')}</button>
            </div>
          }>
          <input type='text' value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder={t('输入模型名称，例如 gpt-4.1')} className={inputCls} onKeyDown={(e) => e.key === 'Enter' && handleAddModel()} />
        </ModalDialog>
      )}

      {/* Batch apply modal */}
      <ModalDialog open={batchVisible} onClose={() => setBatchVisible(false)} title={t('批量应用当前模型价格')} width={500}
        footer={
          <div className='flex justify-end gap-2'>
            <button onClick={() => setBatchVisible(false)} className='px-3.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'>{t('取消')}</button>
            <button onClick={() => { if (applySelectedModelPricing()) setBatchVisible(false); }} className='px-3.5 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('确定')}</button>
          </div>
        }>
        <div className='text-xs text-ui-text-2'>
          {selectedModel
            ? t('将把当前编辑中的模型 {{name}} 的价格配置，批量应用到已勾选的 {{count}} 个模型。', { name: selectedModel.name, count: selectedModelNames.length })
            : t('请先选择一个作为模板的模型')}
        </div>
      </ModalDialog>
    </div>
  );
}
