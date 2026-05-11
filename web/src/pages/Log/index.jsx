/*
Copyright (C) 2025 QuantumNous

Logs — clean BAI-inspired table with composite token-usage chips.
*/

import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { Search, RefreshCw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import {
  API,
  showError,
  renderQuota,
  timestamp2string,
  isAdmin,
} from '../../helpers';
import { UserContext } from '../../context/User';
import Pagination from '../../components/common/table/Pagination';
import { Button, IconButton, inputClass } from '../../components/ui';

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  1: { label: '充值', color: '#22c55e' },
  2: { label: '消费', color: '#3b82f6' },
  3: { label: '管理', color: '#a3a3a3' },
  4: { label: '系统', color: '#a3a3a3' },
  5: { label: '错误', color: '#ef4444' },
  6: { label: '退款', color: '#f59e0b' },
  0: { label: '全部', color: '#a3a3a3' },
};

const TypeBadge = ({ type, t }) => {
  const info = TYPE_LABELS[type] || TYPE_LABELS[0];
  return (
    <span
      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap'
      style={{ background: `${info.color}1f`, color: info.color }}
    >
      {t(info.label)}
    </span>
  );
};

// helpers --------------------------------------------------

const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toUnix = (val) => {
  if (!val) return 0;
  return Math.floor(new Date(val).getTime() / 1000);
};

