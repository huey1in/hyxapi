/*
 * Pricing — 模型广场（与 web-backup 同构的简化版）
 *
 * 左侧筛选 Sidebar + 右侧 Card 网格 + 详情侧滑。
 * 去掉了 @lobehub/icons 渲染（统一用首字母 fallback）。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { Search, RefreshCw, Copy, X } from 'lucide-react';
import { API, showError, showSuccess, copy } from '../../helpers';
import {
  Button, IconButton, Card, Input, Checkbox, SlideOver, Tag, Loading,
} from '../../components/ui';
import { cn } from '../../components/ui/tokens';

const formatPrice = (n) => {
  if (n === 0 || n == null) return '0';
  if (n < 0.01) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  if (n < 100) return n.toFixed(2);
  return n.toFixed(1);
};

const hashHue = (s) => {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
};

const VendorAvatar = ({ name, size = 20 }) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className='inline-flex items-center justify-center rounded-full text-[10px] font-semibold text-white shrink-0'
      style={{ width: size, height: size, background: `hsl(${hashHue(name)} 50% 55%)` }}
    >
      {initial}
    </span>
  );
};

const PricingPage = () => {
  const { t } = useTranslation();
  usePageTitle(t('模型广场'));

  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/pricing');
      if (res.data?.success) setModels(res.data.data || []);
      else showError(res.data?.message || t('加载失败'));
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchModels(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const allVendors = useMemo(() => Array.from(new Set(models.map((m) => m.vendor).filter(Boolean))).sort(), [models]);
  const allGroups  = useMemo(() => Array.from(new Set(models.flatMap((m) => m.groups || m.enable_groups || []).filter(Boolean))).sort(), [models]);

  const filtered = models.filter((m) => {
    if (keyword && !`${m.model_name} ${m.vendor || ''}`.toLowerCase().includes(keyword.toLowerCase())) return false;
    if (selectedVendors.length && !selectedVendors.includes(m.vendor)) return false;
    const groups = m.groups || m.enable_groups || [];
    if (selectedGroups.length && !groups.some((g) => selectedGroups.includes(g))) return false;
    return true;
  });

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const reset = () => { setKeyword(''); setSelectedVendors([]); setSelectedGroups([]); };

  const onCopyModelId = async (id) => {
    if (await copy(id)) showSuccess(t('已复制'));
    else showError(t('复制失败'));
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1400px] mx-auto'>
        <div className='flex items-center justify-between mb-5'>
          <h1 className='text-2xl md:text-3xl font-medium text-ui-text' style={{ letterSpacing: '-0.02em' }}>
            {t('模型广场')}
          </h1>
          <IconButton icon={RefreshCw} onClick={fetchModels} className={loading ? '[&_svg]:animate-spin' : ''} title={t('刷新')} />
        </div>

        <div className='flex gap-4'>
          {/* Sidebar */}
          <aside className='hidden md:block w-60 flex-shrink-0'>
            <Card>
              <Input
                value={keyword} onChange={setKeyword} placeholder={t('搜索模型')}
                prefix={<Search size={14} />}
                suffix={keyword ? <IconButton size='xs' icon={X} onClick={() => setKeyword('')} /> : null}
                width='full'
              />
              <FilterSection title={t('厂商')} options={allVendors} selected={selectedVendors} onToggle={(v) => toggle(selectedVendors, setSelectedVendors, v)} />
              <FilterSection title={t('分组')} options={allGroups}  selected={selectedGroups}  onToggle={(v) => toggle(selectedGroups, setSelectedGroups, v)} />
              <Button block onClick={reset}>{t('重置筛选')}</Button>
            </Card>
          </aside>

          {/* Grid */}
          <div className='flex-1 min-w-0'>
            {loading
              ? <div className='py-16 flex justify-center'><Loading label={t('加载模型中...')} /></div>
              : filtered.length === 0
                ? <Card><div className='py-12 text-center text-sm text-ui-text-3'>{t('没有匹配的模型')}</div></Card>
                : (
                  <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
                    {filtered.map((m) => (
                      <Card key={m.model_name} interactive='hover' onClick={() => setSelectedModel(m)}>
                        <div className='flex items-center gap-2 mb-2'>
                          <VendorAvatar name={m.vendor} size={20} />
                          <span className='text-sm font-medium text-ui-text truncate'>{m.model_name}</span>
                        </div>
                        {m.vendor && <div className='text-xs text-ui-text-3 mb-2'>{m.vendor}</div>}
                        <div className='flex flex-wrap gap-1 mb-2'>
                          {(m.groups || m.enable_groups || []).slice(0, 4).map((g) => <Tag key={g} size='sm'>{g}</Tag>)}
                        </div>
                        <div className='text-xs text-ui-text-2 tabular-nums space-x-3'>
                          {m.input_price != null  && <span>↑ ${formatPrice(m.input_price)}/M</span>}
                          {m.output_price != null && <span>↓ ${formatPrice(m.output_price)}/M</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
          </div>
        </div>
      </div>

      <SlideOver
        open={!!selectedModel}
        onClose={() => setSelectedModel(null)}
        placement='right'
        width={560}
        title={selectedModel && (
          <span className='text-base font-semibold text-ui-text inline-flex items-center gap-2'>
            <VendorAvatar name={selectedModel.vendor} />
            {selectedModel.model_name}
          </span>
        )}
      >
        {selectedModel && (
          <div className='p-6 space-y-4 text-sm'>
            <div className='flex items-center gap-2'>
              <span className='text-ui-text-3'>{t('模型 ID')}</span>
              <span className='font-mono text-ui-text break-all'>{selectedModel.model_name}</span>
              <IconButton size='sm' icon={Copy} onClick={() => onCopyModelId(selectedModel.model_name)} />
            </div>
            {selectedModel.vendor && <div><span className='text-ui-text-3'>{t('厂商')}：</span>{selectedModel.vendor}</div>}
            {selectedModel.description && <p className='text-ui-text-2 leading-relaxed'>{selectedModel.description}</p>}
            <div>
              <div className='text-xs uppercase text-ui-text-3 mb-1.5'>{t('可用分组')}</div>
              <div className='flex flex-wrap gap-1'>{(selectedModel.groups || selectedModel.enable_groups || []).map((g) => <Tag key={g} size='sm'>{g}</Tag>)}</div>
            </div>
            <div>
              <div className='text-xs uppercase text-ui-text-3 mb-1.5'>{t('价格')}</div>
              <div className='font-mono text-ui-text tabular-nums space-y-0.5'>
                {selectedModel.input_price  != null && <div>{t('输入')}：${formatPrice(selectedModel.input_price)} / 1M tokens</div>}
                {selectedModel.output_price != null && <div>{t('输出')}：${formatPrice(selectedModel.output_price)} / 1M tokens</div>}
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
};

const FilterSection = ({ title, options, selected, onToggle }) => (
  <div className='mt-4'>
    <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-2'>{title}</div>
    <div className='space-y-1 max-h-[180px] overflow-y-auto'>
      {options.length === 0
        ? <div className='text-xs text-ui-text-3 py-1'>—</div>
        : options.map((opt) => (
          <Checkbox key={opt} checked={selected.includes(opt)} onChange={() => onToggle(opt)} label={opt} />
        ))}
    </div>
  </div>
);

export default PricingPage;
