import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Activity,
  RefreshCw,
  CheckSquare,
  Square,
  Tag as TagIcon,
  Gauge,
  KeyRound,
  Copy,
  HardDrive,
  Wallet,
  Search,
  SlidersHorizontal,
  Radio,
} from 'lucide-react';
import { showError, showSuccess, renderQuota } from '../../helpers';
import {
  PageShell,
  Button,
  IconButton,
  Input,
  Select,
  Table,
  Pagination,
  Tag,
  ConfirmDialog,
} from '../../components/ui';
import { priorityMove, priorityRestore } from './priority';
import { useAuthStore } from '../../stores/auth-store';
import SystemTaskActions from './SystemTaskActions';
import InferenceStatusDialog from './InferenceStatus';
import CodexUsageDialog from './CodexUsage';
import MultiKeyManager from './MultiKeyManager';
import CopyChannelDialog from './CopyChannel';
import BalanceQuery, { QueryAllBalances } from './BalanceQuery';
import TagManagement, { AssignChannelTag } from './TagManagement';
import OllamaModels from './OllamaModels';
import UpstreamUpdates, { ApplyAllUpstreamUpdates } from './UpstreamUpdates';
import { hasPermission } from '../../lib/admin-permissions';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useLiveSearch } from '../../hooks/useLiveSearch';
import useIsMobile from '../../hooks/useIsMobile';
import { apiErrorMessage } from '../../lib/api-error';
import { channelPageSchema, priorityOrderSchema } from './channel-data';
import type { Channel, EditingChannel } from './channel-data';
import type { PriorityOrder, Placement } from './priority';
import { channelRequest } from './channel-query';
import ChannelEditModal from './ChannelEditor';
import ChannelTestModal from './ChannelTester';
import ChannelFiltersDialog, { DEFAULT_CHANNEL_FILTERS } from './ChannelFiltersDialog';
import type { ChannelFilterValues } from './ChannelFiltersDialog';
const PAGE_SIZE = 20;
const STATUS_TAG = {
  1: { color: 'green', text: '启用' },
  2: { color: 'red', text: '禁用' },
  3: { color: 'amber', text: '自动禁用' },
} as const;
type PriorityRequest =
  | NonNullable<ReturnType<typeof priorityMove>>
  | ReturnType<typeof priorityRestore>;
