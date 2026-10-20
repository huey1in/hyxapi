import { useEffect, useRef, useState } from 'react';
import { errorText, request } from './api';
import type { Settings } from './api';
import { Button, Checkbox, ErrorMessage, Field, Input, SlideOver } from './ui';

export default function DeploymentSettings({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [apiKey, setAPIKey] = useState('');
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController>(undefined);
  const busyRef = useRef(false);
  useEffect(() => { const abort = new AbortController(); controller.current = abort; return () => abort.abort(); }, []);
  const run = async (test = false) => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (test) {
        const result = await request<{ hardware_count: number; total_available: number }>('post', '/api/deployments/settings/test-connection', { api_key: apiKey.trim() }, signal);
        if (!signal.aborted) setNotice(`连接成功：${result.hardware_count} 种硬件，${result.total_available} 个可用资源`);
      } else {
        if (enabled && !clear && !apiKey.trim() && !settings.configured) throw new Error('请先填写 io.net API Key');
        if (apiKey.trim() || clear) await request('put', '/api/option/', { key: 'model_deployment.ionet.api_key', value: clear ? '' : apiKey.trim() }, signal);
        await request('put', '/api/option/', { key: 'model_deployment.ionet.enabled', value: String(enabled && !clear) }, signal);
        if (!signal.aborted) onSaved();
      }
    } catch (cause) { if (!signal.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; if (!signal.aborted) setBusy(false); }
  };
  return <SlideOver open onClose={() => !busy && onClose()} title='io.net 部署配置' footer={<><Button disabled={busy} onClick={onClose}>取消</Button><Button loading={busy} onClick={() => run()}>保存部署配置</Button></>}>
    <div className='space-y-5 p-6'>
      <ErrorMessage message={error} />{notice && <p role='status' className='text-sm text-ui-text-2'>{notice}</p>}
      <Checkbox checked={enabled} disabled={busy || clear} onChange={setEnabled} label='启用 io.net 模型部署' />
      <Field label='io.net API Key'><Input aria-label='io.net API Key' type='password' autoComplete='off' value={apiKey} disabled={busy || clear} onChange={setAPIKey} placeholder={settings.configured ? '已配置，留空保留原值' : '请输入 API Key'} /></Field>
      {settings.configured && <Checkbox checked={clear} disabled={busy} onChange={setClear} label='移除已保存的密钥并停用部署入口' />}
      <Button disabled={busy || clear || (!apiKey.trim() && !settings.configured)} onClick={() => run(true)}>测试 io.net 连接</Button>
      <p className='text-xs text-ui-text-3'>密钥仅保存在服务端。部署费用由 io.net 账户结算，平台钱包不会代扣。</p>
    </div>
  </SlideOver>;
}
