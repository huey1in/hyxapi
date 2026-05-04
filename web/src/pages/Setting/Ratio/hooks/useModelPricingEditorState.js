import { useEffect, useMemo, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';

export const PAGE_SIZE = 10;
export const PRICE_SUFFIX = '$/1M tokens';

const EMPTY_MODEL = {
  name: '',
  inputPrice: '',
  completionPrice: '',
  lockedCompletionRatio: '',
  completionRatioLocked: false,
  cachePrice: '',
  createCachePrice: '',
  imagePrice: '',
  rawRatios: {
    modelRatio: '',
    completionRatio: '',
    cacheRatio: '',
    createCacheRatio: '',
    imageRatio: '',
  },
};

const NUMERIC_INPUT_REGEX = /^(\d+(\.\d*)?|\.\d*)?$/;

export const hasValue = (value) =>
  value !== '' && value !== null && value !== undefined && value !== false;

const toNumericString = (value) => {
  if (!hasValue(value) && value !== 0) return '';
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '';
};

const toNumberOrNull = (value) => {
  if (!hasValue(value) && value !== 0) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (value) => {
  const num = toNumberOrNull(value);
  if (num === null) return '';
  return parseFloat(num.toFixed(12)).toString();
};

const toNormalizedNumber = (value) => {
  const formatted = formatNumber(value);
  return formatted === '' ? null : Number(formatted);
};

const parseOptionJSON = (rawValue) => {
  if (!rawValue || rawValue.trim() === '') return {};
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const ratioToBasePrice = (ratio) => {
  const num = toNumberOrNull(ratio);
  if (num === null) return '';
  return formatNumber(num * 2);
};

const normalizeCompletionRatioMeta = (rawMeta) => {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
    return { locked: false, ratio: '' };
  }
  return { locked: Boolean(rawMeta.locked), ratio: toNumericString(rawMeta.ratio) };
};

const buildModelState = (name, sourceMaps) => {
  const modelRatio = toNumericString(sourceMaps.ModelRatio[name]);
  const completionRatio = toNumericString(sourceMaps.CompletionRatio[name]);
  const completionRatioMeta = normalizeCompletionRatioMeta(sourceMaps.CompletionRatioMeta?.[name]);
  const cacheRatio = toNumericString(sourceMaps.CacheRatio[name]);
  const createCacheRatio = toNumericString(sourceMaps.CreateCacheRatio[name]);
  const imageRatio = toNumericString(sourceMaps.ImageRatio[name]);
  const inputPrice = ratioToBasePrice(modelRatio);
  const inputPriceNumber = toNumberOrNull(inputPrice);

  return {
    ...EMPTY_MODEL,
    name,
    inputPrice,
    completionRatioLocked: completionRatioMeta.locked,
    lockedCompletionRatio: completionRatioMeta.ratio,
    completionPrice:
      inputPriceNumber !== null &&
      hasValue(completionRatioMeta.locked ? completionRatioMeta.ratio : completionRatio)
        ? formatNumber(inputPriceNumber * Number(completionRatioMeta.locked ? completionRatioMeta.ratio : completionRatio))
        : '',
    cachePrice: inputPriceNumber !== null && hasValue(cacheRatio) ? formatNumber(inputPriceNumber * Number(cacheRatio)) : '',
    createCachePrice: inputPriceNumber !== null && hasValue(createCacheRatio) ? formatNumber(inputPriceNumber * Number(createCacheRatio)) : '',
    imagePrice: inputPriceNumber !== null && hasValue(imageRatio) ? formatNumber(inputPriceNumber * Number(imageRatio)) : '',
    rawRatios: { modelRatio, completionRatio, cacheRatio, createCacheRatio, imageRatio },
  };
};

export const getModelWarnings = (model, t) => {
  if (!model) return [];
  const warnings = [];

  if (!hasValue(model.inputPrice) && [
    model.rawRatios.completionRatio,
    model.rawRatios.cacheRatio,
    model.rawRatios.createCacheRatio,
    model.rawRatios.imageRatio,
  ].some(hasValue)) {
    warnings.push(t('当前模型存在未显式设置输入倍率的扩展倍率；填写输入价格后会自动换算为价格字段。'));
  }

  if ([model.completionPrice, model.cachePrice, model.createCachePrice, model.imagePrice].some(hasValue) && !hasValue(model.inputPrice)) {
    warnings.push(t('需要先填写输入价格，才能保存其它价格项。'));
  }

  return warnings;
};

export const buildSummaryText = (model, t) => {
  if (hasValue(model.inputPrice)) {
    const extraCount = [model.completionPrice, model.cachePrice, model.createCachePrice, model.imagePrice].filter(hasValue).length;
    const extraLabel = extraCount > 0 ? `，${t('额外价格项')} ${extraCount}` : '';
    return `${t('输入')} $${model.inputPrice}${extraLabel}`;
  }
  return t('未设置价格');
};

export const buildOptionalFieldToggles = (model) => ({
  completionPrice: model.completionRatioLocked || hasValue(model.completionPrice),
  cachePrice: hasValue(model.cachePrice),
  createCachePrice: hasValue(model.createCachePrice),
  imagePrice: hasValue(model.imagePrice),
});

const serializeModel = (model, t) => {
  const result = {
    ModelRatio: null,
    CompletionRatio: null,
    CacheRatio: null,
    CreateCacheRatio: null,
    ImageRatio: null,
  };

  const inputPrice = toNumberOrNull(model.inputPrice);
  const completionPrice = toNumberOrNull(model.completionPrice);
  const cachePrice = toNumberOrNull(model.cachePrice);
  const createCachePrice = toNumberOrNull(model.createCachePrice);
  const imagePrice = toNumberOrNull(model.imagePrice);

  const hasDependentPrice = [completionPrice, cachePrice, createCachePrice, imagePrice].some((v) => v !== null);

  if (inputPrice === null) {
    if (hasDependentPrice) {
      throw new Error(t('模型 {{name}} 缺少输入价格，无法计算补全/缓存/图片价格对应的倍率', { name: model.name }));
    }
    if (hasValue(model.rawRatios.modelRatio)) result.ModelRatio = toNormalizedNumber(model.rawRatios.modelRatio);
    if (hasValue(model.rawRatios.completionRatio)) result.CompletionRatio = toNormalizedNumber(model.rawRatios.completionRatio);
    if (hasValue(model.rawRatios.cacheRatio)) result.CacheRatio = toNormalizedNumber(model.rawRatios.cacheRatio);
    if (hasValue(model.rawRatios.createCacheRatio)) result.CreateCacheRatio = toNormalizedNumber(model.rawRatios.createCacheRatio);
    if (hasValue(model.rawRatios.imageRatio)) result.ImageRatio = toNormalizedNumber(model.rawRatios.imageRatio);
    return result;
  }

  result.ModelRatio = toNormalizedNumber(inputPrice / 2);
  if (!model.completionRatioLocked && completionPrice !== null) {
    result.CompletionRatio = toNormalizedNumber(completionPrice / inputPrice);
  } else if (model.completionRatioLocked && hasValue(model.rawRatios.completionRatio)) {
    result.CompletionRatio = toNormalizedNumber(model.rawRatios.completionRatio);
  }
  if (cachePrice !== null) result.CacheRatio = toNormalizedNumber(cachePrice / inputPrice);
  if (createCachePrice !== null) result.CreateCacheRatio = toNormalizedNumber(createCachePrice / inputPrice);
  if (imagePrice !== null) result.ImageRatio = toNormalizedNumber(imagePrice / inputPrice);

  return result;
};

export const buildPreviewRows = (model, t) => {
  if (!model) return [];

  const inputPrice = toNumberOrNull(model.inputPrice);
  if (inputPrice === null) {
    return [
      { key: 'ModelRatio', label: 'ModelRatio', value: hasValue(model.rawRatios.modelRatio) ? model.rawRatios.modelRatio : t('空') },
      { key: 'CompletionRatio', label: 'CompletionRatio', value: hasValue(model.rawRatios.completionRatio) ? model.rawRatios.completionRatio : t('空') },
      { key: 'CacheRatio', label: 'CacheRatio', value: hasValue(model.rawRatios.cacheRatio) ? model.rawRatios.cacheRatio : t('空') },
      { key: 'CreateCacheRatio', label: 'CreateCacheRatio', value: hasValue(model.rawRatios.createCacheRatio) ? model.rawRatios.createCacheRatio : t('空') },
      { key: 'ImageRatio', label: 'ImageRatio', value: hasValue(model.rawRatios.imageRatio) ? model.rawRatios.imageRatio : t('空') },
    ];
  }

  const completionPrice = toNumberOrNull(model.completionPrice);
  const cachePrice = toNumberOrNull(model.cachePrice);
  const createCachePrice = toNumberOrNull(model.createCachePrice);
  const imagePrice = toNumberOrNull(model.imagePrice);

  return [
    { key: 'ModelRatio', label: 'ModelRatio', value: formatNumber(inputPrice / 2) },
    {
      key: 'CompletionRatio', label: 'CompletionRatio',
      value: model.completionRatioLocked
        ? `${model.lockedCompletionRatio || t('空')} (${t('后端固定')})`
        : completionPrice !== null ? formatNumber(completionPrice / inputPrice) : t('空'),
    },
    { key: 'CacheRatio', label: 'CacheRatio', value: cachePrice !== null ? formatNumber(cachePrice / inputPrice) : t('空') },
    { key: 'CreateCacheRatio', label: 'CreateCacheRatio', value: createCachePrice !== null ? formatNumber(createCachePrice / inputPrice) : t('空') },
    { key: 'ImageRatio', label: 'ImageRatio', value: imagePrice !== null ? formatNumber(imagePrice / inputPrice) : t('空') },
  ];
};

export function useModelPricingEditorState({ options, refresh, t }) {
  const [models, setModels] = useState([]);
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedModelNames, setSelectedModelNames] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflictOnly, setConflictOnly] = useState(false);
  const [optionalFieldToggles, setOptionalFieldToggles] = useState({});

  useEffect(() => {
    const sourceMaps = {
      ModelRatio: parseOptionJSON(options.ModelRatio),
      CompletionRatio: parseOptionJSON(options.CompletionRatio),
      CompletionRatioMeta: parseOptionJSON(options.CompletionRatioMeta),
      CacheRatio: parseOptionJSON(options.CacheRatio),
      CreateCacheRatio: parseOptionJSON(options.CreateCacheRatio),
      ImageRatio: parseOptionJSON(options.ImageRatio),
    };

    const names = new Set([
      ...Object.keys(sourceMaps.ModelRatio),
      ...Object.keys(sourceMaps.CompletionRatio),
      ...Object.keys(sourceMaps.CompletionRatioMeta),
      ...Object.keys(sourceMaps.CacheRatio),
      ...Object.keys(sourceMaps.CreateCacheRatio),
      ...Object.keys(sourceMaps.ImageRatio),
    ]);

    const nextModels = Array.from(names)
      .map((name) => buildModelState(name, sourceMaps))
      .sort((a, b) => a.name.localeCompare(b.name));

    setModels(nextModels);
    setOptionalFieldToggles(
      nextModels.reduce((acc, model) => {
        acc[model.name] = buildOptionalFieldToggles(model);
        return acc;
      }, {}),
    );
    setSelectedModelName((previous) => {
      if (previous && nextModels.some((model) => model.name === previous)) return previous;
      return nextModels[0]?.name || '';
    });
  }, [options]);

  const visibleModels = useMemo(() => models, [models]);

  const filteredModels = useMemo(() => {
    return visibleModels.filter((model) => {
      const keyword = searchText.trim().toLowerCase();
      const keywordMatch = keyword ? model.name.toLowerCase().includes(keyword) : true;
      const conflictMatch = conflictOnly ? !hasValue(model.inputPrice) : true;
      return keywordMatch && conflictMatch;
    });
  }, [conflictOnly, searchText, visibleModels]);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredModels.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredModels]);

  const selectedModel = useMemo(
    () => visibleModels.find((model) => model.name === selectedModelName) || null,
    [selectedModelName, visibleModels],
  );

  const selectedWarnings = useMemo(() => getModelWarnings(selectedModel, t), [selectedModel, t]);
  const previewRows = useMemo(() => buildPreviewRows(selectedModel, t), [selectedModel, t]);

  useEffect(() => { setCurrentPage(1); }, [searchText, conflictOnly]);

  useEffect(() => {
    setSelectedModelNames((previous) => previous.filter((name) => visibleModels.some((model) => model.name === name)));
  }, [visibleModels]);

  useEffect(() => {
    if (visibleModels.length === 0) { setSelectedModelName(''); return; }
    if (!visibleModels.some((model) => model.name === selectedModelName)) {
      setSelectedModelName(visibleModels[0].name);
    }
  }, [selectedModelName, visibleModels]);

  const upsertModel = (name, updater) => {
    setModels((previous) => previous.map((model) => {
      if (model.name !== name) return model;
      return typeof updater === 'function' ? updater(model) : updater;
    }));
  };

  const isOptionalFieldEnabled = (model, field) => {
    if (!model) return false;
    const modelToggles = optionalFieldToggles[model.name];
    if (modelToggles && typeof modelToggles[field] === 'boolean') return modelToggles[field];
    return buildOptionalFieldToggles(model)[field];
  };

  const updateOptionalFieldToggle = (modelName, field, checked) => {
    setOptionalFieldToggles((prev) => ({
      ...prev,
      [modelName]: { ...(prev[modelName] || {}), [field]: checked },
    }));
  };

  const handleOptionalFieldToggle = (field, checked) => {
    if (!selectedModel) return;
    updateOptionalFieldToggle(selectedModel.name, field, checked);
    if (checked) return;
    upsertModel(selectedModel.name, (model) => ({ ...model, [field]: '' }));
  };

  const fillDerivedPricesFromBase = (model, nextInputPrice) => {
    const baseNumber = toNumberOrNull(nextInputPrice);
    if (baseNumber === null) return model;
    return {
      ...model,
      completionPrice:
        model.completionRatioLocked && hasValue(model.lockedCompletionRatio)
          ? formatNumber(baseNumber * Number(model.lockedCompletionRatio))
          : !hasValue(model.completionPrice) && hasValue(model.rawRatios.completionRatio)
            ? formatNumber(baseNumber * Number(model.rawRatios.completionRatio))
            : model.completionPrice,
      cachePrice: !hasValue(model.cachePrice) && hasValue(model.rawRatios.cacheRatio)
        ? formatNumber(baseNumber * Number(model.rawRatios.cacheRatio)) : model.cachePrice,
      createCachePrice: !hasValue(model.createCachePrice) && hasValue(model.rawRatios.createCacheRatio)
        ? formatNumber(baseNumber * Number(model.rawRatios.createCacheRatio)) : model.createCachePrice,
      imagePrice: !hasValue(model.imagePrice) && hasValue(model.rawRatios.imageRatio)
        ? formatNumber(baseNumber * Number(model.rawRatios.imageRatio)) : model.imagePrice,
    };
  };

  const handleNumericFieldChange = (field, value) => {
    if (!selectedModel || !NUMERIC_INPUT_REGEX.test(value)) return;
    upsertModel(selectedModel.name, (model) => {
      const updatedModel = { ...model, [field]: value };
      if (field === 'inputPrice') return fillDerivedPricesFromBase(updatedModel, value);
      return updatedModel;
    });
  };

  const addModel = (modelName) => {
    const trimmedName = modelName.trim();
    if (!trimmedName) { showError(t('请输入模型名称')); return false; }
    if (models.some((model) => model.name === trimmedName)) { showError(t('模型名称已存在')); return false; }
    const nextModel = { ...EMPTY_MODEL, name: trimmedName, rawRatios: { ...EMPTY_MODEL.rawRatios } };
    setModels((previous) => [nextModel, ...previous]);
    setOptionalFieldToggles((prev) => ({ ...prev, [trimmedName]: buildOptionalFieldToggles(nextModel) }));
    setSelectedModelName(trimmedName);
    setCurrentPage(1);
    return true;
  };

  const deleteModel = (name) => {
    const nextModels = models.filter((model) => model.name !== name);
    setModels(nextModels);
    setOptionalFieldToggles((prev) => { const next = { ...prev }; delete next[name]; return next; });
    setSelectedModelNames((previous) => previous.filter((item) => item !== name));
    if (selectedModelName === name) setSelectedModelName(nextModels[0]?.name || '');
  };

  const applySelectedModelPricing = () => {
    if (!selectedModel) { showError(t('请先选择一个作为模板的模型')); return false; }
    if (selectedModelNames.length === 0) { showError(t('请先勾选需要批量设置的模型')); return false; }
    const sourceToggles = optionalFieldToggles[selectedModel.name] || {};
    setModels((previous) => previous.map((model) => {
      if (!selectedModelNames.includes(model.name)) return model;
      const nextModel = {
        ...model,
        inputPrice: selectedModel.inputPrice,
        completionPrice: selectedModel.completionPrice,
        cachePrice: selectedModel.cachePrice,
        createCachePrice: selectedModel.createCachePrice,
        imagePrice: selectedModel.imagePrice,
      };
      if (nextModel.completionRatioLocked && hasValue(nextModel.inputPrice) && hasValue(nextModel.lockedCompletionRatio)) {
        nextModel.completionPrice = formatNumber(Number(nextModel.inputPrice) * Number(nextModel.lockedCompletionRatio));
      }
      return nextModel;
    }));
    setOptionalFieldToggles((previous) => {
      const next = { ...previous };
      selectedModelNames.forEach((modelName) => {
        const targetModel = models.find((item) => item.name === modelName);
        next[modelName] = {
          completionPrice: targetModel?.completionRatioLocked ? true : Boolean(sourceToggles.completionPrice),
          cachePrice: Boolean(sourceToggles.cachePrice),
          createCachePrice: Boolean(sourceToggles.createCachePrice),
          imagePrice: Boolean(sourceToggles.imagePrice),
        };
      });
      return next;
    });
    showSuccess(t('已将模型 {{name}} 的价格配置批量应用到 {{count}} 个模型', { name: selectedModel.name, count: selectedModelNames.length }));
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const output = { ModelRatio: {}, CompletionRatio: {}, CacheRatio: {}, CreateCacheRatio: {}, ImageRatio: {} };
      for (const model of models) {
        const serialized = serializeModel(model, t);
        Object.entries(serialized).forEach(([key, value]) => {
          if (value !== null) output[key][model.name] = value;
        });
      }
      const requestQueue = Object.entries(output).map(([key, value]) =>
        API.put('/api/option/', { key, value: JSON.stringify(value, null, 2) }),
      );
      const results = await Promise.all(requestQueue);
      for (const res of results) {
        if (!res?.data?.success) throw new Error(res?.data?.message || t('保存失败，请重试'));
      }
      showSuccess(t('保存成功'));
      await refresh();
    } catch (error) {
      showError(error.message || t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return {
    models,
    selectedModel,
    selectedModelName,
    selectedModelNames,
    setSelectedModelName,
    setSelectedModelNames,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    loading,
    conflictOnly,
    setConflictOnly,
    filteredModels,
    pagedData,
    selectedWarnings,
    previewRows,
    isOptionalFieldEnabled,
    handleOptionalFieldToggle,
    handleNumericFieldChange,
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  };
}
