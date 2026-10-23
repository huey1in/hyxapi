import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import { Button, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { renderQuota, timestamp2string } from '../../helpers';
import { feedModel } from './feed-data';
import type { FeedRow } from './feed-data';
import { Quota, TokenUsage, TruncatedField, TypeBadge } from './LogCells';

export default function LogsTable({ rows = [], loading = false, all = false, onSelect }: { rows?: FeedRow[]; loading?: boolean; all?: boolean; onSelect?: (row: FeedRow) => void }) {
  const { t } = useTranslation();
  const columns: TableColumn<FeedRow>[] = [
    { key: 'time', title: t('Time'), width: all ? '18%' : '20%', render: (row) => <span className='text-sm text-ui-text-2 [overflow-wrap:normal]'>{timestamp2string(Math.floor(row.time / 1000))}</span> },
    { key: 'type', title: t('Type'), width: all ? '9%' : '10%', render: (row) => row.source === 'usage' ? <TypeBadge type={row.log.type} /> : <span className='block truncate' title={t(row.source === 'tasks' ? 'Async tasks' : 'Midjourney')}>{t(row.source === 'tasks' ? 'Async tasks' : 'Midjourney')}</span> },
    { key: 'model', title: t('Model / task'), mobileRole: 'wide', render: (row) => <div className='min-w-0'><TruncatedField value={feedModel(row)} /><span className='block truncate text-sm text-ui-text-3' title={row.source === 'usage' ? row.log.token_name || undefined : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id}>{row.source === 'usage' ? row.log.token_name || '—' : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id}</span></div> },
    { key: 'tokens', title: 'Tokens', width: all ? '24%' : '25%', align: 'right', render: (row) => row.source === 'usage' ? <TokenUsage row={row.log} /> : <span className='text-ui-text-3'>—</span> },
    { key: 'quota', title: t('Cost'), width: all ? '12%' : '13%', align: 'right', render: (row) => row.source === 'usage' ? <Quota row={row.log} /> : <span className='tabular-nums'>{renderQuota(row.source === 'tasks' ? row.task.quota : row.midjourney.quota, 4)}</span> },
    ...(all ? [{ key: 'user', title: t('User / channel'), width: '10%', render: (row: FeedRow) => <div><TruncatedField value={row.source === 'usage' ? row.log.username : row.source === 'tasks' ? row.task.username || String(row.task.user_id) : String(row.midjourney.user_id)} /><div className='text-sm text-ui-text-3'>#{row.source === 'usage' ? row.log.channel : row.source === 'tasks' ? row.task.channel_id : row.midjourney.channel_id}</div></div> }] : []),
    { key: 'details', title: t('Details'), width: 68, align: 'right', mobileRole: 'actions', render: (row) => <Button variant='link' onClick={(event) => { event.stopPropagation(); onSelect?.(row); }}>{t('Details')}</Button> },
  ];
  return <Table className='logs-table' loading={loading} rows={rows} rowKey='key' columns={columns} tableLayout='fixed' emptyIcon={ScrollText} emptyText={t('No logs')} onRowClick={onSelect} rowProps={onSelect ? (row) => ({ tabIndex: 0, 'aria-label': row.source === 'usage' ? row.log.request_id || feedModel(row) || t('System operation') : row.source === 'tasks' ? row.task.task_id : row.midjourney.mj_id, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(row); } } }) : undefined} />;
}
