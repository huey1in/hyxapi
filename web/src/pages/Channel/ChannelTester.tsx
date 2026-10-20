import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import {
  Button,
  IconButton,
  Input,
  Modal,
  Switch,
  Table,
  Tag,
} from '../../components/ui';
import { CheckSquare, PlusCircle, Play, RotateCcw } from 'lucide-react';
import { cn } from '../../components/ui/tokens';
import { CHANNEL_TYPE_OPTIONS as TYPE_OPTIONS } from '../../constants/channel-types';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { Channel } from './channel-data';
import type { TableColumn } from '../../components/ui/layout/Table';
import { ModelCdnIcon } from './ChannelFormParts';
type TestResult = {
  model: string;
  status: 'pending' | 'running' | 'ok' | 'fail';
  time?: number;
  message?: string;
  errorCode?: string;
};
const testResponse = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  time: z.number().nonnegative().optional(),
  error_code: z.string().optional(),
});
export default function ChannelTestModal({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const initial = (channel.models || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  const [selectedModels, setSelectedModels] = useState(initial);
  const [customModel, setCustomModel] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const { t } = useTranslation();
  const { busy: running, run: execute } = useOwnedOperation();
  const [stream, setStream] = useState(false);

  const modelOptions = Array.from(
    new Set([
      ...(channel.models || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ...selectedModels,
    ]),
  );
  const channelTypeLabel =
    TYPE_OPTIONS.find((o) => o.value === channel.type)?.label ||
    channel.type ||
    '-';

  const toggleModel = (model: string) => {
    if (running) return;
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  };

  const addCustomModel = () => {
    const values = customModel
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (values.length === 0) return;
    setSelectedModels((prev) => Array.from(new Set([...prev, ...values])));
    setCustomModel('');
  };

  const run = () =>
    void execute(async (signal) => {
      const list = [...selectedModels];
      if (!list.length) throw new Error('请选择至少一个模型');
      setResults(list.map((model) => ({ model, status: 'pending' })));
      for (const model of list) {
        signal.throwIfAborted();
        setResults((rows) =>
          rows.map((row) =>
            row.model === model
              ? { ...row, status: 'running', message: '' }
              : row,
          ),
        );
        try {
          const params = new URLSearchParams({ model });
          if (stream) params.set('stream', 'true');
          const response = await API.get<unknown>(
            `/api/channel/test/${channel.id}?${params}`,
            {
              signal,
              timeout: 120000,
              skipErrorHandler: true,
              disableDuplicate: true,
            },
          );
          signal.throwIfAborted();
          const parsed = testResponse.safeParse(response.data);
          if (!parsed.success) throw new Error('Invalid channel test response');
          const result = parsed.data;
          setResults((rows) =>
            rows.map((row) =>
              row.model === model
                ? {
                    ...row,
                    status: result.success ? 'ok' : 'fail',
                    time: result.time,
                    errorCode: result.error_code,
                    message:
                      result.message ||
                      t(result.success ? '测试通过' : '失败'),
                  }
                : row,
            ),
          );
        } catch (error) {
          signal.throwIfAborted();
          setResults((rows) =>
            rows.map((row) =>
              row.model === model
                ? {
                    ...row,
                    status: 'fail',
                    message: t(apiErrorMessage(error, t('请求失败'))),
                  }
                : row,
            ),
          );
        }
      }
    });
  const resultColumns: TableColumn<TestResult>[] = [
    {
      key: 'model',
      title: t('模型'),
      render: (r) => (
        <span className='font-mono text-xs break-all'>{r.model}</span>
      ),
    },
    {
      key: 'status',
      title: t('状态'),
      width: 96,
      render: (r) => {
        if (r.status === 'pending') return <Tag color='grey'>{t('等待')}</Tag>;
        if (r.status === 'running')
          return <Tag color='blue'>{t('测试中')}</Tag>;
        if (r.status === 'ok') return <Tag color='green'>{t('通过')}</Tag>;
        return <Tag color='red'>{t('失败')}</Tag>;
      },
    },
    {
      key: 'time',
      title: t('耗时'),
      width: 88,
      render: (r) =>
        r.status === 'ok'
          ? r.time === undefined
            ? '—'
            : `${r.time.toFixed(2)}s`
          : '-',
    },
    {
      key: 'message',
      title: t('返回信息'),
      render: (r) => (
        <span
          className={cn(
            'text-xs break-words',
            r.status === 'fail' ? 'text-ui-danger' : 'text-ui-text-2',
          )}
        >
          {r.errorCode ? `[${r.errorCode}] ` : ''}
          {r.message || '-'}
        </span>
      ),
    },
  ];

  return (
    <Modal
      open
      title={
        <div className='flex w-[760px] max-w-full items-center justify-between gap-4'>
          <span>{t('测试渠道')}</span>
          <label className='flex items-center gap-2 text-xs font-normal text-ui-text-2'>
            {t('流式')}
            <Switch
              size='sm'
              disabled={running}
              checked={stream}
              onChange={setStream}
            />
          </label>
        </div>
      }
      onClose={onClose}
      hideFooter
      width={860}
    >
      <div className='space-y-5'>
        <div className='flex flex-wrap items-center gap-x-5 gap-y-2 text-sm'>
          <div className='min-w-0'>
            <span className='text-ui-text-3'>{t('渠道：')}</span>
            <span className='font-medium text-ui-text'>
              {channel.name || '-'}
            </span>
          </div>
          <div>
            <span className='text-ui-text-3'>{t('类型：')}</span>
            <span className='text-ui-text'>{channelTypeLabel}</span>
          </div>
          <div>
            <span className='text-ui-text-3'>{t('分组：')}</span>
            <span className='text-ui-text'>{channel.group || 'default'}</span>
          </div>
        </div>

        <div className='grid gap-4 lg:grid-cols-[1fr_148px]'>
          <div>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <label className='block text-sm text-ui-text-2'>
                {t('测试模型')}
              </label>
              {initial.length > 0 && (
                <button
                  type='button'
                  className='text-ui-accent hover:underline'
                  onClick={() => setSelectedModels(initial)}
                  disabled={running}
                >
                  {t('恢复默认')}
                </button>
              )}
            </div>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
              {modelOptions.map((model) => {
                const selected = selectedModels.includes(model);
                return (
                  <button
                    key={model}
                    type='button'
                    onClick={() => toggleModel(model)}
                    disabled={running}
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                      selected
                        ? 'border-ui-accent bg-ui-accent/10 text-ui-text'
                        : 'border-ui-border bg-[var(--page-bg)] text-ui-text-2 hover:bg-ui-bg-subtle',
                      running && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <ModelCdnIcon model={model} channelType={channel.type} />
                    <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                      {model}
                    </span>
                    {selected && (
                      <CheckSquare
                        size={15}
                        className='shrink-0 text-ui-accent'
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className='mt-3 flex gap-2'>
              <Input
                value={customModel}
                onChange={setCustomModel}
                onKeyDown={(e) => e.key === 'Enter' && addCustomModel()}
                placeholder={t('手动输入模型 ID，多个用逗号分隔')}
                disabled={running}
              />
              <IconButton
                icon={PlusCircle}
                title={t('添加模型')}
                onClick={addCustomModel}
                disabled={running}
              />
            </div>
          </div>
          <div className='flex items-start gap-2 lg:justify-end lg:pt-7'>
            <div className='flex gap-2'>
              <Button
                variant='toggle'
                icon={RotateCcw}
                onClick={() => setResults([])}
                disabled={running}
              >
                {t('清空')}
              </Button>
              <Button icon={Play} loading={running} onClick={run}>
                {running ? t('测试中') : t('开始')}
              </Button>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className='max-h-80 overflow-auto ui-scrollbar'>
            <Table
              columns={resultColumns}
              rows={results}
              rowKey='model'
              size='sm'
              tableLayout='fixed'
              emptyText={t('暂无测试结果')}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
