import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  NumberInput,
  Pagination,
  Select,
  Switch,
} from '../../components/ui';

const TOKEN_BILLING = 0;
const REQUEST_BILLING = 1;
const DEFAULT_PAGE_SIZE = 10;
let nextLocalPricingKey = 0;

export const MODEL_PRICING_REQUEST_CONFIG = Object.freeze({ skipErrorHandler: true });
export const MODEL_PRICING_ROWS_STYLE = Object.freeze({
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
});
export const MODEL_PRICING_ROW_STYLE = Object.freeze({ minWidth: 720 });

const PRICING_DEFAULTS = Object.freeze({
  id: 0,
  model_name: '',
  billing_type: TOKEN_BILLING,
  input_price: 0,
  output_price: 0,
  cache_read_price: 0,
  cache_write_price: 0,
  image_price: 0,
  audio_input_price: 0,
  audio_output_price: 0,
  request_price: 0,
  enabled: true,
});

export const createBlankPricingRow = () => ({
  ...PRICING_DEFAULTS,
  _new: true,
  _dirty: true,
  _key: `local-${++nextLocalPricingKey}`,
});

const tokenFields = [
  ['input_price', '输入'],
  ['output_price', '输出'],
  ['cache_read_price', '缓存读'],
  ['cache_write_price', '缓存写'],
  ['image_price', '图像'],
  ['audio_input_price', '音频输入'],
  ['audio_output_price', '音频输出'],
];

const PriceField = ({ label, value, onChange }) => (
  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
    <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>{label} · USD / 1M</span>
    <NumberInput value={value} min={0} step='0.000001' onChange={onChange} width='100%' />
  </label>
);

export const getBillingTypeOptions = (billingType) => {
  const options = [
    { value: TOKEN_BILLING, label: '按量' },
    { value: REQUEST_BILLING, label: '按次' },
  ];
  const value = Number(billingType);
  if (value === TOKEN_BILLING || value === REQUEST_BILLING) return options;
  return [{ value, label: `无效类型 (${billingType})` }, ...options];
};

export const normalizePricingRow = (row) => ({
  ...PRICING_DEFAULTS,
  ...row,
  billing_type: row?.billing_type === undefined || row?.billing_type === null
    ? TOKEN_BILLING
    : Number(row.billing_type),
  enabled: row?.enabled !== false,
  _new: false,
  _dirty: false,
  _key: row?._key || `server-${row?.id}`,
});

const getModelName = (item) => (
  typeof item === 'string' ? item : item?.model_name || item?.value || item?.label || ''
);

export const mergePricingRowsWithModels = (rows, models) => {
  const merged = [...rows];
  const existingNames = new Set(
    rows.map((row) => String(row?.model_name || '').trim()).filter(Boolean),
  );
  const modelNames = Array.from(new Set(
    (models || []).map(getModelName).map((name) => String(name).trim()).filter(Boolean),
  )).sort();

  modelNames.forEach((modelName) => {
    if (existingNames.has(modelName)) return;
    merged.push({
      ...normalizePricingRow({ model_name: modelName }),
      _key: `suggested-${modelName}`,
      _new: true,
      _dirty: false,
    });
  });
  return merged;
};

export const replacePricingRow = (rows, rowKey, savedRow) => rows.map((row) => (
  row._key === rowKey ? { ...normalizePricingRow(savedRow), _key: rowKey } : row
));

export const removePricingRow = (rows, rowKey) => rows.filter((row) => row._key !== rowKey);

export const getModelPricingPageCount = (total, pageSize) => (
  Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
);

export const clampModelPricingPage = (page, total, pageSize) => (
  Math.min(Math.max(1, Number(page) || 1), getModelPricingPageCount(total, pageSize))
);

export const getModelPricingPageRows = (rows, page, pageSize) => {
  const safePage = clampModelPricingPage(page, rows.length, pageSize);
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
};

export const getDefaultModelPricingSyncSelection = (preview) => (
  (preview || []).filter((item) => item.status === 'new' || item.status === 'description').map((item) => item.model_name)
);

export const buildModelPricingSyncPayload = (preview, selectedModels) => {
  const available = new Set((preview || []).map((item) => item.model_name));
  return {
    model_names: Array.from(new Set(selectedModels || [])).filter((name) => available.has(name)),
  };
};

export const getModelPricingErrorMessage = (error, fallback) => (
  error?.response?.data?.message || error?.message || fallback
);

export const toModelPricingPayload = (row) => {
  const payload = {
    ...row,
    model_name: row.model_name.trim(),
    billing_type: Number(row.billing_type),
  };
  delete payload._key;
  delete payload._new;
  delete payload._dirty;
  return payload;
};

