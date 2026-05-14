import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Zap, DollarSign, Layers, Server } from 'lucide-react';
import { API, showError, showSuccess, copy, getLobeHubIcon } from '../../helpers';
import { PageShell, Card, Button, IconButton, Tag, Loading } from '../../components/ui';

const ModelDetail = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();
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

  const promptPrice = model.quota_type !== 1 ? (model.model_ratio || 0) * 2 : null;
  const completionPrice = promptPrice ? promptPrice * (model.completion_ratio || 1) : null;

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
              <div className='flex items-center gap-1.5 text-xs text-ui-text-3 mb-2'><DollarSign size={12} />默认价格</div>
              <div className='text-sm text-ui-text-1 font-mono font-medium'>{compute(model)}</div>
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
                    <th className='text-right py-2 px-4 text-xs text-ui-text-3 font-normal'>每 1M tokens</th>
                    <th className='text-right py-2 px-4 text-xs text-ui-text-3 font-normal'>每 1K tokens</th>
                    <th className='text-right py-2 pl-4 text-xs text-ui-text-3 font-normal'>每 1 token</th>
                  </tr>
                </thead>
                <tbody className='font-mono'>
                  <tr className='border-b border-ui-border/50'>
                    <td className='py-2.5 pr-4 text-ui-text-1'>输入 (Prompt)</td>
                    <td className='py-2.5 px-4 text-right text-ui-text-1'>${promptPrice?.toFixed(4)}</td>
                    <td className='py-2.5 px-4 text-right text-ui-text-2'>${(promptPrice / 1000)?.toFixed(6)}</td>
                    <td className='py-2.5 pl-4 text-right text-ui-text-3'>${(promptPrice / 1000000)?.toFixed(9)}</td>
                  </tr>
                  <tr className='border-b border-ui-border/50'>
                    <td className='py-2.5 pr-4 text-ui-text-1'>输出 (Completion)</td>
                    <td className='py-2.5 px-4 text-right text-ui-text-1'>${completionPrice?.toFixed(4)}</td>
                    <td className='py-2.5 px-4 text-right text-ui-text-2'>${(completionPrice / 1000)?.toFixed(6)}</td>
                    <td className='py-2.5 pl-4 text-right text-ui-text-3'>${(completionPrice / 1000000)?.toFixed(9)}</td>
                  </tr>
                  {model.cache_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>缓存命中</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-1'>${(promptPrice * model.cache_ratio)?.toFixed(4)}</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-2'>${(promptPrice * model.cache_ratio / 1000)?.toFixed(6)}</td>
                      <td className='py-2.5 pl-4 text-right text-ui-text-3'>×{model.cache_ratio}</td>
                    </tr>
                  )}
                  {model.create_cache_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>缓存创建</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-1'>${(promptPrice * model.create_cache_ratio)?.toFixed(4)}</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-2'>${(promptPrice * model.create_cache_ratio / 1000)?.toFixed(6)}</td>
                      <td className='py-2.5 pl-4 text-right text-ui-text-3'>×{model.create_cache_ratio}</td>
                    </tr>
                  )}
                  {model.audio_ratio != null && (
                    <tr className='border-b border-ui-border/50'>
                      <td className='py-2.5 pr-4 text-ui-text-1'>音频输入</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-1'>${(promptPrice * model.audio_ratio)?.toFixed(4)}</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-2'>-</td>
                      <td className='py-2.5 pl-4 text-right text-ui-text-3'>×{model.audio_ratio}</td>
                    </tr>
                  )}
                  {model.image_ratio != null && (
                    <tr>
                      <td className='py-2.5 pr-4 text-ui-text-1'>图片输入</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-1'>${(promptPrice * model.image_ratio)?.toFixed(4)}</td>
                      <td className='py-2.5 px-4 text-right text-ui-text-2'>-</td>
                      <td className='py-2.5 pl-4 text-right text-ui-text-3'>×{model.image_ratio}</td>
                    </tr>
                  )}
                </tbody>
              </table>
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

        {Object.keys(groupRatio).length > 0 && (
          <Card>
            <div className='text-sm font-medium text-ui-text-1 mb-4'>分组价格对比</div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
              {Object.entries(groupRatio).map(([g, mul]) => (
                <div key={g} style={{ padding: '14px 16px', border: '1px solid #e9e9e9', borderRadius: 12 }}>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm text-ui-text-1 font-medium'>{g}</span>
                    <span className='text-xs text-ui-text-3 font-mono'>×{mul}</span>
                  </div>
                  <div className='text-sm text-ui-text-1 font-mono'>{compute(model, mul)}</div>
                </div>
              ))}
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

export default ModelDetail;
