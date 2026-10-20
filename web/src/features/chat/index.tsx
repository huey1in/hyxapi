import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import ClientLaunchDialog from './ClientLaunchDialog';
import { useChatPresets } from './use-chat-presets';
import type { ChatPreset } from './chat-links';
import { PageShell } from './ui';

function ClientsSession() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { presets, ready } = useChatPresets();
  const [selected, setSelected] = useState<ChatPreset>();
  return <PageShell title={t('聊天客户端')}>
    {!ready ? <p role='status'>{t('正在加载客户端…')}</p> : !presets.length ? <p className='text-sm text-ui-text-3'>{t('管理员尚未配置聊天客户端')}</p> : <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
      {presets.map((preset) => <section key={preset.id} className='flex min-w-0 flex-col gap-4 rounded-3xl border border-ui-border p-5'>
        <h2 className='break-words text-sm font-medium text-ui-text'>{preset.name}</h2>
        <div><Button size='sm' onClick={() => preset.type === 'web' ? navigate(`/console/chat/${preset.id}`) : setSelected(preset)}>{t(preset.type === 'web' ? '打开会话' : '打开客户端')}</Button></div>
      </section>)}
    </div>}
    {selected && <ClientLaunchDialog key={selected.id} preset={selected} onClose={() => setSelected(undefined)} />}
  </PageShell>;
}
export default function ClientsPage() { const ownerId = useAuthStore((state) => state.auth.user?.id); return <ClientsSession key={ownerId} />; }