const ModelPricingEditor = ({ modelSuggestions = [] }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncPreview, setSyncPreview] = useState([]);
  const [selectedSyncModels, setSelectedSyncModels] = useState([]);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const suggestionNames = useMemo(
    () => Array.from(new Set((modelSuggestions || []).map(getModelName).filter(Boolean))).sort(),
    [modelSuggestions],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/model-pricing', MODEL_PRICING_REQUEST_CONFIG);
      if (!data.success) {
        showError(data.message || '加载模型价格失败');
        return;
      }
      setRows(mergePricingRowsWithModels((data.data || []).map(normalizePricingRow), suggestionNames));
    } catch (error) {
      showError(getModelPricingErrorMessage(error, '加载模型价格失败'));
    } finally {
      setLoading(false);
    }
  }, [suggestionNames]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPage((current) => clampModelPricingPage(current, rows.length, pageSize));
  }, [rows.length, pageSize]);

  const visibleRows = useMemo(
    () => getModelPricingPageRows(rows, page, pageSize),
    [rows, page, pageSize],
  );

  const update = (rowKey, key, value) => {
    setRows((current) => current.map((row) => (
      row._key === rowKey ? { ...row, [key]: value, _dirty: true } : row
    )));
  };

  const add = () => {
    setRows((current) => [createBlankPricingRow(), ...current]);
    setPage(1);
  };

  const previewUpstreamSync = async () => {
    setSyncLoading(true);
    try {
      const { data } = await API.post('/api/model-pricing/sync/preview', {}, MODEL_PRICING_REQUEST_CONFIG);
      if (!data.success) {
        showError(data.message || '获取上游模型价格失败');
        return;
      }
      const preview = data.data || [];
      if (preview.length === 0) {
        showSuccess('模型价格已是最新');
        return;
      }
      setSyncPreview(preview);
      setSelectedSyncModels(getDefaultModelPricingSyncSelection(preview));
      setSyncModalOpen(true);
    } catch (error) {
      showError(getModelPricingErrorMessage(error, '获取上游模型价格失败'));
    } finally {
      setSyncLoading(false);
    }
  };

  const toggleSyncModel = (modelName, checked) => {
    setSelectedSyncModels((current) => (
      checked
        ? Array.from(new Set([...current, modelName]))
        : current.filter((name) => name !== modelName)
    ));
  };

  const applyUpstreamSync = async () => {
    const payload = buildModelPricingSyncPayload(syncPreview, selectedSyncModels);
    if (payload.model_names.length === 0) {
      showError('请选择需要同步的模型');
      return;
    }
    setSyncLoading(true);
    try {
      const { data } = await API.post('/api/model-pricing/sync/apply', payload, MODEL_PRICING_REQUEST_CONFIG);
      if (!data.success) {
        showError(data.message || '同步上游模型价格失败');
        return;
      }
      setSyncModalOpen(false);
      showSuccess(`已同步 ${data.data?.saved || payload.model_names.length} 个模型价格`);
      await load();
    } catch (error) {
      showError(getModelPricingErrorMessage(error, '同步上游模型价格失败'));
    } finally {
      setSyncLoading(false);
    }
  };

  const save = async (rowKey) => {
    const row = rows.find((item) => item._key === rowKey);
    if (!row?.model_name?.trim()) {
      showError('请输入模型名称');
      return;
    }
    setSavingId(rowKey);
    try {
      const payload = toModelPricingPayload(row);
      const { data } = await API.post('/api/model-pricing', payload, MODEL_PRICING_REQUEST_CONFIG);
      if (!data.success) {
        showError(data.message || '保存模型价格失败');
        return;
      }
      setRows((current) => replacePricingRow(current, rowKey, data.data));
      showSuccess('模型价格已保存');
    } catch (error) {
      showError(getModelPricingErrorMessage(error, '保存模型价格失败'));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (rowKey) => {
    const row = rows.find((item) => item._key === rowKey);
    if (!row) return;
    if (row._new || !row.id) {
      setRows((current) => removePricingRow(current, rowKey));
      return;
    }
    try {
      const { data } = await API.delete(`/api/model-pricing/${row.id}`, MODEL_PRICING_REQUEST_CONFIG);
      if (!data.success) {
        showError(data.message || '删除模型价格失败');
        return;
      }
      showSuccess('模型价格已删除');
      setRows((current) => removePricingRow(current, rowKey));
    } catch (error) {
      showError(getModelPricingErrorMessage(error, '删除模型价格失败'));
    }
  };

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <datalist id='model-pricing-suggestions'>
        {suggestionNames.map((name) => <option key={name} value={name} />)}
      </datalist>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text)' }}>模型原价</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--ui-text-3)' }}>按量价格单位为 USD / 1M tokens；按次价格单位为 USD / 次。分组倍率在下方统一应用。</div>
        </div>
        <div className='flex items-center gap-2'>
          <Button size='sm' variant='secondary' icon={RefreshCw} loading={syncLoading} onClick={previewUpstreamSync}>同步上游价格</Button>
          <Button size='sm' variant='secondary' icon={RefreshCw} loading={loading} onClick={load}>刷新</Button>
          <Button size='sm' icon={Plus} onClick={add}>新增价格</Button>
        </div>
      </div>

      {!loading && rows.length === 0 && (
        <div style={{ padding: '34px 16px', textAlign: 'center', color: 'var(--ui-text-3)', borderTop: '1px solid var(--ui-border)', borderBottom: '1px solid var(--ui-border)' }}>
          尚未配置模型价格
        </div>
      )}

      <div style={MODEL_PRICING_ROWS_STYLE}>
        <div style={{ display: 'grid' }}>
          {visibleRows.map((row) => {
            const saving = savingId === row._key;
            return (
              <div key={row._key} style={{ ...MODEL_PRICING_ROW_STYLE, padding: '17px 0', borderTop: '1px solid var(--ui-border)', display: 'grid', gap: 13 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(130px, 170px) auto auto', gap: 12, alignItems: 'end' }}>
                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>模型名称（支持前后 * 通配）</span>
                    <Input value={row.model_name} list='model-pricing-suggestions' onChange={(value) => update(row._key, 'model_name', value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>计费方式</span>
                    <Select
                      value={Number(row.billing_type)}
                      options={getBillingTypeOptions(row.billing_type)}
                      onChange={(value) => update(row._key, 'billing_type', Number(value))}
                    />
                  </label>
                  <label className='flex items-center gap-2' style={{ height: 36, color: 'var(--ui-text-2)', fontSize: 13 }}>
                    <Switch size='sm' checked={row.enabled} onChange={(value) => update(row._key, 'enabled', value)} aria-label='启用模型价格' />
                    启用
                  </label>
                  <div className='flex items-center gap-2' style={{ height: 36 }}>
                    <Button size='sm' icon={Save} loading={saving} disabled={!row._dirty} onClick={() => save(row._key)}>保存</Button>
                    <Button size='sm' variant='secondary' icon={Trash2} onClick={() => remove(row._key)}>删除</Button>
                  </div>
                </div>

                {Number(row.billing_type) === REQUEST_BILLING ? (
                  <div style={{ maxWidth: 260 }}>
                    <label style={{ display: 'grid', gap: 5 }}>
                      <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>每次请求 · USD / 次</span>
                      <NumberInput value={row.request_price} min={0} step='0.000001' onChange={(value) => update(row._key, 'request_price', value)} width='100%' />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
                    {tokenFields.map(([key, label]) => (
                      <PriceField key={key} label={label} value={row[key]} onChange={(value) => update(row._key, key, value)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {rows.length > 0 && (
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Select
            value={pageSize}
            options={[
              { value: 10, label: '每页 10 条' },
              { value: 20, label: '每页 20 条' },
              { value: 50, label: '每页 50 条' },
            ]}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          />
          <div style={{ minWidth: 260 }}>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onChange={setPage} />
          </div>
        </div>
      )}

      <Modal
        open={syncModalOpen}
        onClose={() => !syncLoading && setSyncModalOpen(false)}
        title='同步上游价格'
        width={760}
        footer={(
          <>
            <Button variant='secondary' disabled={syncLoading} onClick={() => setSyncModalOpen(false)}>取消</Button>
            <Button loading={syncLoading} disabled={selectedSyncModels.length === 0} onClick={applyUpstreamSync}>
              同步选中模型
            </Button>
          </>
        )}
      >
        <div style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>
          新增价格已默认选中；已有价格发生变化时，请确认后手动勾选。来源：models.dev
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {syncPreview.map((item) => {
            const selected = selectedSyncModels.includes(item.model_name);
            const local = item.local;
            const upstream = item.upstream;
            const priceText = (price) => (
              price
                ? `输入 $${price.input_price} · 输出 $${price.output_price} · 缓存读 $${price.cache_read_price} · 缓存写 $${price.cache_write_price}`
                : '尚未配置'
            );
            return (
              <div key={item.model_name} style={{ padding: '12px 0', borderTop: '1px solid var(--ui-border)', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 12 }}>
                <Checkbox checked={selected} onChange={(checked) => toggleSyncModel(item.model_name, checked)} aria-label={`同步 ${item.model_name}`} />
                <div style={{ minWidth: 0 }}>
                  <div className='flex flex-wrap items-center gap-2'>
                    <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{item.model_name}</strong>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>{item.provider}</span>
                    <span style={{ fontSize: 11, color: item.status === 'new' ? 'var(--ui-success)' : 'var(--ui-warning)' }}>
                      {item.status === 'new' ? '新增' : '价格变化'}
                    </span>
                  </div>
                  <div style={{ marginTop: 7, display: 'grid', gap: 4, fontSize: 12, color: 'var(--ui-text-2)' }}>
                    <div>当前：{priceText(local)}</div>
                    <div>上游：{priceText(upstream)}</div>
                    {item.description && (
                      <div>
                        介绍：{item.description_action === 'preserve' ? '保留本地介绍' : '将补充上游介绍'}
                        <span style={{ marginLeft: 6, color: 'var(--ui-text-3)' }}>{item.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </section>
  );
};

export default ModelPricingEditor;
