import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, FormField, Input, Modal, Select } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { hasPermission } from '../../lib/admin-permissions';

type Props = { channel: { id: number; name: string }; onClose: () => void; onCopied: () => void };

export default function CopyChannelDialog({ channel, onClose, onCopied }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [suffix, setSuffix] = useState('_copy');
  const [reset, setReset] = useState('reset');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner;
    return () => { owner.abort(); lifetime.current = null; };
  }, [user?.id, channel.id]);
  const copy = async () => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || lock.current || !hasPermission(user, 'channel', 'sensitive_write')) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const query = new URLSearchParams({ suffix, reset_balance: String(reset === 'reset') });
      const { data } = await API.post(`/api/channel/copy/${channel.id}?${query}`, {}, { signal: owner.signal, skipErrorHandler: true });
      owner.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to copy channel'));
      onCopied();
    } catch (cause) { if (!owner.signal.aborted) setError(cause instanceof Error ? cause.message : t('Unable to copy channel')); }
    finally { if (!owner.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  const close = () => { if (!lock.current) onClose(); };
  return <Modal open title={t('Copy channel')} onClose={close} onConfirm={() => void copy()} width={420} footer={<>
    <Button variant='secondary' disabled={busy} onClick={close}>{t('Cancel')}</Button><Button loading={busy} onClick={() => void copy()}>{t('Create copy')}</Button>
  </>}>
    <p className='text-sm text-ui-text-2 break-all'>{t('The copy includes channel credentials and configuration.')}</p>
    <FormField label={t('Name suffix')} hint={<span className='break-all'>{channel.name}{suffix}</span>}>
      <Input id='channel-copy-suffix' value={suffix} maxLength={100} disabled={busy} onChange={setSuffix} />
    </FormField>
    <FormField label={t('Balance and usage counters')}>
      <Select popover id='channel-copy-counters' value={reset} disabled={busy} onChange={setReset} options={[
        { value: 'reset', label: t('Reset counters in the copy') }, { value: 'preserve', label: t('Preserve counters in the copy') },
      ]} width='full' />
    </FormField>
    {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
  </Modal>;
}
