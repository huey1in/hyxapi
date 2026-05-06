/*
Copyright (C) 2025 QuantumNous

Model marketplace — sidebar filters + dense card grid.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import {
  Search, RefreshCw, Copy, Check, User, Server, ChevronDown,
  ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, ArrowLeft,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import * as LobeIcons from '@lobehub/icons';
import { API, showError, showSuccess, copy } from '../../helpers';

const formatPrice = (n) => {
  if (n === 0 || n === null || n === undefined) return '0';
  if (n < 0.01) return n.toFixed(4);
  if (n < 1) return n.toFixed(3);
  if (n < 100) return n.toFixed(2);
  return n.toFixed(1);
};

// 厂商色相 hash（备选 avatar 用）
const hashHue = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
};

// 解析 lobehub 图标名（如 "Claude.Color" → LobeIcons.Claude.Color）
const resolveLobeIcon = (name) => {
  if (!name || typeof name !== 'string') return null;
  const segments = name.trim().split('.');
  let comp = LobeIcons[segments[0]];
  for (let i = 1; i < segments.length; i++) {
    if (!comp) return null;
    comp = comp[segments[i]];
  }
  if (!comp || (typeof comp !== 'function' && typeof comp !== 'object')) return null;
  return comp;
};

const VendorAvatar = ({ name, icon, size = 20 }) => {
  // 1) 后端给了 lobehub 名称（如 "Claude.Color"）
  const LobeIcon = resolveLobeIcon(icon);
  if (LobeIcon) {
    return <LobeIcon size={size} />;
  }
  // 2) 给了 URL
  if (icon && /^https?:\/\//.test(icon)) {
    return (
      <img
        src={icon}
        alt=''
        style={{ width: size, height: size }}
        className='rounded-full object-cover shrink-0 bg-ui-bg-subtle'
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  // 3) 兜底：色相 hash + 首字母
  const hue = hashHue(name);
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <span
      className='inline-flex items-center justify-center rounded-full font-semibold shrink-0'
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: `hsl(${hue} 75% 92%)`,
        color: `hsl(${hue} 65% 38%)`,
      }}
    >
      {initial}
    </span>
  );
};

// 可展开的侧栏分组
const FilterGroup = ({ label, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className='mb-5'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='flex items-center justify-between w-full pb-2 mb-1'
      >
        <span className='text-[11px] font-semibold uppercase tracking-widest text-ui-text-3'>{label}</span>
        <ChevronDown size={12} className={`text-ui-text-3 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className='space-y-0.5'>{children}</div>}
    </div>
  );
};

const FilterItem = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left ${
      active
        ? 'bg-ui-bg-subtle text-ui-text font-medium'
        : 'text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text'
    }`}
    style={{ fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', sans-serif" }}
  >
    <span className='truncate flex-1'>{label}</span>
    {count != null && (
      <span className='text-ui-text-3 text-[11px] ml-2 tabular-nums'>{count}</span>
    )}
  </button>
);

const PricingPage = () => {
  const { t } = useTranslation();
  usePageTitle(t('定价套餐'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [vendors, setVendors] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroups, setUsableGroups] = useState({});
  const [endpointMap, setEndpointMap] = useState({});

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [endpointFilter, setEndpointFilter] = useState('all');
  const [group, setGroup] = useState('all');
  const [copied, setCopied] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [vendorsExpanded, setVendorsExpanded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/pricing');
      if (!data.success) {
        showError(data.message);
        return;
      }
      setModels(data.data || []);
      const vmap = {};
      (data.vendors || []).forEach((v) => { vmap[v.id] = v; });
      setVendors(vmap);
      setGroupRatio(data.group_ratio || {});
      const usable = data.usable_group || {};
      setUsableGroups(usable);
      setEndpointMap(data.supported_endpoint || {});
      // 不再强制选中第一个分组
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (models || []).filter((m) => {
      if (q && !m.model_name.toLowerCase().includes(q)) return false;
      if (vendorFilter !== 'all' && m.vendor_id !== Number(vendorFilter)) return false;
      if (endpointFilter !== 'all') {
        const eps = m.supported_endpoint_types || [];
        if (!eps.includes(endpointFilter)) return false;
      }
      if (group !== 'all' && Array.isArray(m.enable_groups) && !m.enable_groups.includes(group)) {
        return false;
      }
      return true;
    });
  }, [models, search, vendorFilter, endpointFilter, group]);

  const groupMul = group === 'all' ? 1 : (groupRatio[group] ?? 1);

  const vendorCounts = useMemo(() => {
    const m = {};
    (models || []).forEach((mod) => {
      const id = mod.vendor_id || 0;
      m[id] = (m[id] || 0) + 1;
    });
    return m;
  }, [models]);

  const endpointTypes = useMemo(() => {
    const set = new Set();
    (models || []).forEach((m) =>
      (m.supported_endpoint_types || []).forEach((e) => set.add(e)),
    );
    return Array.from(set);
  }, [models]);

  const endpointCounts = useMemo(() => {
    const m = {};
    (models || []).forEach((mod) => {
      (mod.supported_endpoint_types || []).forEach((e) => {
        m[e] = (m[e] || 0) + 1;
      });
    });
    return m;
  }, [models]);

  const endpointLabel = (ep) => {
    const v = endpointMap[ep];
    if (typeof v === 'string') return v;
    return ep;
  };

  const computePricing = (m) => {
    if (m.quota_type === 1) {
      const dollar = (m.model_price || 0) * groupMul;
      return { kind: 'per_call', dollar };
    }
    const promptPerM = (m.model_ratio || 0) * 2 * groupMul;
    const completionPerM = promptPerM * (m.completion_ratio || 1);
    const cachePerM = m.cache_ratio != null ? promptPerM * m.cache_ratio : null;
    return { kind: 'ratio', promptPerM, completionPerM, cachePerM };
  };

  const onCopyName = async (e, name) => {
    e.stopPropagation();
    const ok = await copy(name);
    if (ok) {
      setCopied(name);
      showSuccess(t('已复制'));
      setTimeout(() => setCopied(null), 1200);
    }
  };

  const sortedVendors = useMemo(
    () => Object.values(vendors).sort(
      (a, b) => (vendorCounts[b.id] || 0) - (vendorCounts[a.id] || 0),
    ),
    [vendors, vendorCounts],
  );

  // 选中模型 (来自 URL 查询参数)
  const selectedName = searchParams.get('model') || '';
  const selectedModel = selectedName
    ? models.find((m) => m.model_name === selectedName) || null
    : null;
  const openModel = (name) => {
    const sp = new URLSearchParams(searchParams);
    sp.set('model', name);
    setSearchParams(sp);
  };
  const closeModel = () => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('model');
    setSearchParams(sp);
  };

  const visibleVendors = vendorsExpanded ? sortedVendors : sortedVendors.slice(0, 6);

  const sidebarContent = (
    <div>
      {/* 搜索 + 刷新 */}
      <div className='flex items-center gap-2 mb-5'>
        <div className='relative flex-1'>
          <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3' />
          <input
            type='text'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('搜索模型...')}
            className='w-full pl-8 pr-3 py-2 text-sm bg-ui-bg-elevated border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          title={t('刷新')}
          className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle border border-ui-border transition-colors disabled:opacity-50 shrink-0'
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <nav className='space-y-0.5'>
      <FilterGroup label={t('品牌')}>
        <FilterItem
          label={t('全部')}
          count={models.length}
          active={vendorFilter === 'all'}
          onClick={() => setVendorFilter('all')}
        />
        {visibleVendors.map((v) => (
          <FilterItem
            key={v.id}
            label={v.name}
            count={vendorCounts[v.id] || 0}
            active={String(vendorFilter) === String(v.id)}
            onClick={() => setVendorFilter(String(vendorFilter) === String(v.id) ? 'all' : v.id)}
          />
        ))}
        {sortedVendors.length > 6 && (
          <button
            onClick={() => setVendorsExpanded((e) => !e)}
            className='w-full py-1.5 text-[13px] text-ui-text-3 hover:text-ui-text-2 transition-colors text-left'
          >
            {vendorsExpanded ? t('收起') : t('+{{n}} 更多').replace('{{n}}', sortedVendors.length - 6)}
          </button>
        )}
      </FilterGroup>

      <FilterGroup label={t('协议')} defaultOpen={false}>
        {endpointTypes.map((ep) => (
          <FilterItem
            key={ep}
            label={endpointLabel(ep)}
            count={endpointCounts[ep] || 0}
            active={endpointFilter === ep}
            onClick={() => setEndpointFilter(endpointFilter === ep ? 'all' : ep)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label={t('分组')} defaultOpen={false}>
        {Object.entries(usableGroups).map(([key, info]) => (
          <FilterItem
            key={key}
            label={`${info?.desc || key}${groupRatio[key] != null ? ` ×${groupRatio[key]}` : ''}`}
            active={group === key}
            onClick={() => setGroup(group === key ? 'all' : key)}
          />
        ))}
      </FilterGroup>
    </nav>
    </div>
  );

  return (
    <div className='min-h-screen'>
      {/* 移动端顶部工具栏 */}
      <div className='lg:hidden sticky top-[var(--header-height)] z-30 border-b border-ui-border bg-[var(--page-bg)]/90 backdrop-blur-md'>
        <div className='px-4 py-2.5 flex items-center gap-2'>
          <div className='relative flex-1'>
            <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('搜索模型...')}
              className='w-full pl-8 pr-3 py-2 text-sm bg-ui-bg-elevated border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors shrink-0 ${
              vendorFilter !== 'all' || endpointFilter !== 'all' || group !== 'all'
                ? 'bg-ui-accent text-ui-accent-fg border-transparent'
                : 'bg-ui-bg-elevated border-ui-border text-ui-text-2'
            }`}
          >
            <SlidersHorizontal size={14} />
            {t('筛选')}
            {(vendorFilter !== 'all' || endpointFilter !== 'all' || group !== 'all') && (
              <span className='text-xs font-medium'>
                {[vendorFilter !== 'all', endpointFilter !== 'all', group !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 移动端 filter bottom sheet */}
      {showMobileFilters && (
        <div className='lg:hidden fixed inset-0 z-50 flex flex-col justify-end'>
          {/* 遮罩 */}
          <div
            className='absolute inset-0 bg-black/40 backdrop-blur-sm'
            onClick={() => setShowMobileFilters(false)}
          />
          {/* Sheet */}
          <div
            className='relative rounded-t-2xl border-t border-ui-border bg-ui-bg-elevated max-h-[80vh] flex flex-col'
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
          >
            {/* Handle */}
            <div className='flex justify-center pt-3 pb-1'>
              <div className='w-10 h-1 rounded-full bg-ui-border' />
            </div>
            {/* Header */}
            <div className='flex items-center justify-between px-5 py-3 border-b border-ui-border'>
              <span className='text-sm font-semibold text-ui-text'>{t('筛选')}</span>
              <button
                onClick={() => { setVendorFilter('all'); setEndpointFilter('all'); setGroup('all'); }}
                className='text-xs text-ui-text-3 hover:text-ui-text transition-colors'
              >
                {t('重置')}
              </button>
            </div>
            {/* Content */}
            <div className='overflow-y-auto px-5 py-4 flex-1'>
              {/* 只渲染 FilterGroups，不含搜索框 */}
              <FilterGroup label={t('品牌')}>
                <FilterItem label={t('全部')} count={models.length} active={vendorFilter === 'all'} onClick={() => setVendorFilter('all')} />
                {visibleVendors.map((v) => (
                  <FilterItem key={v.id} label={v.name} count={vendorCounts[v.id] || 0}
                    active={String(vendorFilter) === String(v.id)}
                    onClick={() => setVendorFilter(String(vendorFilter) === String(v.id) ? 'all' : v.id)} />
                ))}
                {sortedVendors.length > 6 && (
                  <button onClick={() => setVendorsExpanded((e) => !e)}
                    className='w-full py-1.5 text-[13px] text-ui-text-3 hover:text-ui-text-2 transition-colors text-left px-3'>
                    {vendorsExpanded ? t('收起') : t('+{{n}} 更多').replace('{{n}}', sortedVendors.length - 6)}
                  </button>
                )}
              </FilterGroup>
              <FilterGroup label={t('协议')} defaultOpen={false}>
                {endpointTypes.map((ep) => (
                  <FilterItem key={ep} label={endpointLabel(ep)} count={endpointCounts[ep] || 0}
                    active={endpointFilter === ep} onClick={() => setEndpointFilter(endpointFilter === ep ? 'all' : ep)} />
                ))}
              </FilterGroup>
              <FilterGroup label={t('分组')} defaultOpen={false}>
                {Object.entries(usableGroups).map(([key, info]) => (
                  <FilterItem key={key} label={`${info?.desc || key}${groupRatio[key] != null ? ` ×${groupRatio[key]}` : ''}`}
                    active={group === key} onClick={() => setGroup(group === key ? 'all' : key)} />
                ))}
              </FilterGroup>
            </div>
            {/* Footer */}
            <div className='px-5 py-4 border-t border-ui-border'>
              <button
                onClick={() => setShowMobileFilters(false)}
                className='w-full h-11 bg-ui-accent text-ui-accent-fg rounded-xl text-sm font-medium hover:bg-ui-accent-hover transition-colors'
              >
                {t('查看')} {filtered.length} {t('个模型')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {selectedModel ? (
        <ModelDetailView
          model={selectedModel}
          vendor={vendors[selectedModel.vendor_id]}
          groupRatio={groupRatio}
          usableGroups={usableGroups}
          endpointMap={endpointMap}
          group={group}
          onClose={closeModel}
          onCopy={onCopyName}
          copied={copied}
          t={t}
        />
      ) : (
        <div className='max-w-[1400px] mx-auto flex items-start'>

        {/* Desktop Sidebar */}
        <aside className='hidden lg:block w-64 shrink-0 border-r border-ui-border'>
          <div className='sticky top-[var(--header-height)] px-5 pt-5 pb-6'>
            {sidebarContent}
          </div>
        </aside>

        {/* Main */}
        <main className='flex-1 min-w-0 px-4 lg:px-8 pt-4 pb-12'>
          {loading && models.length === 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
              {[...Array(6)].map((_, i) => (
                <div key={i} className='border border-ui-border rounded-2xl h-44 animate-pulse' style={{ backgroundColor: 'var(--page-bg)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className='py-32 text-center text-ui-text-3 text-sm'>
              {t('没有匹配的模型')}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4'>
              {filtered.map((m) => {
                const vendor = vendors[m.vendor_id] || { name: m.owner_by || 'Unknown' };
                const pricing = computePricing(m);
                const isCopied = copied === m.model_name;
                return (
                  <div
                    key={m.model_name}
                    onClick={() => openModel(m.model_name)}
                    className='group relative flex flex-col overflow-hidden rounded-2xl border border-ui-border cursor-pointer transition-all duration-200 hover:border-ui-text-3/50 hover:shadow-md'
                    style={{ backgroundColor: 'var(--page-bg)' }}
                  >
                    <div className='flex flex-col px-5 pt-5 pb-0'>
                      <div className='flex items-center gap-2.5 min-w-0'>
                        <div className='w-7 h-7 rounded-lg bg-ui-bg-subtle flex items-center justify-center shrink-0 overflow-hidden'>
                          <VendorAvatar name={vendor.name} icon={vendor.icon} size={18} />
                        </div>
                        <span className='text-[11px] text-ui-text-3 font-medium truncate'>{vendor.name}</span>
                        <div className='flex-1' />
                        <button
                          onClick={(e) => onCopyName(e, m.model_name)}
                          title={t('复制模型 ID')}
                          className='p-1.5 rounded-lg hover:bg-ui-bg-subtle transition-all shrink-0 opacity-0 group-hover:opacity-100'
                        >
                          {isCopied ? (
                            <Check size={12} className='text-ui-brand' />
                          ) : (
                            <Copy size={12} className='text-ui-text-3' />
                          )}
                        </button>
                      </div>
                      <h3
                        className='text-[15px] font-semibold text-ui-text mt-2.5 line-clamp-2 leading-snug'
                        style={{ fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}
                      >
                        {m.model_name}
                      </h3>
                      <div className='mt-2 flex flex-wrap gap-1 min-h-[1.5rem] items-start'>
                        {(m.enable_groups || []).length === 0 ? (
                          <span className='text-[11px] text-ui-text-3'>{t('无可用分组')}</span>
                        ) : (
                          (m.enable_groups || []).slice(0, 4).map((g) => (
                            <span
                              key={g}
                              className='inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] text-ui-text-2 bg-ui-bg-subtle'
                            >
                              {usableGroups[g]?.desc || g}
                              {groupRatio[g] != null && (
                                <span className='ml-1 text-ui-text-3'>×{groupRatio[g]}</span>
                              )}
                            </span>
                          ))
                        )}
                        {(m.enable_groups || []).length > 4 && (
                          <span className='text-[11px] text-ui-text-3 px-1.5 py-0.5'>+{m.enable_groups.length - 4}</span>
                        )}
                      </div>
                    </div>
                    <div className='mt-auto px-5 pt-3 pb-4 border-t border-ui-divider mt-3'>
                      <div className='flex items-center flex-wrap gap-x-4 gap-y-0.5 text-[12px]'>
                        {pricing.kind === 'per_call' ? (
                          <span>
                            <span className='text-ui-text-3'>{t('单次')} </span>
                            <span className='text-ui-text font-semibold tabular-nums'>${formatPrice(pricing.dollar)}</span>
                          </span>
                        ) : (
                          <>
                            <span>
                              <span className='text-ui-text-3'>{t('输入')} </span>
                              <span className='text-ui-text font-semibold tabular-nums'>${formatPrice(pricing.promptPerM)}/M</span>
                            </span>
                            <span>
                              <span className='text-ui-text-3'>{t('输出')} </span>
                              <span className='text-ui-text font-semibold tabular-nums'>${formatPrice(pricing.completionPerM)}/M</span>
                            </span>
                            {pricing.cachePerM != null && (
                              <span>
                                <span className='text-ui-text-3'>{t('缓存')} </span>
                                <span className='text-ui-text font-semibold tabular-nums'>${formatPrice(pricing.cachePerM)}/M</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {m.supported_endpoint_types?.length > 0 && (
                        <div className='mt-1.5 flex flex-wrap gap-1'>
                          {m.supported_endpoint_types.map((ep) => (
                            <span
                              key={ep}
                              className='text-[10px] font-mono text-ui-text-3 px-1.5 py-0.5 rounded border border-ui-border'
                              style={{ backgroundColor: 'var(--page-bg)' }}
                            >
                              {endpointLabel(ep)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
        </div>
      )}
    </div>
  );
};

// ──────────── Model Detail View ────────────

const ModelDetailView = ({
  model, vendor, groupRatio, usableGroups, endpointMap, group, onClose, onCopy, copied, t,
}) => {
  const v = vendor || { name: model.owner_by || 'Unknown' };
  const isCopied = copied === model.model_name;
  const groupMul = group === 'all' ? 1 : (groupRatio[group] ?? 1);

  const endpointLabel = (ep) => {
    const v = endpointMap[ep];
    if (typeof v === 'string') return v;
    return ep;
  };

  // 当前分组下的价格
  const isPerCall = model.quota_type === 1;
  const promptPerM = isPerCall ? null : (model.model_ratio || 0) * 2 * groupMul;
  const completionPerM = isPerCall ? null : promptPerM * (model.completion_ratio || 1);
  const cachePerM = !isPerCall && model.cache_ratio != null ? promptPerM * model.cache_ratio : null;
  const callDollar = isPerCall ? (model.model_price || 0) * groupMul : null;

  // 各分组下的价格表
  const groupRows = (model.enable_groups || []).map((g) => {
    const mul = groupRatio[g] ?? 1;
    if (isPerCall) {
      return { group: g, mul, perCall: (model.model_price || 0) * mul };
    }
    const p = (model.model_ratio || 0) * 2 * mul;
    return {
      group: g,
      mul,
      input: p,
      output: p * (model.completion_ratio || 1),
      cache: model.cache_ratio != null ? p * model.cache_ratio : null,
    };
  });

  const Stat = ({ label, value, mono = true }) => (
    <div>
      <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>{label}</div>
      <div className={`text-sm text-ui-text ${mono ? 'font-mono' : ''} break-all`}>{value}</div>
    </div>
  );

  return (
    <div className='max-w-4xl mx-auto px-4 lg:px-6 py-6'>
      {/* Top bar */}
      <button
        onClick={onClose}
        className='inline-flex items-center gap-1.5 mb-5 px-2.5 py-1.5 -ml-2.5 rounded-md text-sm text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
      >
        <ArrowLeft size={14} />
        {t('返回')}
      </button>

      {/* Header */}
      <div className='flex items-start gap-4 mb-8'>
        <div className='w-10 h-10 rounded-xl bg-ui-bg-subtle flex items-center justify-center flex-shrink-0 overflow-hidden'>
          <VendorAvatar name={v.name} icon={v.icon} size={28} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-xs text-ui-text-3 mb-1'>{v.name}</div>
          <h1
            className='text-2xl md:text-3xl font-semibold text-ui-text break-all'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.015em' }}
          >
            {model.model_name}
          </h1>
        </div>
        <button
          onClick={(e) => onCopy(e, model.model_name)}
          className='inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
        >
          {isCopied ? <Check size={13} /> : <Copy size={13} />}
          {isCopied ? t('已复制') : t('复制 ID')}
        </button>
      </div>

      {/* Description */}
      {model.description && (
        <div className='mb-8 p-4 rounded-xl bg-ui-bg-subtle text-sm text-ui-text-2 leading-relaxed'>
          {model.description}
        </div>
      )}

      {/* Current pricing summary */}
      <div className='mb-8'>
        <h2 className='text-xs uppercase tracking-widest font-semibold text-ui-text-3 mb-3'>
          {t('当前定价')}{group !== 'all' && (
            <span className='ml-2 text-ui-text-2 font-normal normal-case tracking-normal'>
              · {usableGroups[group]?.desc || group} {groupRatio[group] != null && `×${groupRatio[group]}`}
            </span>
          )}
        </h2>
        <div
          className='border border-ui-border rounded-[28px] divide-y divide-ui-divider'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          {isPerCall ? (
            <div className='px-5 py-4 flex items-baseline justify-between'>
              <span className='text-sm text-ui-text-2'>{t('单次调用')}</span>
              <span className='text-2xl font-medium text-ui-text tabular-nums'>${callDollar.toFixed(4)}</span>
            </div>
          ) : (
            <>
              <div className='px-5 py-4 flex items-baseline justify-between'>
                <span className='text-sm text-ui-text-2'>{t('输入 (per 1M tokens)')}</span>
                <span className='text-xl font-medium text-ui-text tabular-nums'>${promptPerM.toFixed(4)}</span>
              </div>
              <div className='px-5 py-4 flex items-baseline justify-between'>
                <span className='text-sm text-ui-text-2'>{t('输出 (per 1M tokens)')}</span>
                <span className='text-xl font-medium text-ui-text tabular-nums'>${completionPerM.toFixed(4)}</span>
              </div>
              {cachePerM != null && (
                <div className='px-5 py-4 flex items-baseline justify-between'>
                  <span className='text-sm text-ui-text-2'>{t('缓存读取 (per 1M tokens)')}</span>
                  <span className='text-xl font-medium text-ui-text tabular-nums'>${cachePerM.toFixed(4)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* All groups pricing */}
      {groupRows.length > 1 && (
        <div className='mb-8'>
          <h2 className='text-xs uppercase tracking-widest font-semibold text-ui-text-3 mb-3'>
            {t('各分组定价')}
          </h2>
          <div
            className='border border-ui-border rounded-[28px] overflow-hidden'
            style={{ backgroundColor: 'var(--page-bg)' }}
          >
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                  <th className='text-left px-4 py-2.5 font-medium'>{t('分组')}</th>
                  <th className='text-right px-4 py-2.5 font-medium'>{t('倍率')}</th>
                  {isPerCall ? (
                    <th className='text-right px-4 py-2.5 font-medium'>{t('单次')}</th>
                  ) : (
                    <>
                      <th className='text-right px-4 py-2.5 font-medium'>{t('输入')}</th>
                      <th className='text-right px-4 py-2.5 font-medium'>{t('输出')}</th>
                      <th className='text-right px-4 py-2.5 font-medium'>{t('缓存')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {groupRows.map((r) => (
                  <tr key={r.group} className='border-b border-ui-divider last:border-b-0'>
                    <td className='px-4 py-2.5 text-ui-text'>
                      {usableGroups[r.group]?.desc || r.group}
                    </td>
                    <td className='px-4 py-2.5 text-right tabular-nums text-ui-text-2'>×{r.mul}</td>
                    {isPerCall ? (
                      <td className='px-4 py-2.5 text-right tabular-nums text-ui-text font-medium'>
                        ${r.perCall.toFixed(4)}
                      </td>
                    ) : (
                      <>
                        <td className='px-4 py-2.5 text-right tabular-nums text-ui-text'>${r.input.toFixed(4)}</td>
                        <td className='px-4 py-2.5 text-right tabular-nums text-ui-text'>${r.output.toFixed(4)}</td>
                        <td className='px-4 py-2.5 text-right tabular-nums text-ui-text-2'>
                          {r.cache != null ? `$${r.cache.toFixed(4)}` : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div className='mb-8'>
        <h2 className='text-xs uppercase tracking-widest font-semibold text-ui-text-3 mb-3'>
          {t('元数据')}
        </h2>
        <div
          className='border border-ui-border rounded-[28px] p-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <Stat label={t('计费类型')} value={isPerCall ? t('按次') : t('按 token')} mono={false} />
          <Stat label={t('模型倍率')} value={(model.model_ratio ?? 0).toString()} />
          {!isPerCall && (
            <Stat label={t('补全倍率')} value={(model.completion_ratio ?? 1).toString()} />
          )}
          {model.model_price != null && (
            <Stat label={t('模型价格')} value={model.model_price.toString()} />
          )}
          {model.cache_ratio != null && (
            <Stat label={t('缓存倍率')} value={model.cache_ratio.toString()} />
          )}
          {model.create_cache_ratio != null && (
            <Stat label={t('缓存写入倍率')} value={model.create_cache_ratio.toString()} />
          )}
          {model.image_ratio != null && (
            <Stat label={t('图像倍率')} value={model.image_ratio.toString()} />
          )}
          {model.audio_ratio != null && (
            <Stat label={t('音频倍率')} value={model.audio_ratio.toString()} />
          )}
          {model.audio_completion_ratio != null && (
            <Stat label={t('音频补全倍率')} value={model.audio_completion_ratio.toString()} />
          )}
          {model.owner_by && (
            <Stat label={t('归属')} value={model.owner_by} />
          )}
          {model.pricing_version && (
            <Stat label={t('版本')} value={model.pricing_version.slice(0, 12)} />
          )}
        </div>
      </div>

      {/* Endpoints */}
      {model.supported_endpoint_types?.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-xs uppercase tracking-widest font-semibold text-ui-text-3 mb-3'>
            {t('支持的协议')}
          </h2>
          <div className='flex flex-wrap gap-2'>
            {model.supported_endpoint_types.map((ep) => {
              const info = endpointMap[ep];
              return (
                <div
                  key={ep}
                  className='px-3 py-2 rounded-2xl border border-ui-border min-w-[180px]'
                  style={{ backgroundColor: 'var(--page-bg)' }}
                >
                  <div className='text-sm font-medium text-ui-text'>{endpointLabel(ep)}</div>
                  {info && typeof info === 'object' && (
                    <div className='mt-1 text-[11px] font-mono text-ui-text-3'>
                      {info.method && <span>{info.method} </span>}
                      {info.path && <span>{info.path}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingPage;
