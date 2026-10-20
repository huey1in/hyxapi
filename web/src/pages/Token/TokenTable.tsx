import { useTranslation } from 'react-i18next';
import { Copy, Pencil, Power, Trash2 } from 'lucide-react';
import { IconButton, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { timestamp2string } from '../../helpers';
import type { TokenListItem, TokenSelection } from './token-management';

type Props = {
  rows?: TokenListItem[];
  loading?: boolean;
  preview?: boolean;
  disabled?: boolean;
  selected?: TokenSelection;
  onSelect?: (rows: TokenListItem[], checked: boolean) => void;
  onCopy?: (row: TokenListItem) => void;
  onToggle?: (row: TokenListItem) => void;
  onEdit?: (row: TokenListItem) => void;
  onDelete?: (row: TokenListItem) => void;
};

export default function TokenTable({ rows = [], loading = false, preview = false, disabled = false, selected = {}, onSelect, onCopy, onToggle, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const columns: TableColumn<TokenListItem>[] = [
    ...(!preview ? [{
      key: 'selection', width: 40,
      title: <input type='checkbox' aria-label={t('Select visible keys')} disabled={disabled || !rows.length || !onSelect}
        checked={!!rows.length && rows.every((row) => !!selected[row.id])}
        onChange={(event) => onSelect?.(rows, event.target.checked)} />,
      render: (row: TokenListItem) => <input type='checkbox' aria-label={t('Select API key {{name}}', { name: row.name })}
        checked={!!selected[row.id]} disabled={disabled || !onSelect} onChange={(event) => onSelect?.([row], event.target.checked)} />,
    }] : []),
    { key: 'name', title: t('Name'), width: 160, render: (row) => <span className='block truncate font-medium' title={row.name || t('Untitled')}>{row.name || t('Untitled')}</span> },
    { key: 'key', title: 'Key', width: 176, render: (row) => <span className='whitespace-nowrap font-mono text-xs text-ui-text-2'>{row.key.startsWith('sk-') ? row.key : `sk-${row.key}`}</span> },
    { key: 'created_time', title: t('Creation date'), width: 156, render: (row) => <span className='whitespace-nowrap text-xs tabular-nums text-ui-text-2'>{row.created_time > 0 ? timestamp2string(row.created_time) : '—'}</span> },
    { key: 'accessed_time', title: t('Last used date'), width: 156, render: (row) => <span className='whitespace-nowrap text-xs tabular-nums text-ui-text-2'>{row.accessed_time > 0 ? timestamp2string(row.accessed_time) : t('Never used')}</span> },
    ...(!preview ? [{
      key: 'actions', title: t('Actions'), width: 144, align: 'right' as const,
      render: (row: TokenListItem) => <div className='inline-flex items-center gap-0.5'>
        <IconButton size='sm' icon={Copy} title={t('Copy')} disabled={disabled || !onCopy} onClick={() => onCopy?.(row)} />
        <IconButton size='sm' icon={Power} title={t(row.status === 1 ? 'Disable API key' : 'Enable API key')} disabled={disabled || !onToggle} onClick={() => onToggle?.(row)} />
        <IconButton size='sm' icon={Pencil} title={t('Edit')} disabled={disabled || !onEdit} onClick={() => onEdit?.(row)} />
        <IconButton size='sm' icon={Trash2} variant='danger' title={t('Delete')} disabled={disabled || !onDelete} onClick={() => onDelete?.(row)} />
      </div>,
    }] : []),
  ];

  return <Table columns={columns} rows={rows} rowKey='id' size='sm' tableLayout='fixed' minWidth={preview ? 648 : 832}
    loading={loading} emptyText={t('No API keys')} rowProps={(row) => ({ 'aria-label': row.name, 'data-token-id': row.id })} />;
}
