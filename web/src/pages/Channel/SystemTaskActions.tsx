import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Modal } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';

const taskSchema = z.object({
  task_id: z.string().min(1), status: z.string(),
  state: z.object({ progress: z.number().nullish() }).passthrough().nullish(),
  error: z.string().nullish(), result: z.unknown().optional(),
});
type Task = z.infer<typeof taskSchema>;
type TaskType = 'channel_test' | 'model_update';
const labels: Record<string, string> = { pending: 'Waiting', running: 'Running', succeeded: 'Completed', failed: 'Failed' };

export default function SystemTaskActions({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const root = user?.role === 100;
  const canOperate = hasPermission(user, 'channel', 'operate');
  const [confirmation, setConfirmation] = useState<TaskType | null>(null);
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); owner.current = controller;
    return () => { controller.abort(); owner.current = null; };
  }, [user?.id]);
  const taskID = task?.task_id;
  const active = ['pending', 'running'].includes(task?.status ?? '');
  useEffect(() => {
    if (!root || !taskID || !active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = async () => {
      try {
        const { data } = await API.get(`/api/system-task/${encodeURIComponent(taskID)}`, { signal: controller.signal, skipErrorHandler: true });
        controller.signal.throwIfAborted();
        if (!data.success) throw new Error(data.message || t('Unable to load task progress'));
        const parsed = taskSchema.safeParse(data.data);
        if (!parsed.success) throw new Error(t('Unable to load task progress'));
        setTask(parsed.data); setError('');
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('Unable to load task progress')); }
      finally { if (!controller.signal.aborted) timer = setTimeout(() => void update(), 2500); }
    };
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [root, taskID, active, t]);
  const submit = async () => {
    const lifetime = owner.current;
    if (!confirmation || !canOperate || !lifetime || lifetime.signal.aborted || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = confirmation === 'channel_test'
        ? await API.get('/api/channel/test', { signal: lifetime.signal, skipErrorHandler: true })
        : await API.post('/api/channel/upstream_updates/detect_all', undefined, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to create task'));
      const parsed = taskSchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Unable to create task'));
      setTask(parsed.data); setConfirmation(null);
    } catch (cause) {
      if (lifetime.signal.aborted) return;
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const parsed = taskSchema.safeParse(cause.response.data?.data);
        if (parsed.success) setTask(parsed.data);
      }
      const message: unknown = isAxiosError(cause) ? cause.response?.data?.message : undefined;
      setError(typeof message === 'string' ? t(message) : cause instanceof Error ? cause.message : t('Unable to create task')); setConfirmation(null);
    } finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  const close = () => { if (!lock.current) setTask(null); };
  return <div className='mb-4 flex flex-wrap items-center gap-2'>
    {canOperate && <>
      <Button size='sm' variant='toggle' disabled={busy} onClick={() => setConfirmation('channel_test')}>{t('Test all channels')}</Button>
      <Button size='sm' variant='toggle' disabled={busy} onClick={() => setConfirmation('model_update')}>{t('Detect all model updates')}</Button>
    </>}
    {children}
    {root && <Link className='text-xs text-ui-text-3 underline' to='/system-status'>{t('View background task runs')}</Link>}
    {error && !task && <p role='alert' className='w-full text-sm text-ui-danger'>{error}</p>}
    <ConfirmDialog open={!!confirmation} loading={busy} closeOnConfirm={false} onClose={() => { if (!lock.current) setConfirmation(null); }} onConfirm={() => void submit()}
      title={t(confirmation === 'channel_test' ? 'Test all channels' : 'Detect all model updates')} confirmText={t('Start task')} cancelText={t('Cancel')}
      description={t(confirmation === 'channel_test' ? 'Tests all channels. Upstream usage may be billed.' : 'Checks channels with model detection enabled and stages changes for review.')} />
    <Modal open={!!task} title={t('Channel background task')} width={520} onClose={close} onConfirm={close} footer={<Button variant='secondary' onClick={close}>{t('Close')}</Button>}>
      {task && <div className='space-y-3 text-sm'>
        <p className='break-all'>{task.task_id}</p>
        <p>{t(labels[task.status] || task.status)}{typeof task.state?.progress === 'number' ? ` · ${task.state.progress}%` : ''}</p>
        {error && <p role='alert' className='text-ui-danger'>{error}</p>}
        {task.error && <p className='text-ui-danger whitespace-pre-wrap break-all'>{task.error}</p>}
        {task.result != null && <pre className='text-xs whitespace-pre-wrap break-all'>{JSON.stringify(task.result, null, 2)}</pre>}
        {root ? <Link className='text-xs underline' to='/system-status'>{t('View complete task record')}</Link> : <p className='text-xs text-ui-text-3'>{t('The task runs in the background. Refresh the channel list to see changes.')}</p>}
      </div>}
    </Modal>
  </div>;
}
