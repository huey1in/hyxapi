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
const FilterGroup = ({ Icon, label, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className='flex items-center gap-2 w-full py-2 text-sm font-medium text-ui-text hover:text-ui-accent transition-colors rounded-md hover:bg-ui-bg-subtle px-2'
      >
        <Icon size={16} className='text-ui-text-3 shrink-0' />
        <span className='flex-1 text-left'>{label}</span>
        <ChevronDown
          size={13}
          className={`text-ui-text-3 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className='mt-1 mb-2 space-y-0.5'>
          {children}
        </div>
      )}
    </div>
  );
};

const FilterItem = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full py-1.5 px-2 text-xs transition-colors text-left rounded-md ${
      active
        ? 'text-ui-text font-medium bg-ui-bg-subtle'
        : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-hover'
    }`}
  >
    <span className='truncate flex-1'>{label}</span>
    {count != null && (
      <span className={`text-xs ml-2 shrink-0 ${active ? 'text-ui-text-3' : 'text-ui-text-3/60'}`}>
        {count}
      </span>
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
  const [group, setGroup] = useState('default');
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
      if (Object.keys(usable).length > 0 && !usable[group]) {
        setGroup(Object.keys(usable)[0]);
      }
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
    <nav className='space-y-1'>
      <FilterGroup Icon={User} label={t('品牌')}>
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
            onClick={() => setVendorFilter(v.id)}
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

      <FilterGroup Icon={Server} label={t('协议')}>
        <FilterItem
          label={t('全部')}
          count={endpointTypes.reduce((a, e) => a + (endpointCounts[e] || 0), 0) || models.length}
          active={endpointFilter === 'all'}
          onClick={() => setEndpointFilter('all')}
        />
        {endpointTypes.map((ep) => (
          <FilterItem
            key={ep}
            label={endpointLabel(ep)}
            count={endpointCounts[ep] || 0}
            active={endpointFilter === ep}
            onClick={() => setEndpointFilter(ep)}
          />
        ))}
      </FilterGroup>

      <FilterGroup Icon={ArrowDownToLine} label={t('分组')}>
        {Object.entries(usableGroups).map(([key, info]) => (
          <FilterItem
            key={key}
            label={`${info?.desc || key}${groupRatio[key] != null ? ` ×${groupRatio[key]}` : ''}`}
            active={group === key}
            onClick={() => setGroup(key)}
          />
        ))}
      </FilterGroup>
    </nav>
  );

  return (
    <div className='min-h-[calc(100vh-4rem)] mt-16 bg-ui-bg'>
      {/* Page header */}
      <div className='border-b border-ui-border'>
        <div className='max-w-[1400px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between gap-3'>
          <div>
            <h1
              className='text-xl font-semibold text-ui-text'
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.015em' }}
            >
              {t('模型广场')}
            </h1>
            <p className='text-xs text-ui-text-3 mt-0.5'>
              {filtered.length} / {models.length} {t('个模型')}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <div className='relative w-44 sm:w-56 hidden sm:block'>
              <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3' />
              <input
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('搜索模型...')}
                className='w-full pl-9 pr-3 py-1.5 text-[13px] bg-ui-bg-elevated border border-ui-border rounded-lg text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3'
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              title={t('刷新')}
              className='inline-flex items-center justify-center w-8 h-8 rounded-md text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className='sm:hidden px-4 pb-3'>
          <div className='relative'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('搜索模型...')}
              className='w-full pl-9 pr-3 py-2 text-[13px] bg-ui-bg-elevated border border-ui-border rounded-lg text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3'
            />
          </div>
        </div>
      </div>

      {/* Body: sidebar + main 或 详情视图 */}
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
        <div className='max-w-[1400px] mx-auto flex'>
        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowMobileFilters((s) => !s)}
          className='lg:hidden inline-flex items-center gap-2 px-3.5 py-2 mx-4 mt-4 mb-2 rounded-lg text-[13px] transition-colors self-start text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
        >
          <SlidersHorizontal size={14} />
          {t('筛选')}
        </button>

        {/* Sidebar */}
        <aside
          className={`${
            showMobileFilters ? 'block' : 'hidden'
          } lg:block bg-ui-bg-subtle/50 lg:bg-transparent pl-4 lg:pl-6 pt-4 lg:pt-5 border-r border-ui-border`}
        >
          <div className='lg:sticky lg:top-20'>
            <div className='w-full lg:w-52 shrink-0 pr-4 lg:pr-5'>
              {sidebarContent}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className='flex-1 min-w-0 px-4 lg:px-6 pt-4 lg:pt-5 pb-12'>
          {loading && models.length === 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {[...Array(6)].map((_, i) => (
                <div key={i} className='bg-ui-bg-elevated border border-ui-border rounded-xl h-44 animate-pulse' />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className='py-24 text-center text-ui-text-3 text-sm'>
              {t('没有匹配的模型')}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pb-4'>
              {filtered.map((m) => {
                const vendor = vendors[m.vendor_id] || { name: m.owner_by || 'Unknown' };
                const pricing = computePricing(m);
                const isCopied = copied === m.model_name;
                return (
                  <div
                    key={m.model_name}
                    onClick={() => openModel(m.model_name)}
                    className='group relative flex flex-col overflow-hidden rounded-xl border border-ui-border bg-ui-bg-elevated cursor-pointer transition-colors duration-200 hover:border-ui-text-3'
                  >
                    <div className='flex flex-col px-5 pb-0 pt-5'>
                      {/* Header row */}
                      <div className='flex items-center gap-2 min-w-0'>
                        <VendorAvatar name={vendor.name} icon={vendor.icon} />
                        <h3 className='text-[15px] font-semibold leading-snug text-ui-text line-clamp-1 min-w-0'>
                          <span className='text-ui-text-3 font-normal'>{vendor.name}: </span>
                          {m.model_name}
                        </h3>
                        <button
                          onClick={(e) => onCopyName(e, m.model_name)}
                          title={t('复制模型 ID')}
                          className='p-1 rounded hover:bg-ui-bg-subtle transition-all shrink-0 opacity-0 group-hover:opacity-100'
                        >
                          {isCopied ? (
                            <Check size={13} className='text-ui-brand' />
                          ) : (
                            <Copy size={13} className='text-ui-text-3' />
                          )}
                        </button>
                        <div className='flex-1' />
                      </div>

                      {/* Groups */}
                      <div className='mt-2.5 flex flex-wrap gap-1 min-h-[2lh] items-start'>
                        {(m.enable_groups || []).length === 0 ? (
                          <span className='text-[12px] text-ui-text-3'>{t('无可用分组')}</span>
                        ) : (
                          (m.enable_groups || []).map((g) => (
                            <span
                              key={g}
                              className='inline-flex items-center px-1.5 py-0.5 rounded text-[11px] text-ui-text-2 bg-ui-bg-subtle'
                            >
                              {usableGroups[g]?.desc || g}
                              {groupRatio[g] != null && (
                                <span className='ml-1 text-ui-text-3'>×{groupRatio[g]}</span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Footer: inline pricing */}
                    <div className='px-5 pb-3.5 pt-2.5 mt-2 border-t border-ui-divider'>
                      <div className='flex items-baseline flex-wrap gap-x-3 gap-y-0.5 text-[12px] leading-relaxed'>
                        {pricing.kind === 'per_call' ? (
                          <span className='whitespace-nowrap'>
                            <span className='text-ui-text-3'>{t('单次')}</span>{' '}
                            <span className='text-ui-text font-medium tabular-nums'>
                              ${formatPrice(pricing.dollar)}
                            </span>
                          </span>
                        ) : (
                          <>
                            <span className='whitespace-nowrap'>
                              <span className='text-ui-text-3'>{t('输入')}</span>{' '}
                              <span className='text-ui-text font-medium tabular-nums'>
                                ${formatPrice(pricing.promptPerM)}/M
                              </span>
                            </span>
                            <span className='whitespace-nowrap'>
                              <span className='text-ui-text-3'>{t('输出')}</span>{' '}
                              <span className='text-ui-text font-medium tabular-nums'>
                                ${formatPrice(pricing.completionPerM)}/M
                              </span>
                            </span>
                            {pricing.cachePerM != null && (
                              <span className='whitespace-nowrap'>
                                <span className='text-ui-text-3'>{t('缓存')}</span>{' '}
                                <span className='text-ui-text font-medium tabular-nums'>
                                  ${formatPrice(pricing.cachePerM)}/M
                                </span>
                              </span>
                            )}
                          </>
                        )}
                        {m.supported_endpoint_types?.length > 0 && (
                          <span className='whitespace-nowrap'>
                            <span className='text-ui-text-3'>{t('协议')}</span>{' '}
                            <span className='font-mono text-[11px] text-ui-text-2'>
                              {m.supported_endpoint_types.map(endpointLabel).join(', ')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className='flex-1' />
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
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl divide-y divide-ui-divider'>
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
          <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
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
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4'>
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
                  className='px-3 py-2 rounded-lg border border-ui-border bg-ui-bg-elevated min-w-[180px]'
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
