import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Server } from 'lucide-react';
import { API, showError, showSuccess, copy, getLobeHubIcon } from '../../helpers';
import { PageShell, Card, Button, IconButton, Tag, Loading } from '../../components/ui';

const STATUS_COLORS = { up: '#22c55e', down: '#ef4444', unknown: '#d1d5db' };

const ModelDetail = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedGroup = searchParams.get('group');
  const [model, setModel] = useState(null);
  const [vendors, setVendors] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [health, setHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [pricingRes, healthRes] = await Promise.all([
          API.get('/api/pricing'),
          API.get(`/api/model-health/status/${encodeURIComponent(decodeURIComponent(modelName))}`),
        ]);
        if (pricingRes.data?.success) {
          const vmap = {};
          (pricingRes.data.vendors || []).forEach((v) => { vmap[v.id] = v; });
          setVendors(vmap);
          setGroupRatio(pricingRes.data.group_ratio || {});
          const found = (pricingRes.data.data || []).find((m) => m.model_name === decodeURIComponent(modelName));
          setModel(found || null);
        } else showError(pricingRes.data?.message);
        if (healthRes.data?.success) setHealth(healthRes.data.data || []);
      } catch (e) { showError(e); } finally { setLoading(false); }
    })();
  }, [modelName]);

  const healthByGroup = {};
  health.forEach((h) => { healthByGroup[h.group] = h; });

  if (loading) return <PageShell title='模型详情'><Loading /></PageShell>;
  if (!model) return (
    <PageShell title='模型详情'>
      <Card><p className='text-ui-text-3 text-center py-10'>未找到模型</p></Card>
    </PageShell>
  );

  const vendor = vendors[model.vendor_id];
  const enabledGroups = (model.enable_groups || [])
    .filter((g) => groupRatio[g] != null)
    .map((g) => ({ name: g, mul: groupRatio[g] }));
  if (enabledGroups.length === 0) enabledGroups.push({ name: '默认', mul: 1 });

  const isPerCall = model.quota_type === 1;

  return (
    <PageShell
      title={model.model_name}
      actions={<Button variant='toggle' icon={ArrowLeft} onClick={() => navigate(-1)}>返回</Button>}
    >
      <div className='space-y-5' style={{ minHeight: 'calc(100vh - 240px)' }}>
        {/* 模型信息头 */}
        <Card>
          <div className='flex items-center gap-4'>
            <div style={{ width: 48, height: 48, borderRadius: 14, border: '1px solid #e9e9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {vendor?.icon ? getLobeHubIcon(vendor.icon, 28) : <Server size={22} className='text-ui-text-3' />}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='font-mono text-lg font-semibold text-ui-text-1 break-all'>{model.model_name}</div>
              <div className='text-sm text-ui-text-3 mt-0.5'>
                {vendor?.name || '未知厂商'}
                {' · '}
                {isPerCall ? '按次计费' : '按 Token 计费'}
                {(model.supported_endpoint_types || []).length > 0 && (
                  <> · {(model.supported_endpoint_types || []).join(', ')}</>
                )}
              </div>
            </div>
            <IconButton icon={Copy} onClick={() => { copy(model.model_name); showSuccess('模型名已复制'); }} />
          </div>
        </Card>

        {/* 价格 — 按次计费 */}
        {isPerCall && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-4'>价格</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {enabledGroups.map((g) => {
                const price = (model.model_price || 0) * g.mul;
                return (
                  <div key={g.name} style={{ padding: '12px 16px', background: '#f9f9f6', borderRadius: 12, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{g.name} (×{g.mul})</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#000', fontFamily: "'JetBrains Mono', monospace" }}>${price.toFixed(4)}<span style={{ fontSize: 12, fontWeight: 400, color: '#999' }}> / 次</span></div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 价格 — 按 Token 计费 */}
        {!isPerCall && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-4'>价格<span style={{ fontSize: 12, fontWeight: 400, color: '#999', marginLeft: 8 }}>$ / 1M tokens</span></div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm' style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontSize: 12, color: '#999', fontWeight: 400, borderBottom: '1px solid #eeeeee' }}>类型</th>
                    {enabledGroups.map((g) => (
                      <th key={g.name} style={{ textAlign: 'right', padding: '8px 0 8px 12px', fontSize: 12, fontWeight: selectedGroup === g.name ? 500 : 400, color: selectedGroup === g.name ? '#000' : '#999', borderBottom: '1px solid #eeeeee' }}>
                        {g.name} (×{g.mul})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <PriceRow label='输入' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul} />
                  <PriceRow label='输出' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul * (model.completion_ratio || 1)} />
                  {model.cache_ratio != null && <PriceRow label='缓存命中' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul * model.cache_ratio} />}
                  {model.create_cache_ratio != null && <PriceRow label='缓存创建' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul * model.create_cache_ratio} />}
                  {model.audio_ratio != null && <PriceRow label='音频输入' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul * model.audio_ratio} />}
                  {model.image_ratio != null && <PriceRow label='图片输入' groups={enabledGroups} compute={(mul) => (model.model_ratio || 0) * 2 * mul * model.image_ratio} />}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 可用分组 + 状态 */}
        <Card>
          <div className='text-sm font-medium text-ui-text-1 mb-3'>可用分组</div>
          <div className='flex flex-wrap gap-1.5'>
            {(model.enable_groups || []).map((g) => {
              const h = healthByGroup[g];
              const status = h?.current?.status || 'unknown';
              const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
              const latency = h?.current?.latency;
              return (
                <div key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, paddingInline: 10, borderRadius: 6, border: '1px solid var(--ui-border)', fontSize: 13 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--ui-text)' }}>{g}</span>
                  {latency != null && <span style={{ fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}>{latency}ms</span>}
                </div>
              );
            })}
            {(model.enable_groups || []).length === 0 && <span className='text-xs text-ui-text-3'>暂无分组信息</span>}
          </div>
        </Card>

        {/* 服务状态心跳 */}
        {health.length > 0 && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-4'>服务状态</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {health.sort((a, b) => a.group.localeCompare(b.group)).map((h) => {
                const status = h.current?.status || 'unknown';
                const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
                const beats = h.history || [];
                const upCount = beats.filter((b) => b.status === 'up').length;
                const uptimePct = beats.length > 0 ? ((upCount / beats.length) * 100).toFixed(1) : '—';
                return (
                  <div key={h.group}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--ui-text)' }}>{h.group}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}>
                        <span>{uptimePct}%</span>
                        <span>{h.current?.latency != null ? `${h.current.latency}ms` : '—'}</span>
                      </div>
                    </div>
                    {beats.length > 0 && (
                      <div style={{ display: 'flex', gap: 1.5, height: 28, alignItems: 'stretch' }}>
                        {beats.slice(0, 50).reverse().map((hb, j) => (
                          <div
                            key={j}
                            title={`${hb.status === 'up' ? '正常' : '异常'} · ${hb.latency}ms`}
                            style={{ flex: '0 0 auto', width: 4, borderRadius: 1.5, background: STATUS_COLORS[hb.status] || STATUS_COLORS.unknown, opacity: hb.status === 'up' ? 0.85 : 1, cursor: 'default' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {model.description && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-2'>模型说明</div>
            <p className='text-sm text-ui-text-2 leading-relaxed'>{model.description}</p>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

const PriceRow = ({ label, groups, compute }) => (
  <tr>
    <td style={{ padding: '10px 12px 10px 0', color: '#000', borderBottom: '1px solid #f5f5f2' }}>{label}</td>
    {groups.map((g) => {
      const val = compute(g.mul);
      return (
        <td key={g.name} style={{ padding: '10px 0 10px 12px', textAlign: 'right', color: '#000', borderBottom: '1px solid #f5f5f2' }}>
          ${val.toFixed(4)}
        </td>
      );
    })}
  </tr>
);

export default ModelDetail;
