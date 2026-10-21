import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { timestamp2string } from '../../helpers';
import { Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import useIsMobile from '../../hooks/useIsMobile';
import { enrichLog, logSchema } from './log-data';
import type { EnrichedLog } from './log-data';
import { Num, Quota, TruncatedField, TypeBadge } from './LogCells';

const PREVIEW_MODELS = ['gpt-4.1', 'claude-sonnet-4', 'gemini-2.5-flash', 'deepseek-chat', 'grok-4', 'mistral-large'];
const PREVIEW_USAGE = [
  { input: 12840, output: 3240, cache: 11200, frt: 186 },
  { input: 7640, output: 1180, cache: 6140, frt: 241 },
  { input: 23180, output: 6840, cache: 18900, frt: 328 },
  { input: 9820, output: 2360, cache: 0, frt: 214 },
  { input: 31560, output: 9120, cache: 22400, frt: 472 },
  { input: 6740, output: 840, cache: 5800, frt: 163 },
  { input: 18720, output: 4560, cache: 13600, frt: 296 },
  { input: 44200, output: 12700, cache: 30700, frt: 538 },
  { input: 15480, output: 3280, cache: 0, frt: 257 },
];
const PREVIEW_LOGS = Array.from({ length: 9 }, (_, index) => logSchema.parse({
  id: index + 1,
  created_at: Math.floor(Date.now() / 1000) - index * 17,
  type: 2,
  model_name: PREVIEW_MODELS[index % PREVIEW_MODELS.length],
  token_name: index % 2 ? 'development' : 'production',
  group: index % 3 ? 'default' : 'production',
  prompt_tokens: PREVIEW_USAGE[index].input,
  completion_tokens: PREVIEW_USAGE[index].output,
  quota: 286 + index * 73,
  use_time: 0.68 + index * 0.11,
  other: JSON.stringify({ frt: PREVIEW_USAGE[index].frt, cache_tokens: PREVIEW_USAGE[index].cache }),
}));

export default function LogPreview() {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const rows = useMemo(() => PREVIEW_LOGS.map((row) => enrichLog(row, 0)), []);
  const columns: TableColumn<EnrichedLog>[] = mobile ? [
    { key: 'model', title: t('Model'), render: (row) => <TruncatedField value={row.model_name} /> },
    { key: 'input', title: t('Input'), align: 'right', render: (row) => <Num value={row.prompt_tokens} compact /> },
    { key: 'output', title: t('Output'), align: 'right', render: (row) => <Num value={row.completion_tokens} compact /> },
    { key: 'cache', title: t('Cache'), align: 'right', render: (row) => <Num value={row._cache} compact /> },
  ] : [
    { key: 'time', title: t('Time'), width: 175, render: (row) => <span className='whitespace-nowrap text-ui-text-2'>{timestamp2string(row.created_at)}</span> },
    { key: 'type', title: t('Type'), width: 135, render: (row) => <TypeBadge type={row.type} /> },
    { key: 'model', title: t('Model'), width: 150, render: (row) => <TruncatedField value={row.model_name} /> },
    { key: 'token', title: t('Token'), width: 110, render: (row) => <TruncatedField value={row.token_name} muted /> },
    { key: 'group', title: t('Group'), width: 96, render: (row) => <TruncatedField value={row.group} muted /> },
    { key: 'input', title: t('Input'), align: 'right', width: 88, render: (row) => <Num value={row.prompt_tokens} compact /> },
    { key: 'output', title: t('Output'), align: 'right', width: 88, render: (row) => <Num value={row.completion_tokens} compact /> },
    { key: 'cache', title: t('Cache'), align: 'right', width: 88, render: (row) => <Num value={row._cache} compact /> },
    { key: 'frt', title: t('First response'), align: 'right', width: 100, render: (row) => <span className='whitespace-nowrap text-ui-text-2'>{row._other.frt}ms</span> },
    { key: 'quota', title: t('Quota'), align: 'right', width: 100, render: (row) => <Quota row={row} /> },
  ];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 20 : 28, width: '100%', maxWidth: 1160, marginInline: 'auto', padding: mobile ? 16 : '24px 16px', minWidth: 0, overflow: 'hidden' }}>
    <h1 className='text-lg font-semibold text-ui-text'>{t('Usage logs')}</h1>
    <div className={mobile ? 'log-table-mobile' : undefined} style={{ fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace", maxWidth: '100%', minWidth: 0 }}>
      <Table rows={rows} rowKey='id' columns={columns} minWidth={0} />
    </div>
  </div>;
}
