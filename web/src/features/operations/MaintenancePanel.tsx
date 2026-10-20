import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { showSuccess } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useAuthStore } from '../../stores/auth-store';
import { bytes, errorText, readOperationsData, timestamp } from './api';
import { logFilesSchema, performanceSchema, validLogRetention } from './operations-data';
import { Button, ConfirmDialog, Input, Message, Panel, Select, Table, Pagination } from './ui';

type ActionType = 'gc' | 'reset_stats' | 'disk_cache' | 'logs';
type Action = { type: ActionType; mode: string; value: string };
const titles: Record<ActionType, string> = { gc: 'Run garbage collection', reset_stats: 'Reset cache hit counters', disk_cache: 'Clean inactive disk cache', logs: 'Clean file logs' };
const descriptions: Record<ActionType, string> = { gc: 'Run Go garbage collection now. Request latency may briefly increase.', reset_stats: 'Reset disk and memory cache hit counts while retaining active cache contents.', disk_cache: 'Delete local cache files unused for over 10 minutes, retaining files held by this process.', logs: 'Delete historical file logs using the selected retention policy. Active files are retained. This cannot be undone.' };
function MaintenanceAction({ action, onClose, onSaved }: { action: Action; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t(titles[action.type])} description={<>{t(descriptions[action.type])}{action.type === 'logs' && <span className='mt-2 block'>{t(action.mode === 'by_count' ? 'Keep the latest {{count}} files.' : 'Keep files from the last {{count}} days.', { count: Number(action.value) })}</span>}</>} confirmText={t('Confirm execution')} cancelText={t('Cancel')} onClose={onClose} loading={busy} closeOnConfirm={false} onConfirm={() => void run(async (signal) => {
    if (action.type === 'logs' && !validLogRetention(action.mode, action.value)) throw new Error('Invalid log retention policy');
    const config = { signal, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 }; const path = '/api/performance/'+action.type;
    const { data } = ['logs', 'disk_cache'].includes(action.type) ? await API.delete<ApiEnvelope<unknown>>(path, { ...config, params: action.type === 'logs' ? { mode: action.mode, value: action.value } : undefined }) : await API.post<ApiEnvelope<unknown>>(path, undefined, config);
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to complete operation');
    if (action.type === 'logs') {
      const result = z.object({ deleted_count: z.number().int().nonnegative().safe(), freed_bytes: z.number().int().nonnegative().safe() }).safeParse(data.data);
      showSuccess(result.success ? t('Removed {{count}} log files, freeing {{size}}', { count: result.data.deleted_count, size: bytes(result.data.freed_bytes) }) : t('File log cleanup completed'));
    } else showSuccess(t('Maintenance completed'));
    onSaved(); onClose();
  })} />;
}
function MaintenanceSession({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation(); const [logPage, setLogPage] = useState(1); const [mode, setMode] = useState('by_count'); const [value, setValue] = useState('10'); const [action, setAction] = useState<Action | null>(null);
  const statsQuery = useQuery({ queryKey: ['performance-stats', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readOperationsData('/api/performance/stats', performanceSchema, signal) });
  const logsQuery = useQuery({ queryKey: ['performance-logs', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readOperationsData('/api/performance/logs', logFilesSchema, signal) });
  const stats = statsQuery.isError ? undefined : statsQuery.data; const logs = logsQuery.isError ? undefined : logsQuery.data;
  const page = Math.min(logPage, Math.max(1, Math.ceil((logs?.files.length || 0) / 10))); const refresh = () => { void statsQuery.refetch(); void logsQuery.refetch(); };
  const choose = (type: ActionType) => setAction({ type, mode, value }); const invalidValue = !validLogRetention(mode, value);
  return <Panel title={t('Local maintenance')} actions={<Button size='sm' variant='toggle' onClick={refresh} loading={statsQuery.isFetching || logsQuery.isFetching}>{t('Refresh maintenance data')}</Button>}>
    {(statsQuery.isError || logsQuery.isError) && <div className='space-y-2'><Message error={t(errorText(statsQuery.error || logsQuery.error))} /><Button onClick={refresh}>{t('Retry')}</Button></div>}
    <div className='space-y-4 rounded-2xl border border-ui-border p-4'><div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>{[
      [t('Disk cache hits'), stats?.cache_stats.disk_cache_hits.toLocaleString(i18n.language) ?? '—'], [t('Memory cache hits'), stats?.cache_stats.memory_cache_hits.toLocaleString(i18n.language) ?? '—'], [t('Current heap memory'), stats ? bytes(stats.memory_stats.alloc) : '—'], [t('GC count'), stats?.memory_stats.num_gc.toLocaleString(i18n.language) ?? '—'],
    ].map(([label, text]) => <div key={label}><p className='text-xs text-ui-text-3'>{label}</p><p className='mt-1 text-lg font-semibold tabular-nums text-ui-text'>{text}</p></div>)}</div>
      {stats && <div className='space-y-1 break-all text-xs text-ui-text-3'><p>{t('Cache directory: {{path}} · {{count}} files / {{size}}', { path: stats.disk_cache_info.path, count: stats.disk_cache_info.file_count, size: bytes(stats.disk_cache_info.total_size) })}</p><p>{t('Overload protection: {{state}}. New requests pause after three consecutive threshold violations.', { state: stats.config.monitor_enabled ? t('Enabled at CPU {{cpu}}% / memory {{memory}}% / disk {{disk}}%', { cpu: stats.config.monitor_cpu_threshold, memory: stats.config.monitor_memory_threshold, disk: stats.config.monitor_disk_threshold }) : t('Disabled') })}</p></div>}
      <div className='flex flex-wrap gap-2'>{(['gc', 'reset_stats', 'disk_cache'] as const).map((type) => <Button key={type} size='sm' disabled={Boolean(action)} onClick={() => choose(type)}>{t(titles[type])}</Button>)}</div>
    </div>
    <div className='space-y-3 rounded-2xl border border-ui-border p-4'><div className='flex flex-wrap justify-between gap-2'><h3 className='text-sm font-semibold text-ui-text'>{t('File logs')}</h3><span className='text-xs text-ui-text-3'>{logs?.enabled ? t('{{count}} files / {{size}}', { count: logs.file_count, size: bytes(logs.total_size) }) : logs ? t('File logging is not configured') : '—'}</span></div>
      {logs?.enabled && <><p className='break-all text-xs text-ui-text-3'>{t('{{path}} · Use system tasks to clean usage logs.', { path: logs.log_dir })}</p><div className='flex flex-wrap items-end gap-3'>
        <label className='grid gap-1.5 text-xs text-ui-text-3'>{t('Retention policy')}<Select aria-label={t('Retention policy')} value={mode} disabled={Boolean(action)} onChange={setMode} options={[{ value: 'by_count', label: t('Keep latest file count') }, { value: 'by_days', label: t('Keep recent days') }]} /></label>
        <label className='grid gap-1.5 text-xs text-ui-text-3'>{t('Retention amount')}<Input aria-label={t('Log retention amount')} type='number' min='1' step='1' value={value} disabled={Boolean(action)} onChange={setValue} width='110px' /></label><Button size='sm' disabled={Boolean(action) || invalidValue || !logs.file_count} onClick={() => choose('logs')}>{t('Clean file logs')}</Button>
      </div><Table rows={logs.files.slice((page - 1) * 10, page * 10)} rowKey='name' minWidth={500} emptyText={t('No log files')} columns={[
        { key: 'name', title: t('File'), render: (row) => <span className='text-xs'>{row.name}{row.active && <span className='ml-2 text-ui-text-3'>{t('Being written')}</span>}</span> }, { key: 'size', title: t('Size'), render: (row) => bytes(row.size) }, { key: 'date', title: t('Modified at'), render: (row) => <span className='whitespace-nowrap text-xs'>{timestamp(row.mod_time, i18n.language)}</span> },
      ]} /><Pagination page={page} pageSize={10} total={logs.files.length} onChange={setLogPage} /></>}
    </div>
    {action && <MaintenanceAction key={action.type} action={action} onClose={() => setAction(null)} onSaved={refresh} />}
  </Panel>;
}
export default function MaintenancePanel() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const root = useAuthStore((state) => state.auth.user?.role === 100);
  return root ? <MaintenanceSession key={identity} identity={identity} /> : null;
}
