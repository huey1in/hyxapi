/*
 * Channel model-test modal — token-system rewrite, no Semi UI.
 */
import React, { useEffect, useMemo } from 'react';
import { Search, Settings, Info, X, Loader2 } from 'lucide-react';
import { copy, showError, showInfo, showSuccess } from '../../../../helpers';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';
import Pagination from '../../../common/table/Pagination';
import { Button, IconButton, ModalShell, Toggle as UIToggle, inputClass } from '../../../ui';

const inputCls = inputClass({ variant: 'admin', size: 'md', className: 'pl-8 !bg-[var(--page-bg)]' });
const selectCls = inputClass({ variant: 'admin', size: 'md', className: '!bg-[var(--page-bg)] cursor-pointer' });

const ENDPOINT_OPTIONS_RAW = [
  { value: '', label: '自动检测' },
  { value: 'openai', label: 'OpenAI (/v1/chat/completions)' },
  { value: 'openai-response', label: 'OpenAI Response (/v1/responses)' },
  { value: 'openai-response-compact', label: 'OpenAI Response Compaction (/v1/responses/compact)' },
  { value: 'anthropic', label: 'Anthropic (/v1/messages)' },
  { value: 'gemini', label: 'Gemini (/v1beta/models/{model}:generateContent)' },
  { value: 'jina-rerank', label: 'Jina Rerank (/v1/rerank)' },
  { value: 'image-generation', label: '图像生成 (/v1/images/generations)' },
  { value: 'embeddings', label: 'Embeddings (/v1/embeddings)' },
];

const STREAM_DISABLED = new Set([
  'embeddings',
  'image-generation',
  'jina-rerank',
  'openai-response-compact',
]);

