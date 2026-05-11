/*
 * 上游倍率同步 — token-system rewrite.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  API,
  showError,
  showSuccess,
  showWarning,
  stringToColor,
} from '../../../helpers';
import { DEFAULT_ENDPOINT } from '../../../constants';
import { useTranslation } from 'react-i18next';
import ChannelSelectorModal from '../../../components/settings/ChannelSelectorModal';
import ModalDialog from '../../../components/common/ModalDialog';
import Pagination from '../../../components/common/table/Pagination';
import { Button } from '../../../components/ui';
import { Notice } from '../../../components/common/form/Primitives';

const OFFICIAL_RATIO_PRESET_ID = -100;
const OFFICIAL_RATIO_PRESET_BASE_URL = 'https://basellm.github.io';
const OFFICIAL_RATIO_PRESET_ENDPOINT = '/llm-metadata/api/newapi/ratio_config-v1-base.json';
const MODELS_DEV_PRESET_ID = -101;
const MODELS_DEV_PRESET_BASE_URL = 'https://models.dev';
const MODELS_DEV_PRESET_ENDPOINT = 'https://models.dev/api.json';

const miniTag = 'inline-block text-[10px] px-1.5 py-0.5 rounded-full border font-medium';

const RATIO_TYPE_LABELS = {
  model_ratio: '模型倍率',
  completion_ratio: '补全倍率',
  cache_ratio: '缓存倍率',
  model_price: '固定价格',
};

function ConflictConfirmModal({ t, visible, items, onOk, onCancel }) {
  return (
    <ModalDialog
      open={visible}
      onClose={onCancel}
      title={t('确认冲突项修改')}
      width={700}
      footer={
        <div className='flex justify-end gap-2'>
          <Button variant='secondary' size='sm' onClick={onCancel}>{t('取消')}</Button>
          <Button size='sm' onClick={onOk}>{t('确定')}</Button>
        </div>
      }
    >
      <div className='rounded-md border border-ui-border overflow-hidden'>
        <table className='w-full text-xs'>
          <thead><tr className='bg-ui-bg-subtle'>
            <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('渠道')}</th>
            <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('模型')}</th>
            <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('当前计费')}</th>
            <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('修改为')}</th>
          </tr></thead>
          <tbody className='divide-y divide-ui-divider'>
            {items.map((item, i) => (
              <tr key={i} className='hover:bg-ui-bg-hover/50'>
                <td className='px-3 py-2'>{item.channel}</td>
                <td className='px-3 py-2 font-mono'>{item.model}</td>
                <td className='px-3 py-2 whitespace-pre text-ui-text-2'>{item.current}</td>
                <td className='px-3 py-2 whitespace-pre text-ui-text'>{item.newVal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalDialog>
  );
}

export default function UpstreamRatioSync(props) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [allChannels, setAllChannels] = useState([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState([]);
  const [channelEndpoints, setChannelEndpoints] = useState({});
  const [differences, setDifferences] = useState({});
  const [resolutions, setResolutions] = useState({});
  const [hasSynced, setHasSynced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [ratioTypeFilter, setRatioTypeFilter] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [conflictItems, setConflictItems] = useState([]);
  const channelSelectorRef = React.useRef(null);

  useEffect(() => { setCurrentPage(1); }, [ratioTypeFilter, searchKeyword]);

  const fetchAllChannels = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/ratio_sync/channels');
      if (res.data.success) {
        const channels = res.data.data || [];
        const transferData = channels.map((ch) => ({
          key: ch.id, label: ch.name, value: ch.id, disabled: false, _originalData: ch,
        }));
        setAllChannels(transferData);
        setChannelEndpoints((prev) => {
          const merged = { ...prev };
          transferData.forEach((channel) => {
            const id = channel.key;
            const base = channel._originalData?.base_url || '';
            const name = channel.label || '';
            const channelType = channel._originalData?.type;
            if (!merged[id]) {
              if (id === MODELS_DEV_PRESET_ID || base === MODELS_DEV_PRESET_BASE_URL) merged[id] = MODELS_DEV_PRESET_ENDPOINT;
              else if (id === OFFICIAL_RATIO_PRESET_ID || base === OFFICIAL_RATIO_PRESET_BASE_URL || name === '官方倍率预设') merged[id] = OFFICIAL_RATIO_PRESET_ENDPOINT;
              else if (channelType === 20) merged[id] = 'openrouter';
              else merged[id] = DEFAULT_ENDPOINT;
            }
          });
          return merged;
        });
      } else showError(res.data.message);
    } catch (error) { showError(t('获取渠道失败：') + error.message); }
    finally { setLoading(false); }
  };

  const confirmChannelSelection = () => {
    const selected = allChannels.filter((ch) => selectedChannelIds.includes(ch.value)).map((ch) => ch._originalData);
    if (!selected.length) return showWarning(t('请至少选择一个渠道'));
    setModalVisible(false);
    fetchRatiosFromChannels(selected);
  };

  const fetchRatiosFromChannels = async (channelList) => {
    setSyncLoading(true);
    const upstreams = channelList.map((ch) => ({
      id: ch.id, name: ch.name, base_url: ch.base_url,
      endpoint: channelEndpoints[ch.id] || DEFAULT_ENDPOINT,
    }));
    try {
      const res = await API.post('/api/ratio_sync/fetch', { upstreams, timeout: 10 });
      if (!res.data.success) { showError(res.data.message || t('后端请求失败')); return; }
      const { differences = {}, test_results = [] } = res.data.data;
      const errorResults = test_results.filter((r) => r.status === 'error');
      if (errorResults.length > 0) {
        showWarning(t('部分渠道测试失败：') + errorResults.map((r) => `${r.name}: ${r.error}`).join(', '));
      }
      setDifferences(differences);
      setResolutions({});
      setHasSynced(true);
      if (Object.keys(differences).length === 0) showSuccess(t('未找到差异化倍率，无需同步'));
    } catch (e) { showError(t('请求后端接口失败：') + e.message); }
    finally { setSyncLoading(false); }
  };

  function getBillingCategory(ratioType) { return ratioType === 'model_price' ? 'price' : 'ratio'; }

  const selectValue = useCallback((model, ratioType, value) => {
    const category = getBillingCategory(ratioType);
    setResolutions((prev) => {
      const newModelRes = { ...(prev[model] || {}) };
      Object.keys(newModelRes).forEach((rt) => { if (getBillingCategory(rt) !== category) delete newModelRes[rt]; });
      newModelRes[ratioType] = value;
      return { ...prev, [model]: newModelRes };
    });
  }, []);

  const performSync = useCallback(async (currentRatios) => {
    const finalRatios = {
      ModelRatio: { ...currentRatios.ModelRatio },
      CompletionRatio: { ...currentRatios.CompletionRatio },
      CacheRatio: { ...currentRatios.CacheRatio },
      ModelPrice: { ...currentRatios.ModelPrice },
    };
    Object.entries(resolutions).forEach(([model, ratios]) => {
      const selectedTypes = Object.keys(ratios);
      const hasPrice = selectedTypes.includes('model_price');
      const hasRatio = selectedTypes.some((rt) => rt !== 'model_price');
      if (hasPrice) { delete finalRatios.ModelRatio[model]; delete finalRatios.CompletionRatio[model]; delete finalRatios.CacheRatio[model]; }
      if (hasRatio) { delete finalRatios.ModelPrice[model]; }
      Object.entries(ratios).forEach(([ratioType, value]) => {
        const optionKey = ratioType.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        finalRatios[optionKey][model] = parseFloat(value);
      });
    });
    setLoading(true);
    try {
      const updates = Object.entries(finalRatios).map(([key, value]) =>
        API.put('/api/option/', { key, value: JSON.stringify(value, null, 2) }),
      );
      const results = await Promise.all(updates);
      if (results.every((res) => res.data.success)) {
        showSuccess(t('同步成功'));
        props.refresh();
        setDifferences((prev) => {
          const next = { ...prev };
          Object.entries(resolutions).forEach(([model, ratios]) => {
            Object.keys(ratios).forEach((rt) => {
              if (next[model]?.[rt]) {
                delete next[model][rt];
                if (Object.keys(next[model]).length === 0) delete next[model];
              }
            });
          });
          return next;
        });
        setResolutions({});
      } else showError(t('部分保存失败'));
    } catch { showError(t('保存失败')); }
    finally { setLoading(false); }
  }, [resolutions, props.options, props.refresh]);

  const applySync = async () => {
    const currentRatios = {
      ModelRatio: JSON.parse(props.options.ModelRatio || '{}'),
      CompletionRatio: JSON.parse(props.options.CompletionRatio || '{}'),
      CacheRatio: JSON.parse(props.options.CacheRatio || '{}'),
      ModelPrice: JSON.parse(props.options.ModelPrice || '{}'),
    };
    const conflicts = [];
    const getLocalBillingCategory = (model) => {
      if (currentRatios.ModelPrice[model] !== undefined) return 'price';
      if (currentRatios.ModelRatio[model] !== undefined || currentRatios.CompletionRatio[model] !== undefined || currentRatios.CacheRatio[model] !== undefined) return 'ratio';
      return null;
    };
    const findSourceChannel = (model, ratioType, value) => {
      if (differences[model]?.[ratioType]) {
        const entry = Object.entries(differences[model][ratioType].upstreams || {}).find(([_, v]) => v === value);
        if (entry) return entry[0];
      }
      return t('未知');
    };
    Object.entries(resolutions).forEach(([model, ratios]) => {
      const localCat = getLocalBillingCategory(model);
      const newCat = 'model_price' in ratios ? 'price' : 'ratio';
      if (localCat && localCat !== newCat) {
        const currentDesc = localCat === 'price' ? `${t('固定价格')} : ${currentRatios.ModelPrice[model]}` : `${t('模型倍率')} : ${currentRatios.ModelRatio[model] ?? '-'}\n${t('补全倍率')} : ${currentRatios.CompletionRatio[model] ?? '-'}`;
        let newDesc = '';
        if (newCat === 'price') newDesc = `${t('固定价格')} : ${ratios['model_price']}`;
        else newDesc = `${t('模型倍率')} : ${ratios['model_ratio'] ?? '-'}\n${t('补全倍率')} : ${ratios['completion_ratio'] ?? '-'}`;
        const channels = [...new Set(Object.entries(ratios).map(([rt, val]) => findSourceChannel(model, rt, val)))].join(', ');
        conflicts.push({ channel: channels, model, current: currentDesc, newVal: newDesc });
      }
    });
    if (conflicts.length > 0) { setConflictItems(conflicts); setConfirmVisible(true); return; }
    await performSync(currentRatios);
  };

  const dataSource = useMemo(() => {
    const tmp = [];
    Object.entries(differences).forEach(([model, ratioTypes]) => {
      const hasPrice = 'model_price' in ratioTypes;
      const hasOtherRatio = ['model_ratio', 'completion_ratio', 'cache_ratio'].some((rt) => rt in ratioTypes);
      const billingConflict = hasPrice && hasOtherRatio;
      Object.entries(ratioTypes).forEach(([ratioType, diff]) => {
        tmp.push({ key: `${model}_${ratioType}`, model, ratioType, current: diff.current, upstreams: diff.upstreams, confidence: diff.confidence || {}, billingConflict });
      });
    });
    return tmp;
  }, [differences]);

  const filteredDataSource = useMemo(() => {
    if (!searchKeyword.trim() && !ratioTypeFilter) return dataSource;
    return dataSource.filter((item) => {
      const kw = searchKeyword.trim().toLowerCase();
      return (!kw || item.model.toLowerCase().includes(kw)) && (!ratioTypeFilter || item.ratioType === ratioTypeFilter);
    });
  }, [dataSource, searchKeyword, ratioTypeFilter]);

  const upstreamNames = useMemo(() => {
    const set = new Set();
    filteredDataSource.forEach((row) => Object.keys(row.upstreams || {}).forEach((name) => set.add(name)));
    return Array.from(set);
  }, [filteredDataSource]);

  const pagedData = filteredDataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateChannelEndpoint = useCallback((channelId, endpoint) => {
    setChannelEndpoints((prev) => ({ ...prev, [channelId]: endpoint }));
  }, []);

  return (
    <div className='space-y-4'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          variant='secondary'
          onClick={() => { setModalVisible(true); if (!allChannels.length) fetchAllChannels(); }}
        >
          {t('选择同步渠道')}
        </Button>
        <Button
          size='sm'
          onClick={applySync}
          disabled={!Object.keys(resolutions).length}
        >
          {t('应用同步')}
        </Button>
        <div className='relative flex-1 min-w-[180px] max-w-[220px]'>
          <input type='text' value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder={t('搜索模型名称')}
            className='w-full rounded-md border border-ui-border bg-ui-bg-subtle text-ui-text text-xs pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40' />
        </div>
        <select value={ratioTypeFilter} onChange={(e) => setRatioTypeFilter(e.target.value)}
          className='rounded-xl border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ui-accent/40'>
          <option value=''>{t('全部倍率类型')}</option>
          <option value='model_ratio'>{t('模型倍率')}</option>
          <option value='completion_ratio'>{t('补全倍率')}</option>
          <option value='cache_ratio'>{t('缓存倍率')}</option>
          <option value='model_price'>{t('固定价格')}</option>
        </select>
      </div>

      {/* Table */}
      {filteredDataSource.length === 0 ? (
        <div className='text-center py-12 text-ui-text-3 text-xs'>
          {searchKeyword.trim() ? t('未找到匹配的模型') : hasSynced ? t('暂无差异化倍率显示') : t('请先选择同步渠道')}
        </div>
      ) : (
        <div className='rounded-md border border-ui-border overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead>
                <tr className='bg-ui-bg-subtle'>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2 sticky left-0 bg-ui-bg-subtle z-10'>{t('模型')}</th>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[100px]'>{t('倍率类型')}</th>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2 w-[80px]'>{t('置信度')}</th>
                  <th className='px-3 py-2 text-left font-semibold text-ui-text-2'>{t('当前值')}</th>
                  {upstreamNames.map((upName) => (
                    <th key={upName} className='px-3 py-2 text-left font-semibold text-ui-text-2'>{upName}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-ui-divider'>
                {pagedData.map((row) => {
                  const selected = resolutions[row.model]?.[row.ratioType];
                  const typeLabel = RATIO_TYPE_LABELS[row.ratioType] || row.ratioType;
                  const allConfident = Object.values(row.confidence || {}).every((v) => v !== false);
                  return (
                    <tr key={row.key} className='hover:bg-ui-bg-hover/50'>
                      <td className='px-3 py-2 font-mono text-[11px] sticky left-0 bg-inherit z-10'>{row.model}</td>
                      <td className='px-3 py-2'>
                        <span className={`${miniTag} !bg-blue-500/10 !text-blue-600 dark:!text-blue-400 !border-blue-500/20`}>{typeLabel}</span>
                        {row.billingConflict && (
                          <span title={t('该模型存在固定价格与倍率计费方式冲突，请确认选择')} className='ml-1'>
                            </span>
                        )}
                      </td>
                      <td className='px-3 py-2'>
                        {allConfident ? (
                          <span className={`${miniTag} !bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/20`}>
                            {t('可信')}
                          </span>
                        ) : (
                          <span className={`${miniTag} !bg-amber-500/10 !text-amber-600 dark:!text-amber-400 !border-amber-500/20`}>
                            {t('谨慎')}
                          </span>
                        )}
                      </td>
                      <td className='px-3 py-2'>
                        {row.current != null ? (
                          <span className={`${miniTag} !bg-blue-500/10 !text-blue-600 dark:!text-blue-400 !border-blue-500/20`}>{String(row.current)}</span>
                        ) : (
                          <span className={`${miniTag} !bg-gray-400/10 !text-ui-text-2 !border-gray-400/20`}>{t('未设置')}</span>
                        )}
                      </td>
                      {upstreamNames.map((upName) => {
                        const upstreamVal = row.upstreams?.[upName];
                        const isConfident = row.confidence?.[upName] !== false;
                        if (upstreamVal == null) return <td key={upName} className='px-3 py-2 text-ui-text-3'>{t('未设置')}</td>;
                        if (upstreamVal === 'same') return <td key={upName} className='px-3 py-2'><span className={`${miniTag} !bg-blue-500/10 !text-blue-600 dark:!text-blue-400 !border-blue-500/20`}>{t('与本地相同')}</span></td>;
                        const isSelected = selected === upstreamVal;
                        return (
                          <td key={upName} className='px-3 py-2'>
                            <label className={`flex items-center gap-1.5 cursor-pointer ${isSelected ? 'font-semibold text-ui-accent' : ''}`}>
                              <input type='checkbox' checked={isSelected} onChange={(e) => {
                                if (e.target.checked) selectValue(row.model, row.ratioType, upstreamVal);
                                else setResolutions((prev) => {
                                  const next = { ...prev };
                                  if (next[row.model]) { delete next[row.model][row.ratioType]; if (!Object.keys(next[row.model]).length) delete next[row.model]; }
                                  return next;
                                });
                              }} className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40' />
                              <span>{String(upstreamVal)}</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredDataSource.length > pageSize && (
            <Pagination page={currentPage} pageSize={pageSize} total={filteredDataSource.length} onChange={setCurrentPage} />
          )}
        </div>
      )}

      <ChannelSelectorModal
        ref={channelSelectorRef} t={t}
        visible={modalVisible}
        onCancel={() => { setModalVisible(false); channelSelectorRef.current?.resetPagination(); }}
        onOk={confirmChannelSelection}
        allChannels={allChannels}
        selectedChannelIds={selectedChannelIds}
        setSelectedChannelIds={setSelectedChannelIds}
        channelEndpoints={channelEndpoints}
        updateChannelEndpoint={updateChannelEndpoint}
      />

      <ConflictConfirmModal
        t={t} visible={confirmVisible} items={conflictItems}
        onOk={async () => {
          setConfirmVisible(false);
          await performSync({
            ModelRatio: JSON.parse(props.options.ModelRatio || '{}'),
            CompletionRatio: JSON.parse(props.options.CompletionRatio || '{}'),
            CacheRatio: JSON.parse(props.options.CacheRatio || '{}'),
            ModelPrice: JSON.parse(props.options.ModelPrice || '{}'),
          });
        }}
        onCancel={() => setConfirmVisible(false)}
      />
    </div>
  );
}
