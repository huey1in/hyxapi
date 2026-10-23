import { useTranslation } from 'react-i18next';
import { Copy, Download, KeyRound, Pencil, Power, Trash2 } from 'lucide-react';
import { EmptyState, IconButton, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { timestamp2string } from '../../helpers';
import { TOKEN_PAGE_SIZE } from './token-management';
import type { TokenListItem } from './token-management';

type Props = {
  rows?: TokenListItem[];
  loading?: boolean;
  disabled?: boolean;
  onCopy?: (row: TokenListItem) => void;
  onToggle?: (row: TokenListItem) => void;
  onEdit?: (row: TokenListItem) => void;
  onDelete?: (row: TokenListItem) => void;
  onImport?: (row: TokenListItem) => void;
};

export default function TokenTable({ rows = [], loading = false, disabled = false, onCopy, onToggle, onEdit, onDelete, onImport }: Props) {
  const { t } = useTranslation();
  const columns: TableColumn<TokenListItem>[] = [
    { key: 'name', title: t('Name'), width: 160, mobileRole: 'wide', render: (row) => <span className='block truncate font-medium' title={row.name || t('Untitled')}>{row.name || t('Untitled')}</span> },
    { key: 'key', title: 'Key', width: 208, mobileRole: 'wide', render: (row) => <span className='whitespace-nowrap font-mono'>{row.key.startsWith('sk-') ? row.key : `sk-${row.key}`}</span> },
    { key: 'created_time', title: t('Creation date'), width: 168, render: (row) => <span className='whitespace-nowrap tabular-nums'>{row.created_time > 0 ? timestamp2string(row.created_time) : '—'}</span> },
    { key: 'accessed_time', title: t('Last used date'), width: 168, render: (row) => <span className='whitespace-nowrap tabular-nums'>{row.accessed_time > 0 ? timestamp2string(row.accessed_time) : t('Never used')}</span> },
    {
      key: 'actions', title: t('Actions'), width: 176, align: 'right', mobileRole: 'actions',
      render: (row: TokenListItem) => <div className='inline-flex items-center gap-0.5'>
        <IconButton size='sm' icon={Copy} title={t('Copy')} disabled={disabled || !onCopy} onClick={() => onCopy?.(row)} />
        <IconButton size='sm' icon={Download} title={t('Import to CC Switch')} disabled={disabled || !onImport} onClick={() => onImport?.(row)} />
        <IconButton size='sm' icon={Power} title={t(row.status === 1 ? 'Disable API key' : 'Enable API key')} disabled={disabled || !onToggle} onClick={() => onToggle?.(row)} />
        <IconButton size='sm' icon={Pencil} title={t('Edit')} disabled={disabled || !onEdit} onClick={() => onEdit?.(row)} />
        <IconButton size='sm' icon={Trash2} variant='danger' title={t('Delete')} disabled={disabled || !onDelete} onClick={() => onDelete?.(row)} />
      </div>,
    },
  ];

  return <Table className='api-key-table' columns={columns} rows={rows} rowKey='id' size='sm' tableLayout='fixed' minWidth={880}
    loading={loading} skeletonRows={TOKEN_PAGE_SIZE}
    emptyText={<div className='api-key-empty-state'><EmptyState icon={KeyRound} iconVariant='plain' title={t('No API keys')} /></div>}
    rowProps={(row) => ({ 'aria-label': row.name, 'data-token-id': row.id })} />;
}