const StatusPill = ({ kind, children }) => {
  const map = {
    testing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    pending: 'bg-ui-bg-subtle text-ui-text-3 border-ui-border',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    error: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-xl font-medium border ${map[kind] || map.pending}`}>
      {kind === 'testing' && <Loader2 size={9} className='animate-spin' />}
      {children}
    </span>
  );
};

const Toggle = ({ checked, onChange, disabled }) => (
  <UIToggle checked={checked} onChange={onChange} disabled={disabled} size='sm' />
);

const ModelTestModal = ({
  showModelTestModal,
  currentTestChannel,
  handleCloseModal,
  isBatchTesting,
  batchTestModels,
  modelSearchKeyword,
  setModelSearchKeyword,
  selectedModelKeys,
  setSelectedModelKeys,
  modelTestResults,
  testingModels,
  testChannel,
  modelTablePage,
  setModelTablePage,
  selectedEndpointType,
  setSelectedEndpointType,
  isStreamTest,
  setIsStreamTest,
  t,
}) => {
  const open = showModelTestModal && Boolean(currentTestChannel);
  const streamDisabled = STREAM_DISABLED.has(selectedEndpointType);

  useEffect(() => {
    if (streamDisabled && isStreamTest) setIsStreamTest(false);
  }, [streamDisabled, isStreamTest, setIsStreamTest]);

  const filteredModels = useMemo(() => {
    if (!currentTestChannel) return [];
    return currentTestChannel.models
      .split(',')
      .filter((m) => m.toLowerCase().includes((modelSearchKeyword || '').toLowerCase()));
  }, [currentTestChannel, modelSearchKeyword]);

  const totalModels = currentTestChannel ? currentTestChannel.models.split(',').length : 0;

  const pageRows = useMemo(() => {
    const start = (modelTablePage - 1) * MODEL_TABLE_PAGE_SIZE;
    return filteredModels.slice(start, start + MODEL_TABLE_PAGE_SIZE);
  }, [filteredModels, modelTablePage]);

  if (!open || typeof document === 'undefined') return null;

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((m) => selectedModelKeys.includes(m));
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelectedModelKeys(selectedModelKeys.filter((k) => !pageRows.includes(k)));
    } else {
      const next = new Set(selectedModelKeys);
      pageRows.forEach((k) => next.add(k));
      setSelectedModelKeys([...next]);
    }
  };
  const toggleOne = (m) =>
    setSelectedModelKeys(
      selectedModelKeys.includes(m)
        ? selectedModelKeys.filter((k) => k !== m)
        : [...selectedModelKeys, m],
    );

  const handleCopySelected = () => {
    if (selectedModelKeys.length === 0) {
      showError(t('请先选择模型！'));
      return;
    }
    copy(selectedModelKeys.join(',')).then((ok) => {
      if (ok) {
        showSuccess(
          t('已复制 ${count} 个模型').replace('${count}', selectedModelKeys.length),
        );
      } else {
        showError(t('复制失败，请手动复制'));
      }
    });
  };

  const handleSelectSuccess = () => {
    const successKeys = filteredModels.filter((m) => {
      const r = modelTestResults[`${currentTestChannel.id}-${m}`];
      return r && r.success;
    });
    if (successKeys.length === 0) showInfo(t('暂无成功模型'));
    setSelectedModelKeys(successKeys);
  };

  return (
    <ModalShell
      open={open}
      onClose={() => !isBatchTesting && handleCloseModal()}
      maxWidth='48rem'
      maxHeight='88vh'
      className='flex flex-col'
    >
        {/* Header */}
        <div className='flex items-center justify-between gap-3 px-6 py-4 border-b border-ui-border'>
          <div className='flex items-center gap-2 min-w-0'>
            <span
              className='text-base font-semibold text-ui-text truncate'
              style={{ letterSpacing: '-0.02em' }}
            >
              {currentTestChannel.name}
            </span>
            <span className='text-xs text-ui-text-3 flex-shrink-0'>
              {t('共')} {totalModels} {t('个模型')}
            </span>
          </div>
          <IconButton icon={X} size='sm' onClick={handleCloseModal} disabled={isBatchTesting} />
        </div>

        {/* Body */}
        <div className='flex-1 overflow-y-auto p-5 space-y-3'>
          {/* Endpoint + Stream */}
          <div className='grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end'>
            <div>
              <label className='block text-[11px] font-medium text-ui-text-2 mb-1'>{t('端点类型')}</label>
              <select
                value={selectedEndpointType}
                onChange={(e) => setSelectedEndpointType(e.target.value)}
                className={selectCls}
              >
                {ENDPOINT_OPTIONS_RAW.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.label)}</option>
                ))}
              </select>
            </div>
            <div className='inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-ui-border bg-[var(--page-bg)]'>
              <span className='text-[11px] text-ui-text-2 whitespace-nowrap'>{t('流式')}</span>
              <Toggle checked={isStreamTest} onChange={setIsStreamTest} disabled={streamDisabled} />
            </div>
          </div>

          {/* Notice */}
          <div className='flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5'>
            <Info size={14} className='text-blue-500 flex-shrink-0 mt-0.5' />
            <div className='text-[11px] text-ui-text-2 leading-relaxed'>
              {t('说明：本页测试为非流式请求；若渠道仅支持流式返回，可能出现测试失败，请以实际使用为准。')}
            </div>
          </div>

          {/* Search + actions */}
          <div className='flex flex-col sm:flex-row gap-2'>
            <div className='relative flex-1'>
              <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
              <input
                type='text'
                placeholder={t('搜索模型...')}
                value={modelSearchKeyword}
                onChange={(e) => {
                  setModelSearchKeyword(e.target.value);
                  setModelTablePage(1);
                }}
                className={inputCls}
              />
            </div>
            <div className='flex items-center gap-1.5'>
              <Button variant='secondary' onClick={handleCopySelected}>
                {t('复制已选')}
              </Button>
              <Button variant='secondary' onClick={handleSelectSuccess}>
                {t('选择成功')}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className='border border-ui-border rounded-lg overflow-hidden'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='border-b border-ui-border bg-ui-bg-subtle/50 text-[11px] uppercase tracking-wider text-ui-text-3'>
                  <th className='w-10 px-3 py-2'>
                    <input
                      type='checkbox'
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className='w-3.5 h-3.5 cursor-pointer accent-current'
                    />
                  </th>
                  <th className='text-left px-3 py-2 font-medium'>{t('模型名称')}</th>
                  <th className='text-left px-3 py-2 font-medium'>{t('状态')}</th>
                  <th className='text-right px-3 py-2 font-medium' />
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className='py-10 text-center text-ui-text-3 text-xs'>
                      {t('未找到模型')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((model) => {
                    const r = modelTestResults[`${currentTestChannel.id}-${model}`];
                    const testing = testingModels.has(model);
                    return (
                      <tr key={model} className='border-b border-ui-border last:border-b-0 hover:bg-ui-bg-subtle/40'>
                        <td className='px-3 py-2.5 align-middle' onClick={(e) => e.stopPropagation()}>
                          <input
                            type='checkbox'
                            checked={selectedModelKeys.includes(model)}
                            onChange={() => toggleOne(model)}
                            className='w-3.5 h-3.5 cursor-pointer accent-current'
                          />
                        </td>
                        <td className='px-3 py-2.5 align-middle'>
                          <span className='text-sm text-ui-text font-medium'>{model}</span>
                        </td>
                        <td className='px-3 py-2.5 align-middle'>
                          {testing ? (
                            <StatusPill kind='testing'>{t('测试中')}</StatusPill>
                          ) : !r ? (
                            <StatusPill kind='pending'>{t('未开始')}</StatusPill>
                          ) : (
                            <div className='flex flex-col gap-1'>
                              <div className='flex items-center gap-2'>
                                <StatusPill kind={r.success ? 'success' : 'error'}>
                                  {r.success ? t('成功') : t('失败')}
                                </StatusPill>
                                {r.success && (
                                  <span className='text-[11px] text-ui-text-3 tabular-nums'>
                                    {t('请求时长: ${time}s').replace('${time}', r.time.toFixed(2))}
                                  </span>
                                )}
                              </div>
                              {!r.success && r.message && (
                                <div className='flex flex-col gap-1 max-w-md'>
                                  <span className='text-[11px] text-ui-danger break-all leading-relaxed'>
                                    {r.message}
                                  </span>
                                  {r.errorCode === 'model_price_error' && (
                                    <Button
                                      size='sm'
                                      icon={Settings}
                                      onClick={() => window.open('/console/setting?tab=ratio', '_blank')}
                                      className='bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 w-fit'
                                    >
                                      {t('前往设置')}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className='px-3 py-2.5 align-middle text-right'>
                          <Button
                            size='sm'
                            variant='secondary'
                            icon={testing ? Loader2 : undefined}
                            onClick={() => testChannel(currentTestChannel, model, selectedEndpointType, isStreamTest)}
                            disabled={testing}
                          >
                            {t('测试')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredModels.length > MODEL_TABLE_PAGE_SIZE && (
            <Pagination
              page={modelTablePage}
              pageSize={MODEL_TABLE_PAGE_SIZE}
              total={filteredModels.length}
              onChange={(p) => setModelTablePage(p)}
            />
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-2 px-6 py-4 border-t border-ui-border'>
          {isBatchTesting ? (
            <Button variant='danger' onClick={handleCloseModal}>
              {t('停止测试')}
            </Button>
          ) : (
            <Button variant='secondary' onClick={handleCloseModal}>
              {t('取消')}
            </Button>
          )}
          <Button
            icon={isBatchTesting ? Loader2 : undefined}
            onClick={batchTestModels}
            disabled={isBatchTesting}
          >
            {isBatchTesting
              ? t('测试中...')
              : t('批量测试${count}个模型').replace('${count}', filteredModels.length)}
          </Button>
        </div>
    </ModalShell>
  );
};

export default ModelTestModal;
