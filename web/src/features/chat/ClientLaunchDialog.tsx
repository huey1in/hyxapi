import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { API } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import { fetchActiveChatKey } from './api';
import { buildCCSwitchURL, chatLinkRequiresApiKey, resolveChatUrl, sendToFluent, type ChatPreset } from './chat-links';
import { useChatPresets } from './use-chat-presets';
import { Input, Select, SlideOver } from './ui';

type Props = { preset?: ChatPreset; tokenKey?: string; onClose: () => void };
export default function ClientLaunchDialog({ preset, tokenKey, onClose }: Props) {
  const { t } = useTranslation();
  const { presets, address } = useChatPresets();
  const ownerId = useAuthStore((state) => state.auth.user?.id);
  const [selectedId, setSelectedId] = useState(preset?.id || presets[0]?.id || '');
  const [app, setApp] = useState<'claude' | 'codex' | 'gemini'>('claude');
  const [name, setName] = useState('Hyxware');
  const [models, setModels] = useState<Record<string, string>>({ model: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const modelListId = useId();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selected = preset || presets.find((item) => item.id === selectedId);
  useEffect(() => {
    if (selected?.url !== 'ccswitch' || !ownerId) return;
    const controller = new AbortController();
    API.get('/api/user/models', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted && useAuthStore.getState().auth.user?.id === ownerId && data.success && Array.isArray(data.data)) setModelOptions(data.data.filter((item: unknown): item is string => typeof item === 'string'));
    }).catch(() => {});
    return () => controller.abort();
  }, [selected?.url, ownerId]);
  const open = async () => {
    if (!selected || !ownerId || busy) return;
    const web = selected.type === 'web';
    const popup = web ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    setBusy(true); setError('');
    try {
      const key = chatLinkRequiresApiKey(selected.url) ? tokenKey ?? await fetchActiveChatKey(ownerId) : '';
      if (!mounted.current || useAuthStore.getState().auth.user?.id !== ownerId) { popup?.close(); return; }
      if (selected.type === 'fluent') {
        if (!sendToFluent(key, address)) throw new Error('未检测到流畅阅读扩展，请先安装并启用扩展');
      } else {
        const url = selected.url === 'ccswitch' ? buildCCSwitchURL(app, name, models, key, address) : resolveChatUrl({ template: selected.url, apiKey: key, serverAddress: address });
        if (!url) throw new Error(selected.url === 'ccswitch' ? '请填写主模型' : '无法生成客户端链接');
        if (web) {
          if (!popup) throw new Error('浏览器阻止了新窗口，请允许弹出窗口后重试');
          popup.location.replace(url);
        } else window.location.assign(url);
      }
      onClose();
    } catch (cause) { popup?.close(); if (mounted.current) setError(cause instanceof Error ? cause.message : '无法打开客户端'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <SlideOver open onClose={onClose} title={t('打开聊天客户端')} width={500} footer={<><Button variant='secondary' onClick={onClose}>{t('取消')}</Button><Button onClick={open} loading={busy} disabled={!selected || busy || (selected.url === 'ccswitch' && !models.model?.trim())}>{t('打开客户端')}</Button></>}>
    <div className='space-y-4 px-4 py-3 md:px-6'>
      {preset ? <p className='text-sm text-ui-text'>{preset.name}</p> : <label className='grid gap-2 text-sm text-ui-text'>{t('聊天客户端')}<Select disabled={busy} value={selectedId} onChange={(id) => { setSelectedId(id); setError(''); }} options={presets.map((item) => ({ value: item.id, label: item.name }))} /></label>}
      {selected?.url === 'ccswitch' && <>
        <label className='grid gap-2 text-sm text-ui-text'>{t('应用')}<Select value={app} onChange={(value) => { setApp(value as typeof app); setModels({ model: '' }); }} options={[{ value: 'claude', label: 'Claude' }, { value: 'codex', label: 'Codex' }, { value: 'gemini', label: 'Gemini' }]} /></label>
        <label className='grid gap-2 text-sm text-ui-text'>{t('配置名称')}<Input value={name} onChange={setName} /></label>
        <datalist id={modelListId}>{modelOptions.map((model) => <option key={model} value={model} />)}</datalist>
        {(app === 'claude' ? ['model', 'haikuModel', 'sonnetModel', 'opusModel'] : ['model']).map((field) => <label key={field} className='grid gap-2 text-sm text-ui-text'>{field === 'model' ? t('主模型') : field}<Input list={modelListId} value={models[field] || ''} onChange={(value) => setModels((previous) => ({ ...previous, [field]: value }))} required={field === 'model'} /></label>)}
      </>}
      {error && <p role='alert' className='text-sm text-red-600'>{t(error)}</p>}
    </div>
  </SlideOver>;
}