type Filters = ChannelFilterValues & {
  page: number;
  keyword: string;
  tag: boolean;
};
function ChannelSession({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const selectionID = useId();
  const client = useQueryClient();
  const { busy, run } = useOwnedOperation();
  const [keyword, setKeyword] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const [applied, setApplied] = useState<Filters>({
    ...DEFAULT_CHANNEL_FILTERS,
    page: 1,
    keyword: '',
    tag: false,
  });
  const activeFilters = (Object.keys(DEFAULT_CHANNEL_FILTERS) as (keyof ChannelFilterValues)[])
    .filter((key) => applied[key] !== DEFAULT_CHANNEL_FILTERS[key]).length;
  const [editing, setEditing] = useState<EditingChannel | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    ids: number[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [testing, setTesting] = useState<Channel | null>(null);
  const [inference, setInference] = useState<Channel | null>(null);
  const [codexUsage, setCodexUsage] = useState<Channel | null>(null);
  const [multiKeys, setMultiKeys] = useState<Channel | null>(null);
  const [copying, setCopying] = useState<Channel | null>(null);
  const [ollama, setOllama] = useState<Channel | null>(null);
  const [upstreamUpdates, setUpstreamUpdates] = useState<Channel | null>(null);
  const [balanceQuery, setBalanceQuery] = useState<Channel | null>(null);
  const [managedTag, setManagedTag] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const [placement, setPlacement] = useState<Placement>('before');
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [priorityUndo, setPriorityUndo] = useState<ReturnType<
    typeof priorityRestore
  > | null>(null);
  const [priorityPreview, setPriorityPreview] = useState<{
    request: PriorityRequest;
    order: PriorityOrder;
  } | null>(null);
  const user = useAuthStore((state) => state.auth.user);
  const userID = identity;
  const canWrite = hasPermission(user, 'channel', 'write');
  const canOperate = hasPermission(user, 'channel', 'operate');
  const canSensitive = hasPermission(user, 'channel', 'sensitive_write');
  const query = useQuery({
    queryKey: ['channel-list', identity, applied],
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        p: String(applied.page),
        page_size: String(PAGE_SIZE),
        tag_mode: String(applied.tag),
        group: applied.group,
        sort_by: applied.sort,
        sort_order: applied.direction,
      });
      if (applied.type !== 'all') params.set('type', applied.type);
      if (applied.status !== 'all') params.set('status', applied.status);
      if (applied.keyword) params.set('keyword', applied.keyword);
      return channelRequest(
        'get',
        `${applied.keyword ? '/api/channel/search' : '/api/channel/'}?${params}`,
        channelPageSchema,
        signal,
      );
    },
  });
  const orderQuery = useQuery({
    queryKey: ['channel-priority', identity],
    gcTime: 0,
    retry: false,
    enabled: canWrite,
    queryFn: ({ signal }) =>
      channelRequest(
        'get',
        '/api/channel/priority/order',
        priorityOrderSchema,
        signal,
      ),
  });
  const rows = query.isError ? [] : (query.data?.items ?? []);
  const total = query.isError ? 0 : (query.data?.total ?? 0);
  const page = applied.page;
  const loading = query.isPending;
  const priorityOrder = orderQuery.isError ? undefined : orderQuery.data;
  const priorityBusy = busy;
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selected.has(row.id));
  const refresh = () => {
    void query.refetch();
    if (canWrite) void orderQuery.refetch();
  };
  const load = (filters: ChannelFilterValues = applied, kw = keyword, tag = applied.tag) => {
    setSelected(new Set());
    setDragMode(false);
    const next = {
      ...filters,
      page: 1,
      keyword: kw.trim(),
      tag,
      group: filters.group.trim(),
    };
    setApplied(next);
    if (JSON.stringify(next) === JSON.stringify(applied)) void query.refetch();
  };
  useLiveSearch(keyword.trim(), (value) => {
    if (value !== applied.keyword) load(applied, value);
  });
  const changePage = (next: number) =>
    setApplied((current) => ({ ...current, page: next }));
  const toggleAll = () =>
    setSelected((previous) => {
      const next = new Set(previous);
      for (const row of rows) {
        if (allVisibleSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  const toggleOne = (id: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const beforeWrite = async () => {
    await client.cancelQueries({ queryKey: ['channel-list', identity] });
    await client.cancelQueries({ queryKey: ['channel-priority', identity] });
  };
  const executePriority = (request: PriorityRequest, preview = false) =>
    void run(async (signal) => {
      if (!canWrite) return;
      const order = await channelRequest(
        'post',
        '/api/channel/priority/reorder',
        priorityOrderSchema,
        signal,
        { ...request, preview },
      );
      if (preview) {
        if (!order.changes.length) showSuccess(t('优先级无需调整'));
        else setPriorityPreview({ request, order });
      } else {
        setPriorityUndo('restore' in request ? null : priorityRestore(order));
        refresh();
      }
    });
  const movePriority = (sourceID: number | null, targetID: number) => {
    if (sourceID === null) return;
    const request = priorityMove(
      rows,
      sourceID,
      targetID,
      placement,
      priorityOrder,
    );
    if (!request) {
      showError(t('渠道优先级已变化，请刷新后重试'));
      return;
    }
    executePriority(request, true);
  };
  const batch = (action: 'enable' | 'disable') =>
    void run(async (signal) => {
      if (!canOperate || !selected.size) return;
      await beforeWrite();
      const changed = await channelRequest(
        'post',
        '/api/channel/status/batch',
        z.number().int().nonnegative().safe(),
        signal,
        { ids: [...selected], status: action === 'enable' ? 1 : 2 },
      );
      showSuccess(t('Updated {{count}} channels', { count: changed }));
      setSelected(new Set());
      refresh();
    });
  const setStatus = (row: Channel, status: 1 | 2) =>
    void run(async (signal) => {
      if (!canOperate) return;
      await beforeWrite();
      await channelRequest(
        'post',
        `/api/channel/${row.id}/status`,
        z.boolean(),
        signal,
        { status },
      );
      showSuccess(t('已更新'));
      refresh();
    });
  const openTest = (row: Channel) => setTesting(row);
  const columns: TableColumn<Channel>[] = [
    {
      key: '_sel',
      mobileRole: 'selection',
      title: (
        <button
          id={selectionID}
          type='button'
          role='checkbox'
          aria-label={t('Select visible channels')}
          aria-checked={allVisibleSelected ? true : rows.some((row) => selected.has(row.id)) ? 'mixed' : false}
          onClick={toggleAll}
          className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ui-text-2 hover:bg-ui-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-text md:h-4 md:w-4'
        >
          {allVisibleSelected ? (
            <CheckSquare size={16} />
          ) : (
            <Square size={16} />
          )}
        </button>
      ),
      width: 36,
      render: (r) => (
        <button
          type='button'
          role='checkbox'
          aria-label={`${t('Select channel')} ${r.id}`}
          aria-checked={selected.has(r.id)}
          onClick={() => toggleOne(r.id)}
          className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ui-text-2 hover:bg-ui-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-text md:h-4 md:w-4'
        >
          {selected.has(r.id) ? (
            <CheckSquare size={16} />
          ) : (
            <Square size={16} />
          )}
        </button>
      ),
    },
    { key: 'id', title: 'ID', width: 70 },
    { key: 'name', title: t('名称') },
    {
      key: 'tag',
      title: t('Tag name'),
      render: (r) =>
        r.tag ? (
          <Button
            size='sm'
            variant='link'
            aria-label={`${t('Manage channel tag')} · ${r.tag}`}
            onClick={() => setManagedTag(r.tag)}
          >
            {r.tag}
          </Button>
        ) : (
          '—'
        ),
    },
    { key: 'type', title: t('类型') },
    { key: 'group', title: t('分组'), render: (r) => r.group || 'default' },
    {
      key: 'status',
      title: t('状态'),
      render: (r) => {
        const s = STATUS_TAG[r.status] || STATUS_TAG[2];
        return <Tag color={s.color}>{t(s.text)}</Tag>;
      },
    },
    { key: 'priority', title: t('优先级') },
    { key: 'weight', title: t('权重') },
    {
      key: 'used_quota',
      title: t('已用'),
      render: (r) => renderQuota(r.used_quota || 0, 2),
    },
    {
      key: 'balance',
      title: t('Channel balance'),
      render: (r) =>
        typeof r.balance === 'number' && Number.isFinite(r.balance)
          ? `$${r.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
          : '—',
    },
    {
      key: 'ops', mobileRole: 'actions' as const,
      title: t('操作'),
      align: 'right',
      render: (r) => (
        <div className='flex justify-end gap-1'>
          {[62, 63].includes(r.type) && (
            <IconButton
              icon={Gauge}
              title={t('推理服务状态')}
              onClick={() => setInference(r)}
            />
          )}
          {r.type === 57 && (
            <IconButton
              icon={Gauge}
              title={t('Codex usage')}
              onClick={() => setCodexUsage(r)}
            />
          )}
          {hasPermission(user, 'channel', 'operate') &&
            ![57, 61].includes(r.type) &&
            !r.channel_info?.is_multi_key && (
              <IconButton
                icon={Wallet}
                title={t('Channel balance')}
                onClick={() => setBalanceQuery(r)}
              />
            )}
          {r.type === 4 &&
            hasPermission(user, 'channel', 'sensitive_write') && (
              <IconButton
                icon={HardDrive}
                title={t('Ollama models')}
                onClick={() => setOllama(r)}
              />
            )}
          <IconButton
            icon={RefreshCw}
            title={t('Upstream model updates')}
            onClick={() => setUpstreamUpdates(r)}
          />
          {r.channel_info?.is_multi_key &&
            hasPermission(user, 'channel', 'operate') && (
              <IconButton
                icon={KeyRound}
                title={t('Manage channel keys')}
                onClick={() => setMultiKeys(r)}
              />
            )}
          {hasPermission(user, 'channel', 'sensitive_write') && (
            <IconButton
              icon={Copy}
              title={t('Copy channel')}
              onClick={() => setCopying(r)}
            />
          )}
          {canOperate && (
            <IconButton
              icon={Activity}
              title={t('测试')}
              onClick={() => openTest(r)}
            />
          )}
          {canWrite && (
            <IconButton
              icon={Pencil}
              title={t('编辑')}
              onClick={() => setEditing({ ...r })}
            />
          )}
          {canOperate &&
            (r.status === 1 ? (
              <IconButton
                icon={PowerOff}
                title={t('禁用')}
                disabled={busy}
                onClick={() => setStatus(r, 2)}
              />
            ) : (
              <IconButton
                icon={Power}
                title={t('启用')}
                disabled={busy}
                onClick={() => setStatus(r, 1)}
              />
            ))}
          {canSensitive && (
            <IconButton
              icon={Trash2}
              variant='danger'
              title={t('删除')}
              onClick={() =>
                setConfirm({
                  title: t('Delete channel {{name}}?', { name: r.name }),
                  ids: [r.id],
                })
              }
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title={t('渠道管理')}
      actions={
        <>
          {canWrite && (
            <Button
              size='sm'
              variant='toggle'
              selected={dragMode}
              disabled={priorityBusy || (!dragMode && (applied.tag || !priorityOrder))}
              onClick={() => setDragMode((value) => !value)}
            >
              {t('拖动排序')}
            </Button>
          )}
          {canWrite && priorityUndo && (
            <Button
              size='sm'
              variant='toggle'
              disabled={priorityBusy}
              onClick={() => executePriority(priorityUndo)}
            >
              {t('撤销排序')}
            </Button>
          )}
          {canSensitive && (
            <Button
              icon={Plus}
              onClick={() =>
                setEditing({
                  name: '',
                  type: 1,
                  key: '',
                  base_url: '',
                  group: 'default',
                  priority: 0,
                  weight: 0,
                  models: '',
                })
              }
            >
              {t('新建渠道')}
            </Button>
          )}
        </>
      }
    >
      <div className='channel-filter-panel mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ui-border bg-[var(--page-bg)] p-4'>
        <div className='w-40 min-w-0 max-w-full sm:w-[320px]'>
          <Input
            placeholder={t('搜索渠道名称/key/分组')}
            aria-label={t('搜索渠道名称/key/分组')}
            value={keyword}
            onChange={setKeyword}
            prefix={<Search size={15} />}
            clearable
            width='full'
          />
        </div>
        <div className='ml-auto flex max-w-full flex-wrap items-center justify-end gap-2'>
          <Button ref={filtersButton} variant='toggle' icon={SlidersHorizontal} shrink={false} selected={activeFilters > 0} aria-label={t('Filters')} aria-haspopup='dialog' aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            {t('Filters')}{activeFilters > 0 && <span className='text-xs tabular-nums'>{activeFilters}</span>}
          </Button>
          {activeFilters > 0 && <Button variant='link' size='sm' onClick={() => { load(DEFAULT_CHANNEL_FILTERS); filtersButton.current?.focus(); }}>{t('Reset filters')}</Button>}
        </div>
      </div>
      {filtersOpen && <ChannelFiltersDialog initialValues={applied} onApply={(values) => { load(values); setFiltersOpen(false); }} onClose={() => setFiltersOpen(false)} />}

      {orderQuery.isError && (
        <div role='alert' className='mb-4 text-sm text-ui-danger'>
          {t('Unable to load priority order')}{' '}
          <Button size='sm' onClick={() => void orderQuery.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      <SystemTaskActions key={userID}>
        <ApplyAllUpstreamUpdates key={userID} onChanged={() => refresh()} />
        <QueryAllBalances
          key={`balances:${userID}`}
          onChanged={() => refresh()}
        />
        <Button size='sm' variant='toggle' selected={applied.tag} icon={TagIcon} onClick={() => load(applied, keyword, !applied.tag)}>{t('标签视图')}</Button>
      </SystemTaskActions>
      {selected.size > 0 && (
        <div className='mb-3 flex flex-wrap items-center gap-2'>
          <span className='mr-1 hidden text-xs text-ui-text-3 md:inline'>
            {t('已选')}
            {selected.size} {t('项')}
          </span>
          <AssignChannelTag
            key={userID}
            ids={[...selected]}
            onChanged={() => {
              setSelected(new Set());
              refresh();
            }}
          />
          {canOperate && (
            <Button
              size='sm'
              variant='toggle'
              onClick={() => batch('enable')}
            >
              {t('批量启用')}
            </Button>
          )}
          {canOperate && (
            <Button
              size='sm'
              variant='toggle'
              onClick={() => batch('disable')}
            >
              {t('批量禁用')}
            </Button>
          )}
          {canSensitive && (
            <Button
              size='sm'
              variant='toggle'
              onClick={() =>
                setConfirm({
                  title: t('Delete {{count}} selected channels?', {
                    count: selected.size,
                  }),
                  ids: [...selected],
                })
              }
            >
              {t('批量删除')}
            </Button>
          )}
        </div>
      )}
      {query.isError ? (
        <div role='alert' className='space-y-2 text-sm text-ui-danger'>
          <p>{t(apiErrorMessage(query.error, 'Unable to load channels'))}</p>
          <Button onClick={refresh}>{t('Retry')}</Button>
        </div>
      ) : (
        <>
          {dragMode && (
            <div className='flex flex-wrap items-center gap-2 mb-3 text-sm'>
              <span>{t('拖放位置')}</span>
              <Select
                width={160}
                aria-label={t('拖放位置')}
                value={placement}
                onChange={(value) => setPlacement(value as Placement)}
                options={[
                  { value: 'before', label: t('目标优先级之前') },
                  { value: 'same', label: t('与目标同级') },
                  { value: 'after', label: t('目标优先级之后') },
                ]}
              />
              <span>
                {t('拖动渠道行以保存优先级，也可在编辑窗口直接填写。')}
              </span>
            </div>
          )}
          <Table
            emptyIcon={Radio}
            loading={loading}
            showMobileSelectionHeader={false}
            columns={columns}
            rows={
              dragMode
                ? [...rows].sort(
                    (a, b) =>
                      (b.priority || 0) - (a.priority || 0) || b.id - a.id,
                  )
                : rows
            }
            rowProps={
              dragMode
                ? (row) => ({
                    draggable: !priorityBusy && Boolean(priorityOrder),
                    style: {
                      cursor: 'grab',
                      outline:
                        dropTarget === row.id
                          ? '2px solid var(--ui-text-2)'
                          : undefined,
                    },
                    onDragStart: (event) => {
                      setDragged(row.id);
                      event.dataTransfer.setData('text/plain', String(row.id));
                      event.dataTransfer.effectAllowed = 'move';
                    },
                    onDragOver: (event) => {
                      event.preventDefault();
                      setDropTarget(row.id);
                    },
                    onDragEnd: () => {
                      setDragged(null);
                      setDropTarget(null);
                    },
                    onDrop: (event) => {
                      event.preventDefault();
                      setDropTarget(null);
                      if (priorityBusy || !priorityOrder) return;
                      movePriority(dragged, row.id);
                    },
                  })
                : undefined
            }
          />
          <div className='mt-4 md:flex md:justify-end'>
            <Pagination
              total={total}
              pageSize={PAGE_SIZE}
              page={page}
              onChange={(p: number) => changePage(p)}
              showRange={!mobile}
              leading={mobile && !loading && rows.length > 0 ? (
                <div className='flex min-h-10 min-w-0 items-center gap-2'>
                  {columns[0].title}
                  <div className='min-w-0'>
                    <label htmlFor={selectionID} className='inline-block cursor-pointer py-2 text-ui-text-2'>{t('Select current page')}</label>
                    {selected.size > 0 && <span className='ml-2 inline-block whitespace-nowrap text-xs text-ui-text-3'>{t('已选')}{selected.size} {t('项')}</span>}
                  </div>
                </div>
              ) : undefined}
            />
          </div>
        </>
      )}

      {priorityPreview && (
        <PriorityDialog
          preview={priorityPreview}
          onClose={() => setPriorityPreview(null)}
          onSaved={(order) => {
            setPriorityUndo(priorityRestore(order));
            setPriorityPreview(null);
            refresh();
          }}
        />
      )}
      {editing && (
        <ChannelEditModal
          channel={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {confirm && (
        <DeleteDialog
          action={confirm}
          onClose={() => setConfirm(null)}
          onSaved={() => {
            setConfirm(null);
            setSelected(new Set());
            refresh();
          }}
        />
      )}
      {testing && (
        <ChannelTestModal channel={testing} onClose={() => setTesting(null)} />
      )}
      {inference && (
        <InferenceStatusDialog
          key={inference.id}
          channel={inference}
          onClose={() => setInference(null)}
          onSyncModels={() => {
            setEditing({ ...inference, fetchModelsOnOpen: true });
            setInference(null);
          }}
          onTestChannel={() => {
            openTest(inference);
            setInference(null);
          }}
        />
      )}
      {codexUsage && (
        <CodexUsageDialog
          key={`${userID}:${codexUsage.id}`}
          channel={codexUsage}
          onClose={() => setCodexUsage(null)}
        />
      )}
      {balanceQuery && (
        <BalanceQuery
          key={`${userID}:${balanceQuery.id}`}
          channel={balanceQuery}
          onClose={() => setBalanceQuery(null)}
          onChanged={() => refresh()}
        />
      )}
      {managedTag && (
        <TagManagement
          key={`${userID}:${managedTag}`}
          tag={managedTag}
          onClose={() => setManagedTag(null)}
          onChanged={() => refresh()}
        />
      )}
      {multiKeys && (
        <MultiKeyManager
          key={`${userID}:${multiKeys.id}`}
          channel={multiKeys}
          onClose={() => setMultiKeys(null)}
          onChanged={() => refresh()}
        />
      )}
      {copying && (
        <CopyChannelDialog
          key={`${userID}:${copying.id}`}
          channel={copying}
          onClose={() => setCopying(null)}
          onCopied={() => {
            setCopying(null);
            refresh();
          }}
        />
      )}
      {ollama && (
        <OllamaModels
          key={`${userID}:${ollama.id}`}
          channel={ollama}
          onClose={() => setOllama(null)}
          onChanged={() => refresh()}
        />
      )}
      {upstreamUpdates && (
        <UpstreamUpdates
          key={`${userID}:${upstreamUpdates.id}`}
          channel={upstreamUpdates}
          onClose={() => setUpstreamUpdates(null)}
          onChanged={() => refresh()}
        />
      )}
    </PageShell>
  );
}

function DeleteDialog({
  action,
  onClose,
  onSaved,
}: {
  action: { title: string; ids: number[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  return (
    <ConfirmDialog
      open
      title={action.title}
      description={t('Deleted channels cannot be restored.')}
      confirmText={t('Delete')}
      cancelText={t('Cancel')}
      loading={busy}
      closeOnConfirm={false}
      onClose={onClose}
      onConfirm={() =>
        void run(async (signal) => {
          if (action.ids.length === 1)
            await channelRequest(
              'delete',
              `/api/channel/${action.ids[0]}/`,
              z.unknown(),
              signal,
            );
          else
            await channelRequest(
              'post',
              '/api/channel/batch',
              z.number().int().nonnegative().safe(),
              signal,
              { ids: action.ids },
            );
          showSuccess(t('已删除'));
          onSaved();
        })
      }
    />
  );
}
function PriorityDialog({
  preview,
  onClose,
  onSaved,
}: {
  preview: { request: PriorityRequest; order: PriorityOrder };
  onClose: () => void;
  onSaved: (order: PriorityOrder) => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  return (
    <ConfirmDialog
      open
      title={t('确认调整渠道优先级?')}
      description={t(
        'This changes {{count}} channels, including channels outside this list.',
        { count: preview.order.changes.length },
      )}
      confirmText={t('Confirm')}
      cancelText={t('Cancel')}
      loading={busy}
      closeOnConfirm={false}
      onClose={onClose}
      onConfirm={() =>
        void run(async (signal) =>
          onSaved(
            await channelRequest(
              'post',
              '/api/channel/priority/reorder',
              priorityOrderSchema,
              signal,
              { ...preview.request, preview: false },
            ),
          ),
        )
      }
    />
  );
}
export default function ChannelPage() {
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const { t } = useTranslation();
  const identity = `${user?.id}:${sid}:${user?.role}:${JSON.stringify(user?.permissions)}`;
  return hasPermission(user, 'channel', 'read') ? (
    <ChannelSession key={identity} identity={identity} />
  ) : (
    <PageShell title={t('渠道管理')}>
      <p>{t('Channel access is unavailable')}</p>
    </PageShell>
  );
}
