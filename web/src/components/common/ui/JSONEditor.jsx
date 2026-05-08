/*
 * JSON editor — token-system rewrite. Provides visual key/value editor and
 * raw textarea modes, plus a region editor variant for Vertex deployments.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';

const generateUniqueId = (() => {
  let counter = 0;
  return () => `kv_${counter++}`;
})();

const inputCls =
  'w-full px-2.5 py-1.5 text-xs bg-transparent border border-ui-border rounded-lg text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const JSONEditor = ({
  value = '',
  onChange,
  field,
  label,
  placeholder,
  extraText,
  extraFooter,
  template,
  templateLabel,
  editorType = 'keyValue',
  formApi = null,
  renderStringValueSuffix,
}) => {
  const { t } = useTranslation();

  const objectToKeyValueArray = useCallback((obj, prevPairs = []) => {
    if (!obj || typeof obj !== 'object') return [];
    const entries = Object.entries(obj);
    return entries.map(([key, val], index) => {
      const prev = prevPairs[index];
      const reuse = prev && prev.key === key;
      return { id: reuse ? prev.id : generateUniqueId(), key, value: val };
    });
  }, []);

  const keyValueArrayToObject = useCallback((arr) => {
    const out = {};
    arr.forEach((it) => {
      if (it.key) out[it.key] = it.value;
    });
    return out;
  }, []);

  const [keyValuePairs, setKeyValuePairs] = useState(() => {
    if (typeof value === 'string' && value.trim()) {
      try { return objectToKeyValueArray(JSON.parse(value)); } catch { return []; }
    }
    if (typeof value === 'object' && value !== null) return objectToKeyValueArray(value);
    return [];
  });
  const [manualText, setManualText] = useState(() => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
    return '';
  });
  const [editMode, setEditMode] = useState(() => {
    if (typeof value === 'string' && value.trim()) {
      try { return Object.keys(JSON.parse(value)).length > 10 ? 'manual' : 'visual'; }
      catch { return 'manual'; }
    }
    return 'visual';
  });
  const [jsonError, setJsonError] = useState('');

  const duplicateKeys = useMemo(() => {
    const cnt = {};
    const dup = new Set();
    keyValuePairs.forEach((p) => {
      if (p.key) {
        cnt[p.key] = (cnt[p.key] || 0) + 1;
        if (cnt[p.key] > 1) dup.add(p.key);
      }
    });
    return dup;
  }, [keyValuePairs]);

  useEffect(() => {
    try {
      let parsed = {};
      if (typeof value === 'string' && value.trim()) parsed = JSON.parse(value);
      else if (typeof value === 'object' && value !== null) parsed = value;
      const cur = keyValueArrayToObject(keyValuePairs);
      if (JSON.stringify(parsed) !== JSON.stringify(cur)) {
        setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
      }
      setJsonError('');
    } catch (error) {
      setJsonError(error.message);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editMode !== 'manual') {
      if (typeof value === 'string') setManualText(value);
      else if (value && typeof value === 'object') setManualText(JSON.stringify(value, null, 2));
      else setManualText('');
    }
  }, [value, editMode]);

  const handleVisualChange = useCallback(
    (newPairs) => {
      setKeyValuePairs(newPairs);
      const obj = keyValueArrayToObject(newPairs);
      const str = Object.keys(obj).length === 0 ? '' : JSON.stringify(obj, null, 2);
      setJsonError('');
      if (formApi && field) formApi.setValue(field, str);
      onChange?.(str);
    },
    [onChange, formApi, field, keyValueArrayToObject],
  );

  const handleManualChange = useCallback(
    (newValue) => {
      setManualText(newValue);
      if (newValue && newValue.trim()) {
        try {
          const parsed = JSON.parse(newValue);
          setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
          setJsonError('');
          onChange?.(newValue);
        } catch (error) {
          setJsonError(error.message);
        }
      } else {
        setKeyValuePairs([]);
        setJsonError('');
        onChange?.('');
      }
    },
    [onChange, objectToKeyValueArray, keyValuePairs],
  );

  const toggleEditMode = useCallback(() => {
    if (editMode === 'visual') {
      const obj = keyValueArrayToObject(keyValuePairs);
      setManualText(Object.keys(obj).length === 0 ? '' : JSON.stringify(obj, null, 2));
      setEditMode('manual');
    } else {
      try {
        let parsed = {};
        if (manualText && manualText.trim()) parsed = JSON.parse(manualText);
        else if (typeof value === 'string' && value.trim()) parsed = JSON.parse(value);
        else if (typeof value === 'object' && value !== null) parsed = value;
        setKeyValuePairs(objectToKeyValueArray(parsed, keyValuePairs));
        setJsonError('');
        setEditMode('visual');
      } catch (error) {
        setJsonError(error.message);
      }
    }
  }, [editMode, value, manualText, keyValuePairs, keyValueArrayToObject, objectToKeyValueArray]);

  const addKeyValue = useCallback(() => {
    const newPairs = [...keyValuePairs];
    const existingKeys = newPairs.map((p) => p.key);
    let counter = 1;
    let newKey = `field_${counter}`;
    while (existingKeys.includes(newKey)) {
      counter += 1;
      newKey = `field_${counter}`;
    }
    newPairs.push({ id: generateUniqueId(), key: newKey, value: '' });
    handleVisualChange(newPairs);
  }, [keyValuePairs, handleVisualChange]);

  const removeKeyValue = useCallback(
    (id) => {
      handleVisualChange(keyValuePairs.filter((p) => p.id !== id));
    },
    [keyValuePairs, handleVisualChange],
  );

  const updateKey = useCallback(
    (id, newKey) => {
      handleVisualChange(
        keyValuePairs.map((p) => (p.id === id ? { ...p, key: newKey } : p)),
      );
    },
    [keyValuePairs, handleVisualChange],
  );

  const updateValue = useCallback(
    (id, newValue) => {
      handleVisualChange(
        keyValuePairs.map((p) => (p.id === id ? { ...p, value: newValue } : p)),
      );
    },
    [keyValuePairs, handleVisualChange],
  );

  const fillTemplate = useCallback(() => {
    if (template) {
      const str = JSON.stringify(template, null, 2);
      if (formApi && field) formApi.setValue(field, str);
      setManualText(str);
      setKeyValuePairs(objectToKeyValueArray(template, keyValuePairs));
      onChange?.(str);
      setJsonError('');
    }
  }, [template, onChange, formApi, field, objectToKeyValueArray, keyValuePairs]);

  const renderValueInput = (pairId, pairKey, val) => {
    const valueType = typeof val;
    if (valueType === 'boolean') {
      return (
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => updateValue(pairId, !val)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              val ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full transition-transform shadow ${val ? 'translate-x-[14px]' : 'translate-x-0.5'}`}
              style={{ background: '#ffffff' }}
            />
          </button>
          <span className='text-[11px] text-ui-text-3'>{val ? 'true' : 'false'}</span>
        </div>
      );
    }
    if (valueType === 'number') {
      return (
        <input
          type='number'
          value={val}
          onChange={(e) => updateValue(pairId, Number(e.target.value))}
          placeholder={t('输入数字')}
          className={inputCls}
        />
      );
    }
    if (valueType === 'object' && val !== null) {
      return (
        <textarea
          rows={2}
          value={JSON.stringify(val, null, 2)}
          onChange={(e) => {
            const txt = e.target.value;
            try {
              const obj = txt.trim() ? JSON.parse(txt) : {};
              updateValue(pairId, obj);
            } catch {}
          }}
          placeholder={t('输入JSON对象')}
          className={`${inputCls} font-mono`}
        />
      );
    }
    const suffix = renderStringValueSuffix?.({ pairId, pairKey, value: val });
    return (
      <div className='relative'>
        <input
          type='text'
          placeholder={t('参数值')}
          value={String(val)}
          onChange={(e) => {
            const v = e.target.value;
            let conv = v;
            if (v === 'true') conv = true;
            else if (v === 'false') conv = false;
            else if (!isNaN(v) && v !== '') {
              const n = Number(v);
              if (Number.isInteger(n)) conv = n;
            }
            updateValue(pairId, conv);
          }}
          className={`${inputCls} ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && <span className='absolute right-1 top-1/2 -translate-y-1/2 flex items-center'>{suffix}</span>}
      </div>
    );
  };

  const renderKeyValueEditor = () => (
    <div className='space-y-1.5'>
      {duplicateKeys.size > 0 && (
        <div className='flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5'>
          <AlertTriangle size={14} className='text-amber-500 flex-shrink-0 mt-0.5' />
          <div className='text-xs text-ui-text-2'>
            <div className='font-semibold'>{t('存在重复的键名：')} {Array.from(duplicateKeys).join(', ')}</div>
            <div className='text-ui-text-3 text-[11px]'>{t('注意：JSON中重复的键只会保留最后一个同名键的值')}</div>
          </div>
        </div>
      )}
      {keyValuePairs.length === 0 && (
        <div className='text-center py-4 text-[11px] text-ui-text-3'>
          {t('暂无数据，点击下方按钮添加键值对')}
        </div>
      )}
      {keyValuePairs.map((pair, index) => {
        const isDup = duplicateKeys.has(pair.key);
        return (
          <div key={pair.id} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
            <div className='relative'>
              <input
                type='text'
                placeholder={t('键名')}
                value={pair.key}
                onChange={(e) => updateKey(pair.id, e.target.value)}
                className={`${inputCls} ${isDup ? 'border-amber-500/50' : ''} ${isDup ? 'pr-7' : ''}`}
              />
              {isDup && (
                <AlertTriangle
                  size={12}
                  className='absolute right-2 top-1/2 -translate-y-1/2 text-amber-500'
                  aria-label={t('重复的键名')}
                />
              )}
            </div>
            {renderValueInput(pair.id, pair.key, pair.value)}
            <button
              type='button'
              onClick={() => removeKeyValue(pair.id)}
              className='p-1.5 rounded text-ui-danger hover:bg-ui-danger-bg'
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
      <div className='pt-1.5 flex justify-center'>
        <button
          type='button'
          onClick={addKeyValue}
          className='inline-flex items-center gap-1 px-3 py-1 text-[11px] rounded-md border border-ui-border text-ui-brand hover:bg-ui-bg-subtle whitespace-nowrap'
        >
          <Plus size={12} />
          {t('添加键值对')}
        </button>
      </div>
    </div>
  );

  const renderRegionEditor = () => {
    const defaultPair = keyValuePairs.find((p) => p.key === 'default');
    const modelPairs = keyValuePairs.filter((p) => p.key !== 'default');
    return (
      <div className='space-y-3'>
        {duplicateKeys.size > 0 && (
          <div className='flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5'>
            <AlertTriangle size={14} className='text-amber-500 flex-shrink-0 mt-0.5' />
            <div className='text-xs text-ui-text-2'>
              <div className='font-semibold'>{t('存在重复的键名：')} {Array.from(duplicateKeys).join(', ')}</div>
            </div>
          </div>
        )}
        <div>
          <label className='block text-[11px] font-medium text-ui-text-2 mb-1'>{t('默认区域')}</label>
          <input
            type='text'
            placeholder={t('默认区域，如: us-central1')}
            value={defaultPair ? defaultPair.value : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (defaultPair) updateValue(defaultPair.id, v);
              else handleVisualChange([...keyValuePairs, { id: generateUniqueId(), key: 'default', value: v }]);
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className='block text-[11px] font-medium text-ui-text-2 mb-1'>{t('模型专用区域')}</label>
          <div className='space-y-1.5'>
            {modelPairs.map((p) => {
              const isDup = duplicateKeys.has(p.key);
              return (
                <div key={p.id} className='grid grid-cols-[1fr_1fr_auto] gap-2 items-center'>
                  <div className='relative'>
                    <input
                      type='text'
                      placeholder={t('模型名称')}
                      value={p.key}
                      onChange={(e) => updateKey(p.id, e.target.value)}
                      className={`${inputCls} ${isDup ? 'border-amber-500/50 pr-7' : ''}`}
                    />
                    {isDup && (
                      <AlertTriangle size={12} className='absolute right-2 top-1/2 -translate-y-1/2 text-amber-500' />
                    )}
                  </div>
                  <input
                    type='text'
                    placeholder={t('区域')}
                    value={p.value}
                    onChange={(e) => updateValue(p.id, e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type='button'
                    onClick={() => removeKeyValue(p.id)}
                    className='p-1.5 rounded text-ui-danger hover:bg-ui-danger-bg'
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
            <div className='pt-1 flex justify-center'>
              <button
                type='button'
                onClick={addKeyValue}
                className='inline-flex items-center gap-1 px-3 py-1 text-[11px] rounded-md border border-ui-border text-ui-brand hover:bg-ui-bg-subtle whitespace-nowrap'
              >
                <Plus size={12} />
                {t('添加模型区域')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasJsonError = jsonError && jsonError.trim() !== '';

  return (
    <div>
      {label && (
        <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{label}</label>
      )}
      <div className='border border-ui-border rounded-2xl overflow-hidden'>
        <div className='flex items-center justify-between px-3 py-2 border-b border-ui-border'>
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={() => editMode === 'manual' && toggleEditMode()}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                editMode === 'visual' ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3' : 'border border-transparent text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {t('可视化')}
            </button>
            <button
              type='button'
              onClick={() => editMode === 'visual' && toggleEditMode()}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                editMode === 'manual' ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3' : 'border border-transparent text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {t('手动编辑')}
            </button>
          </div>
          {template && templateLabel && (
            <button
              type='button'
              onClick={fillTemplate}
              className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
            >
              {templateLabel}
            </button>
          )}
        </div>
        <div className='p-3 space-y-2'>
          {hasJsonError && (
            <div className='flex items-start gap-2 px-3 py-2 rounded-md border border-ui-danger/30 bg-ui-danger-bg'>
              <AlertTriangle size={14} className='text-ui-danger flex-shrink-0 mt-0.5' />
              <div className='text-xs text-ui-danger'>JSON 格式错误: {jsonError}</div>
            </div>
          )}
          {editMode === 'visual' ? (
            editorType === 'region' ? renderRegionEditor() : renderKeyValueEditor()
          ) : (
            <textarea
              placeholder={placeholder}
              value={manualText}
              onChange={(e) => handleManualChange(e.target.value)}
              rows={Math.max(8, manualText ? manualText.split('\n').length : 8)}
              className={`${inputCls} font-mono`}
            />
          )}
          {extraText && (
            <div className='text-[11px] text-ui-text-3 text-center pt-2 border-t border-ui-divider'>
              {extraText}
            </div>
          )}
          {extraFooter}
        </div>
      </div>
    </div>
  );
};

export default JSONEditor;