const formatThousand = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(2).replace(/\.?0+$/, '')}K`;
  return String(n);
};

const formatDuration = (ms) => {
  const v = Number(ms) || 0;
  if (v <= 0) return '—';
  if (v < 1000) return `${v} ms`;
  return `${(v / 1000).toFixed(2)} s`;
};

const PRESETS = [
  { label: '今天', start: () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; } },
  { label: '近 7 天', start: () => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; } },
  { label: '近 30 天', start: () => { const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d; } },
];

// ── helpers for the expanded "details" row ──

const FIELD_LABEL = {
  billing_source: '计费来源',
  cache_ratio: '缓存倍率',
  cache_tokens: '缓存 Tokens',
  cached_tokens: '命中缓存 Tokens',
  cache_creation_input_tokens: '缓存写入 Tokens',
  cache_read_input_tokens: '缓存命中 Tokens',
  prompt_cache_hit_tokens: '缓存命中 Tokens',
  prompt_cache_miss_tokens: '缓存未命中 Tokens',
  completion_ratio: '补全倍率',
  frt: '首字耗时 (ms)',
  group_ratio: '分组倍率',
  input_tokens_total: '总输入 Tokens',
  model_price: '模型价格',
  model_ratio: '模型倍率',
  request_path: '请求路径',
  request_conversion: '请求转换',
  stream_status: '流式状态',
  user_group_ratio: '用户分组倍率',
  admin_info: '管理信息',
};

const FIELDS_DEFAULT_ON_NEG_ONE = new Set([
  'model_price',
  'user_group_ratio',
  'model_ratio',
  'completion_ratio',
  'group_ratio',
  'cache_ratio',
]);

const formatVal = (v, key) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number' && v === -1 && key && FIELDS_DEFAULT_ON_NEG_ONE.has(key)) {
    return '默认';
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.length === 0 ? '—' : v.join(', ');
  if (typeof v === 'object') {
    const entries = Object.entries(v);
    if (entries.length === 0) return '—';
    return entries.map(([k, val]) => `${k}: ${formatVal(val, k)}`).join(' · ');
  }
  return String(v);
};

const parseOther = (other) => {
  if (!other) return null;
  try {
    const obj = typeof other === 'string' ? JSON.parse(other) : other;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    return null;
  } catch {
    return null;
  }
};

const DetailRow = ({ label, value, mono = false }) => (
  <div className='flex items-baseline gap-2 min-w-0'>
    <span className='text-[11px] text-ui-text-3 flex-shrink-0 whitespace-nowrap'>
      {label}
    </span>
    <span
      className={`text-xs text-ui-text break-all ${mono ? 'font-mono' : ''}`}
    >
      {value}
    </span>
  </div>
);

// ── BAI-style token usage chips ─────────────────────────

const TokenUsageChips = ({ promptTokens, completionTokens, t }) => {
  const inT = Number(promptTokens) || 0;
  const outT = Number(completionTokens) || 0;
  const total = inT + outT;
  if (total === 0) return <span className='text-ui-text-3 text-xs'>—</span>;

  const baseChip =
    'inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] tabular-nums whitespace-nowrap';
  const sumChip = `${baseChip} border border-ui-border text-ui-text font-medium`;
  const partChip = `${baseChip} border border-ui-border text-ui-text-2`;

  return (
    <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      <span className={sumChip}>
        <span className='text-[10px] font-semibold text-ui-text-3'>{t('总')}</span>
        {formatThousand(total)}
      </span>
      <span className='text-ui-text-3 text-[11px]'>=</span>
      <span className={partChip}>↑ {formatThousand(inT)}</span>
      <span className='text-ui-text-3 text-[11px]'>+</span>
      <span className={partChip}>↓ {formatThousand(outT)}</span>
    </span>
  );
};

// ── main view ───────────────────────────────────────────

const LogsView = () => {
  const { t } = useTranslation();
  usePageTitle(t('日志'));
  const [, ] = useContext(UserContext);
  const isAdminUser = isAdmin();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [filters, setFilters] = useState({
    token_name: '',
    model_name: '',
    group: '',
    request_id: '',
    channel: '',
    username: '',
    type: 0,
    start_timestamp: 0,
    end_timestamp: 0,
  });

  const load = async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        p: String(p),
        size: String(PAGE_SIZE),
        type: String(f.type || 0),
        token_name: f.token_name || '',
        model_name: f.model_name || '',
        group: f.group || '',
        request_id: f.request_id || '',
        start_timestamp: String(f.start_timestamp || 0),
        end_timestamp: String(f.end_timestamp || 0),
      });
      if (isAdminUser) {
        if (f.channel) params.append('channel', f.channel);
        if (f.username) params.append('username', f.username);
      }
      const url = isAdminUser
        ? `/api/log/?${params.toString()}`
        : `/api/log/self/?${params.toString()}`;
      const { data } = await API.get(url);
      if (data.success) {
        setLogs(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || p);
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const onSearch = (e) => { e?.preventDefault?.(); load(1); };
  const reset = () => {
    const f = {
      token_name: '', model_name: '', group: '', request_id: '',
      channel: '', username: '', type: 0,
      start_timestamp: 0, end_timestamp: 0,
    };
    setFilters(f);
    load(1, f);
  };
  const applyPreset = (preset) => {
    const start = preset.start();
    const end = new Date();
    setFilters((f) => ({
      ...f,
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }));
  };

  const inputCls = inputClass({ variant: 'admin', size: 'md' });

  const cols = [
    t('创建时间'),
    t('类型'),
    t('模型'),
    t('Token 用量'),
    ...(isAdminUser ? [t('用户'), t('渠道')] : []),
    t('消耗'),
    t('用时'),
  ];

  return (
    <div
      className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-[1080px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ letterSpacing: '-0.02em' }}
          >
            {t('日志')}
          </h1>
          <div className='flex items-center gap-1'>
            <IconButton
              icon={Filter}
              onClick={() => setShowFilters((s) => !s)}
              title={t('筛选')}
              className={showFilters ? 'bg-ui-bg-subtle text-ui-text' : ''}
            />
            <IconButton
              icon={RefreshCw}
              onClick={() => load(page)}
              title={t('刷新')}
              className={loading ? '[&_svg]:animate-spin' : ''}
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <form
            onSubmit={onSearch}
            className='border border-ui-border rounded-[20px] p-4 mb-4'
            style={{ backgroundColor: 'var(--page-bg)' }}
          >
            <div className='flex flex-wrap gap-1 mb-3'>
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant='chip'
                  size='sm'
                  type='button'
                  onClick={() => applyPreset(p)}
                >
                  {t(p.label)}
                </Button>
              ))}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3'>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('开始时间')}</label>
                <input type='datetime-local' value={toLocalInput(filters.start_timestamp)}
                  onChange={(e) => setFilters({ ...filters, start_timestamp: toUnix(e.target.value) })}
                  className={inputCls} style={{ backgroundColor: 'transparent', colorScheme: 'light' }} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('结束时间')}</label>
                <input type='datetime-local' value={toLocalInput(filters.end_timestamp)}
                  onChange={(e) => setFilters({ ...filters, end_timestamp: toUnix(e.target.value) })}
                  className={inputCls} style={{ backgroundColor: 'transparent', colorScheme: 'light' }} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('令牌名称')}</label>
                <input type='text' value={filters.token_name}
                  onChange={(e) => setFilters({ ...filters, token_name: e.target.value })}
                  placeholder={t('精确匹配')} className={inputCls} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('模型')}</label>
                <input type='text' value={filters.model_name}
                  onChange={(e) => setFilters({ ...filters, model_name: e.target.value })}
                  placeholder='gpt-4o' className={inputCls} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('分组')}</label>
                <input type='text' value={filters.group}
                  onChange={(e) => setFilters({ ...filters, group: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>Request ID</label>
                <input type='text' value={filters.request_id}
                  onChange={(e) => setFilters({ ...filters, request_id: e.target.value })}
                  className={inputCls} />
              </div>
              <div>
                <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('类型')}</label>
                <select value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: Number(e.target.value) })}
                  className={inputCls}>
                  <option value={0}>{t('全部')}</option>
                  <option value={1}>{t('充值')}</option>
                  <option value={2}>{t('消费')}</option>
                  <option value={3}>{t('管理')}</option>
                  <option value={4}>{t('系统')}</option>
                  <option value={5}>{t('错误')}</option>
                  <option value={6}>{t('退款')}</option>
                </select>
              </div>
              {isAdminUser && (
                <>
                  <div>
                    <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('渠道 ID')}</label>
                    <input type='text' value={filters.channel}
                      onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{t('用户名称')}</label>
                    <input type='text' value={filters.username}
                      onChange={(e) => setFilters({ ...filters, username: e.target.value })}
                      className={inputCls} />
                  </div>
                </>
              )}
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' size='sm' variant='secondary' onClick={reset}>
                {t('重置')}
              </Button>
              <Button type='submit' size='sm'>
                {t('查询')}
              </Button>
            </div>
          </form>
        )}

        {/* Table */}
        <div
          className='border border-ui-border rounded-[20px] overflow-hidden'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='overflow-x-auto nice-scroll'>
            <table className='w-full text-sm' style={{ minWidth: '880px' }}>
              <thead>
                <tr className='border-b border-ui-border'>
                  {cols.map((h, i) => (
                    <th
                      key={i}
                      className='text-left text-[12px] font-medium text-ui-text-2 px-4 py-3 whitespace-nowrap'
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} className='py-12 text-center text-ui-text-3 text-sm'>
                      {t('加载中...')}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length} className='py-12 text-center text-ui-text-3 text-sm'>
                      {t('暂无日志')}
                    </td>
                  </tr>
                ) : (
                  logs.map((log, i) => {
                    const isOpen = expandedRow === log.id;
                    const parsed = parseOther(log.other);
                    const expandable = !!(log.content || parsed || log.request_id);
                    return (
                      <React.Fragment key={log.id || i}>
                        <tr
                          onClick={() => expandable && setExpandedRow(isOpen ? null : log.id)}
                          className={`border-b border-ui-divider last:border-b-0 transition-colors ${
                            expandable
                              ? 'cursor-pointer hover:bg-ui-bg-subtle/70'
                              : 'hover:bg-ui-bg-subtle/50'
                          }`}
                        >
                          <td className='px-4 py-3 text-ui-text text-[13px] tabular-nums whitespace-nowrap'>
                            {timestamp2string(log.created_at)}
                          </td>
                          <td className='px-4 py-3'>
                            <TypeBadge type={log.type} t={t} />
                          </td>
                          <td className='px-4 py-3'>
                            {log.model_name ? (
                              <span
                                className='inline-block max-w-[200px] truncate text-[13px] text-ui-text'
                                title={log.model_name}
                              >
                                {log.model_name}
                              </span>
                            ) : (
                              <span className='text-ui-text-3'>—</span>
                            )}
                          </td>
                          <td className='px-4 py-3'>
                            <TokenUsageChips
                              promptTokens={log.prompt_tokens}
                              completionTokens={log.completion_tokens}
                              t={t}
                            />
                          </td>
                          {isAdminUser && (
                            <>
                              <td className='px-4 py-3 text-ui-text-2 text-[13px]'>
                                {log.username || <span className='text-ui-text-3'>—</span>}
                              </td>
                              <td className='px-4 py-3 text-ui-text-2 text-[13px]'>
                                {log.channel_name || log.channel || <span className='text-ui-text-3'>—</span>}
                              </td>
                            </>
                          )}
                          <td className='px-4 py-3 text-ui-text text-[13px] tabular-nums whitespace-nowrap'>
                            {log.quota > 0
                              ? renderQuota(log.quota)
                              : <span className='text-ui-text-3'>—</span>}
                          </td>
                          <td className='px-4 py-3 text-ui-text-2 text-[13px] tabular-nums whitespace-nowrap'>
                            {formatDuration(log.use_time)}
                          </td>
                        </tr>
                        {isOpen && expandable && (
                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                            <td colSpan={cols.length} className='px-4 py-3'>
                              <div className='space-y-3'>
                                {log.content && (
                                  <DetailRow label={t('内容')} value={log.content} />
                                )}
                                {parsed && (
                                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5'>
                                    {Object.entries(parsed).map(([k, v]) => (
                                      <DetailRow
                                        key={k}
                                        label={t(FIELD_LABEL[k] || k)}
                                        value={formatVal(v, k)}
                                      />
                                    ))}
                                  </div>
                                )}
                                {!parsed && log.other && (
                                  <DetailRow label={t('其他')} value={log.other} mono />
                                )}
                                {log.request_id && (
                                  <DetailRow label='Request ID' value={log.request_id} mono />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={(p) => load(p)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsView;
