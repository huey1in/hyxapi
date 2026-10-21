import { useTranslation } from 'react-i18next';
import { Button, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { renderQuota, timestamp2string } from '../../helpers';
import { feedModel, feedStatus } from './feed-data';
import type { FeedRow } from './feed-data';
import { Num, Quota, TruncatedField, TypeBadge } from './LogCells';
import { taskStatusLabels } from './task-data';

export default function LogsTable({ rows = [], loading = false, all = false, onSelect }: { rows?: FeedRow[]; loading?: boolean; all?: boolean; onSelect?: (row: FeedRow) => void }) {
  const { t } = useTranslation();
  const columns: TableColumn<FeedRow>[] = [
    { key: 'time', title: t('Time'), width: 150, render: (row) => <span className='whitespace-nowrap text-xs text-ui-text-2'>{timestamp2string(Math.floor(row.time / 1000))}</span> },
    { key: 'type', title: t('Type'), width: 100, render: (row) => row.source === 'usage' ? <TypeBadge type={row.log.type} /> : <span className='whitespace-nowrap text-sm'>{t(row.source === 'tasks' ? 'Async tasks' : 'Midjourney')}</span> },
    { key: 'model', title: t('Model / task'), width: 175, mobileRole: 'wide', render: (row) => <div className='min-w-0'><TruncatedField value={feedModel(row)} /><span className='block truncate text-xs text-ui-text-3' title={row.source === 'usage' ? row.log.token_name || undefined : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id}>{row.source === 'usage' ? row.log.token_name || '—' : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id}</span></div> },
    { key: 'status', title: t('Status'), width: 85, render: (row) => {
      const status = feedStatus(row); const progress = row.source === 'tasks' ? row.task.progress : row.source === 'midjourney' ? row.midjourney.progress : '';
      return <div className={status === 'FAILURE' ? 'text-ui-danger' : undefined}>{status ? t(taskStatusLabels[status] || status) : '—'}{progress && status !== 'SUCCESS' && status !== 'FAILURE' && <div className='text-xs text-ui-text-3'>{progress}</div>}</div>;
    } },
    { key: 'tokens', title: 'Tokens', width: 125, align: 'right', render: (row) => row.source === 'usage' ? <div><Num value={row.log.prompt_tokens + row.log.completion_tokens} /><div className='text-xs text-ui-text-3'>{t('Input')} {row.log.prompt_tokens} · {t('Output')} {row.log.completion_tokens}</div></div> : <span className='text-ui-text-3'>—</span> },
    { key: 'quota', title: t('Cost'), width: 95, align: 'right', render: (row) => row.source === 'usage' ? <Quota row={row.log} /> : <span className='tabular-nums'>{renderQuota(row.source === 'tasks' ? row.task.quota : row.midjourney.quota, 4)}</span> },
    ...(all ? [{ key: 'user', title: t('User / channel'), width: 100, render: (row: FeedRow) => <div><TruncatedField value={row.source === 'usage' ? row.log.username : row.source === 'tasks' ? row.task.username || String(row.task.user_id) : String(row.midjourney.user_id)} /><div className='text-xs text-ui-text-3'>#{row.source === 'usage' ? row.log.channel : row.source === 'tasks' ? row.task.channel_id : row.midjourney.channel_id}</div></div> }] : []),
    { key: 'details', title: t('Details'), width: 60, align: 'right', mobileRole: 'actions', render: (row) => <Button size='sm' variant='link' onClick={(event) => { event.stopPropagation(); onSelect?.(row); }}>{t('Details')}</Button> },
  ];
  return <Table className='logs-table' loading={loading} rows={rows} rowKey='key' columns={columns} tableLayout='fixed' minWidth={all ? 890 : 790} emptyText={t('No logs')} onRowClick={onSelect} rowProps={onSelect ? (row) => ({ tabIndex: 0, 'aria-label': row.source === 'usage' ? row.log.request_id || feedModel(row) || t('System operation') : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row); } } }) : undefined} />;
}
