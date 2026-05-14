import React, { useContext, useEffect, useState } from 'react';
import { Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { API, showError, renderNumber, renderQuota, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { Button, IconButton, Input, Select, Pagination, Loading } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: 0, label: '全部' },
  { value: 1, label: '充值' },
  { value: 2, label: '消费' },
  { value: 3, label: '管理' },
  { value: 4, label: '系统' },
  { value: 5, label: '错误' },
  { value: 6, label: '退款' },
];

const TYPE_LABELS = {
  1: '充值', 2: '消费', 3: '管理', 4: '系统', 5: '错误', 6: '退款',
};

const TYPE_COLORS = {
  1: '#22c55e', 2: '#000', 3: '#3b82f6', 4: '#8b5cf6', 5: '#ef4444', 6: '#f59e0b',
};

const LogPage = () => {
  const [userState] = useContext(UserContext);
  const isAdmin = (userState?.user?.role || 1) >= 10;
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState({
    token_name: '', model_name: '', group: '', request_id: '',
    channel: '', username: '', type: 0,
  });

  const f = (k) => (v) => setFilters((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const load = async (p = 1, fl = filters) => {
    setLoading(true);
    setExpanded(null);
    try {
      const params = new URLSearchParams({
        p: String(p), size: String(PAGE_SIZE),
        type: String(fl.type || 0),
        token_name: fl.token_name || '',
        model_name: fl.model_name || '',
        group: fl.group || '',
        request_id: fl.request_id || '',
        start_timestamp: '0', end_timestamp: '0',
      });
      if (isAdmin) {
        if (fl.channel) params.append('channel', fl.channel);
        if (fl.username) params.append('username', fl.username);
      }
      const url = (isAdmin ? '/api/log/?' : '/api/log/self/?') + params.toString();
      const { data } = await API.get(url);
      if (data.success) {
        setRows(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || p);
      } else showError(data.message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const reset = () => {
    const empty = { token_name: '', model_name: '', group: '', request_id: '', channel: '', username: '', type: 0 };
    setFilters(empty); load(1, empty);
  };

  const toggle = (id) => setExpanded((prev) => prev === id ? null : id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>积分明细</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconButton icon={Filter} title='筛选' selected={showFilters} onClick={() => setShowFilters((s) => !s)} />
          <IconButton icon={RefreshCw} title='刷新' onClick={() => load(page)} />
        </div>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>类型</div>
              <Select value={filters.type} onChange={(v) => f('type')(Number(v))} options={TYPE_OPTIONS} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>令牌名</div>
              <Input value={filters.token_name} onChange={f('token_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>模型</div>
              <Input value={filters.model_name} onChange={f('model_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>分组</div>
              <Input value={filters.group} onChange={f('group')} width='full' />
            </div>
            {isAdmin && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>渠道</div>
                  <Input value={filters.channel} onChange={f('channel')} width='full' />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>用户名</div>
                  <Input value={filters.username} onChange={f('username')} width='full' />
                </div>
              </>
            )}
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>Request ID</div>
              <Input value={filters.request_id} onChange={f('request_id')} width='full' />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='toggle' onClick={reset}>重置</Button>
            <Button onClick={() => load(1)}>搜索</Button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? <Loading /> : (
        <>
          {rows.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 14 }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((r) => (
                <LogCard key={r.id} row={r} isAdmin={isAdmin} open={expanded === r.id} onToggle={() => toggle(r.id)} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p)} />
          </div>
        </>
      )}
    </div>
  );
};

// ── 单条日志卡片 ──────────────────────────────────────

const LogCard = ({ row: r, isAdmin, open, onToggle }) => {
  const totalTokens = (r.prompt_tokens || 0) + (r.completion_tokens || 0);
  const typeColor = TYPE_COLORS[r.type] || '#999';

  let other = null;
  try { if (r.other) other = typeof r.other === 'string' ? JSON.parse(r.other) : r.other; } catch {}
  const cacheHit = other?.cache_tokens || 0;
  const cacheWrite = other?.cache_write_tokens || other?.cache_creation_tokens || 0;

  return (
    <div
      style={{
        border: '1px solid var(--ui-border)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s',
        boxShadow: open ? '0 2px 12px rgba(0,0,0,0.04)' : 'none',
      }}
    >
      {/* 主行 */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          padding: '14px 18px',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-subtle)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* 左侧信息 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {/* 第一行：模型 + 类型 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.model_name || '系统操作'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              height: 20, paddingInline: 8, borderRadius: 10,
              fontSize: 11, fontWeight: 500, color: typeColor,
              background: `${typeColor}12`,
            }}>
              {TYPE_LABELS[r.type] || '系统'}
            </span>
          </div>
          {/* 第二行：Token 用量 pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TokenPill value={totalTokens} variant='total' />
            <TokenPill value={r.prompt_tokens || 0} variant='input' label='输入' />
            <TokenPill value={r.completion_tokens || 0} variant='output' label='输出' />
            <TokenPill value={cacheHit} variant='cache' label='缓存命中' />
            <TokenPill value={cacheWrite} variant='cacheWrite' label='缓存创建' />
          </div>
        </div>

        {/* 右侧：积分 + 时间 + 展开 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {r.quota > 0 && (
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>
                {renderQuota(r.quota)}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                color: 'var(--ui-text-3)',
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ui-text-3)' }}>
            <span>{timestamp2string(r.created_at)}</span>
            {r.use_time > 0 && <span>· {r.use_time}s</span>}
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {open && (
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid #eeeeee', background: 'var(--page-bg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
            <DetailItem label='Token 名称' value={r.token_name || '-'} />
            <DetailItem label='分组' value={r.group || '-'} />
            <DetailItem label='Prompt Tokens' value={renderNumber(r.prompt_tokens || 0)} />
            <DetailItem label='Completion Tokens' value={renderNumber(r.completion_tokens || 0)} />
            {cacheHit > 0 && <DetailItem label='缓存命中' value={renderNumber(cacheHit)} />}
            {cacheWrite > 0 && <DetailItem label='缓存创建' value={renderNumber(cacheWrite)} />}
            {other?.cache_creation_ratio != null && <DetailItem label='缓存创建倍率' value={other.cache_creation_ratio} />}
            {other?.cache_ratio != null && <DetailItem label='缓存倍率' value={other.cache_ratio} />}
            {other?.model_ratio != null && <DetailItem label='模型倍率' value={other.model_ratio} />}
            {other?.completion_ratio != null && <DetailItem label='补全倍率' value={other.completion_ratio} />}
            {other?.group_ratio != null && <DetailItem label='分组倍率' value={other.group_ratio} />}
            {other?.model_price != null && <DetailItem label='模型价格' value={other.model_price === 0 ? '默认' : other.model_price} />}
            {other?.user_group_ratio != null && <DetailItem label='用户分组倍率' value={other.user_group_ratio === 0 ? '默认' : other.user_group_ratio} />}
            {other?.frt != null && other.frt > 0 && <DetailItem label='首字耗时' value={`${other.frt}ms`} />}
            {other?.wallet && <DetailItem label='计费来源' value={other.wallet} />}
            {other?.request_convert && <DetailItem label='请求转换' value={other.request_convert} />}
            {other?.request_path && <DetailItem label='请求路径' value={other.request_path} mono />}
            {other?.usage_semantic && <DetailItem label='Usage 语义' value={other.usage_semantic} />}
            {other?.stream_status && <DetailItem label='流式状态' value={`${other.stream_status.status || ''}${other.stream_status.end_reason ? ' (' + other.stream_status.end_reason + ')' : ''}`} />}
            {isAdmin && other?.channel_id != null && <DetailItem label='渠道 ID' value={other.channel_id} />}
            <DetailItem label='Request ID' value={r.request_id || '-'} mono />
            <DetailItem label='IP' value={r.ip || '-'} mono />
            {isAdmin && <DetailItem label='用户 ID' value={r.user_id ?? '-'} />}
            {r.content && (
              <div style={{ gridColumn: '1 / -1' }}>
                <DetailItem label='Content' value={r.content} multiline />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Token 用量 Pill ─────────────────────────────────────

const TokenPill = ({ value, variant, label }) => {
  if (value === 0 && variant !== 'total') return null;
  const formatted = renderNumber(value);
  if (variant === 'total') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 24, paddingInline: 10, borderRadius: 12,
        fontSize: 12, fontWeight: 600, color: 'var(--ui-accent-fg)', background: 'var(--ui-accent)',
      }}>
        {formatted}
      </span>
    );
  }
  const isCache = variant === 'cache' || variant === 'cacheWrite';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 24, paddingInline: 8, borderRadius: 12,
      fontSize: 11, color: isCache ? '#8b5cf6' : '#666',
      border: `1px solid ${isCache ? '#e9d5ff' : 'var(--ui-border)'}`,
      background: isCache ? '#faf5ff' : 'var(--page-bg)',
    }}>
      <span style={{ fontSize: 10, color: isCache ? '#a78bfa' : '#999' }}>{label}</span>
      {formatted}
    </span>
  );
};

// ── 详情行 ──────────────────────────────────────────────

const DetailItem = ({ label, value, mono, multiline }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span style={{ color: 'var(--ui-text-3)', width: 110, flexShrink: 0, fontSize: 12 }}>{label}</span>
    <span style={{
      color: 'var(--ui-text)', fontSize: 13,
      fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      whiteSpace: multiline ? 'pre-wrap' : 'normal',
      wordBreak: multiline ? 'break-all' : 'normal',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{value}</span>
  </div>
);

export default LogPage;
