import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Zap, DollarSign, Layers, Server } from 'lucide-react';
import { API, showError, showSuccess, copy, getLobeHubIcon } from '../../helpers';
import { PageShell, Card, Button, IconButton, Tag, Loading } from '../../components/ui';

const ModelDetail = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedGroup = searchParams.get('group');
  const [model, setModel] = useState(null);
  const [vendors, setVendors] = useState({});
  const [groupRatio, setGroupRatio] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await API.get('/api/pricing');
        if (data.success) {
          const vmap = {};
          (data.vendors || []).forEach((v) => { vmap[v.id] = v; });
          setVendors(vmap);
          setGroupRatio(data.group_ratio || {});
          const found = (data.data || []).find((m) => m.model_name === decodeURIComponent(modelName));
          setModel(found || null);
        } else showError(data.message);
      } catch (e) { showError(e); } finally { setLoading(false); }
    })();
  }, [modelName]);

  if (loading) return <PageShell title='模型详情'><Loading /></PageShell>;
  if (!model) return (
    <PageShell title='模型详情'>
      <Card><p className='text-ui-text-3 text-center py-10'>未找到模型</p></Card>
    </PageShell>
  );

  const vendor = vendors[model.vendor_id];
  const compute = (m, mul = 1) => {
    if (m.quota_type === 1) return `$${((m.model_price || 0) * mul).toFixed(4)} / 次`;
    const p = (m.model_ratio || 0) * 2 * mul;
    const c = p * (m.completion_ratio || 1);
    return `$${p.toFixed(3)} / $${c.toFixed(3)} per 1M tokens`;
  };

  const enabledGroups = (model.enable_groups || [])
    .filter((g) => groupRatio[g] != null)
    .map((g) => ({ name: g, mul: groupRatio[g] }));
  if (enabledGroups.length === 0) enabledGroups.push({ name: '默认', mul: 1 });

  return (
    <PageShell
      title={model.model_name}
      actions={<Button variant='toggle' icon={ArrowLeft} onClick={() => navigate('/pricing')}>返回</Button>}
    >
      <div className='space-y-5' style={{ minHeight: 'calc(100vh - 240px)' }}>
        <Card>
          <div className='flex items-center gap-4 mb-6'>
            <div style={{ width: 48, height: 48, borderRadius: 14, border: '1px solid #e9e9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {vendor?.icon ? getLobeHubIcon(vendor.icon, 28) : <Server size={22} className='text-ui-text-3' />}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='font-mono text-lg font-semibold text-ui-text-1 break-all'>{model.model_name}</div>
              <div className='text-sm text-ui-text-3 mt-0.5'>{vendor?.name || '未知厂商'}{vendor?.description ? ` · ${vendor.description}` : ''}</div>
            </div>
            <IconButton icon={Copy} onClick={() => { copy(model.model_name); showSuccess('模型名已复制'); }} />
          </div>

          <div className='grid grid-cols-2 sm:grid-cols-4 gap-4'>
            <div style={{ padding: '14px 16px', background: '#f9f9f6', borderRadius: 12 }}>
              <div className='flex items-center gap-1.5 text-xs text-ui-text-3 mb-2'><Zap size={12} />计费类型</div>
              <div className='text-sm text-ui-text-1 font-medium'>{model.quota_type === 1 ? '按次计费' : '按 Token 计费'}</div>
            </div>
            <div style={{ padding: '14px 16px', background: '#f9f9f6', borderRadius: 12 }}>
              <div className='flex items-center gap-1.5 text-xs text-ui-text-3 mb-2'><DollarSign size={12} />{selectedGroup ? `${selectedGroup} 价格` : '默认价格'}</div>
              <div className='text-sm text-ui-text-1 font-mono font-medium'>{compute(model, selectedGroup ? (groupRatio[selectedGroup] ?? 1) : 1)}</div>
            </div>
            {model.model_ratio != null && (
              <div style={{ padding: '14px 16px', background: '#f9f9f6', borderRadius: 12 }}>
                <div className='flex items-center gap-1.5 text-xs text-ui-text-3 mb-2'><Layers size={12} />模型倍率</div>
                <div className='text-sm text-ui-text-1 font-mono font-medium'>{model.model_ratio}</div>
              </div>
            )}
            {model.completion_ratio != null && (
              <div style={{ padding: '14px 16px', background: '#f9f9f6', borderRadius: 12 }}>
                <div className='flex items-center gap-1.5 text-xs text-ui-text-3 mb-2'><Layers size={12} />补全倍率</div>
                <div className='text-sm text-ui-text-1 font-mono font-medium'>{model.completion_ratio}</div>
              </div>
            )}
          </div>
        </Card>

        {model.quota_type !== 1 && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-4'>价格明细</div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-ui-border'>
                    <th className='text-left py-2 pr-4 text-xs text-ui-text-3 font-normal'>类型</th>
                    {enabledGroups.map((g) => (
                      <th key={g.name} className='text-right py-2 px-3 text-xs font-normal' style={{ color: selectedGroup === g.name ? '#000' : '#999', fontWeight: selectedGroup === g.name ? 500 : 400 }}>
                        {g.name} (×{g.mul})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='font-mono'>
                  <tr className='border-b border-ui-border/50'>
                    <td className='py-2.5 pr-4 text-ui-text-1'>输入 (Prompt)</td>
                    {enabledGroups.map((g) => {
                      const p = (model.model_ratio || 0) * 2 * g.mul;
                      return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${p.toFixed(4)}</td>;
                    })}
                  </tr>
                  <tr className='border-b border-ui-border/50'>
                    <td className='py-2.5 pr-4 text-ui-text-1'>输出 (Completion)</td>
                    {enabledGroups.map((g) => {
                      const p = (model.model_ratio || 0) * 2 * g.mul;
                      const c = p * (model.completion_ratio || 1);
                      return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${c.toFixed(4)}</td>;
                    })}
                  </tr>
                  {model.cache_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>缓存命中</td>
                      {enabledGroups.map((g) => {
                        const p = (model.model_ratio || 0) * 2 * g.mul * model.cache_ratio;
                        return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${p.toFixed(4)}</td>;
                      })}
                    </tr>
                  )}
                  {model.create_cache_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>缓存创建</td>
                      {enabledGroups.map((g) => {
                        const p = (model.model_ratio || 0) * 2 * g.mul * model.create_cache_ratio;
                        return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${p.toFixed(4)}</td>;
                      })}
                    </tr>
                  )}
                  {model.audio_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>音频输入</td>
                      {enabledGroups.map((g) => {
                        const p = (model.model_ratio || 0) * 2 * g.mul * model.audio_ratio;
                        return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${p.toFixed(4)}</td>;
                      })}
                    </tr>
                  )}
                  {model.image_ratio != null && (
                    <tr>
                      <td className='py-2.5 pr-4 text-ui-text-1'>图片输入</td>
                      {enabledGroups.map((g) => {
                        const p = (model.model_ratio || 0) * 2 * g.mul * model.image_ratio;
                        return <td key={g.name} className='py-2.5 px-3 text-right text-ui-text-1'>${p.toFixed(4)}</td>;
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
              <div className='text-xs text-ui-text-3 mt-3'>单位：$ / 1M tokens</div>
            </div>
          </Card>
        )}

        <Card>
          <div className='text-sm font-medium text-ui-text-1 mb-3'>支持端点</div>
          <div className='flex flex-wrap gap-1.5'>
            {(model.supported_endpoint_types || []).map((e) => <Tag key={e} color='blue'>{e}</Tag>)}
            {(model.supported_endpoint_types || []).length === 0 && <span className='text-xs text-ui-text-3'>暂无端点信息</span>}
          </div>
        </Card>

        <Card>
          <div className='text-sm font-medium text-ui-text-1 mb-3'>可用分组</div>
          <div className='flex flex-wrap gap-1.5'>
            {(model.enable_groups || []).map((g) => (
              <Tag key={g}>{g}{groupRatio[g] && groupRatio[g] !== 1 ? ` (×${groupRatio[g]})` : ''}</Tag>
            ))}
            {(model.enable_groups || []).length === 0 && <span className='text-xs text-ui-text-3'>暂无分组信息</span>}
          </div>
        </Card>

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

export default ModelDetail;
