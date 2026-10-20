import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { fetchActiveChatKey } from './api';
import { chatLinkRequiresApiKey, resolveChatUrl } from './chat-links';
import { useChatPresets } from './use-chat-presets';
import { PageShell } from './ui';

export default function ChatPage({ redirect = false }: { redirect?: boolean }) {
  const { t } = useTranslation();
  const { chatId = '' } = useParams();
  const navigate = useNavigate();
  const { presets, address, ready } = useChatPresets();
  const ownerId = useAuthStore((state) => state.auth.user?.id);
  const preset = redirect ? presets.find((item) => item.type === 'web') : presets.find((item) => item.id === chatId);
  const identity = `${ownerId}:${preset?.id}:${preset?.url}:${address}:${redirect}`;
  const [prepared, setPrepared] = useState({ identity: '', url: '', error: '' });
  useEffect(() => {
    let active = true;
    if (!preset || preset.type !== 'web' || !ownerId) return;
    (async () => {
      try {
        const apiKey = chatLinkRequiresApiKey(preset.url) ? await fetchActiveChatKey(ownerId) : undefined;
        if (!active || useAuthStore.getState().auth.user?.id !== ownerId) return;
        const url = resolveChatUrl({ template: preset.url, apiKey, serverAddress: address });
        if (!url) throw new Error('无法生成客户端链接');
        if (redirect) window.location.replace(url);
        else setPrepared({ identity, url, error: '' });
      } catch (cause) { if (active) setPrepared({ identity, url: '', error: cause instanceof Error ? cause.message : '无法打开客户端' }); }
    })();
    return () => { active = false; };
  }, [identity, preset, ownerId, address, redirect]);
  const current = prepared.identity === identity ? prepared : undefined;
  if (current?.url) return <div className='h-[calc(100dvh-64px)] min-h-96'><iframe key={identity} title={preset!.name} src={current.url} className='h-full w-full border-0' allow='camera; microphone' referrerPolicy='no-referrer' sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads' /></div>;
  const message = !ready ? '正在加载客户端…' : !preset ? (redirect ? '没有可用的网页聊天客户端' : '聊天客户端不存在或已被移除') : preset.type !== 'web' ? '请从聊天客户端页面打开此外部应用' : current?.error || '正在准备聊天链接…';
  return <PageShell title={preset?.name || t('聊天客户端')}><div className='space-y-4'><p role={current?.error ? 'alert' : 'status'} className='text-sm text-ui-text-2'>{t(message)}</p><div className='flex flex-wrap gap-2'><Button variant='secondary' onClick={() => navigate('/console/chat')}>{t('返回客户端列表')}</Button>{current?.error && <Button onClick={() => navigate('/console/token')}>{t('管理 API key')}</Button>}</div></div></PageShell>;
}
