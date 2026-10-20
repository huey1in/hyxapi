import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Copy, Pencil, RotateCcw, Send, SlidersHorizontal, Square, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { copy } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import { usePlaygroundState } from './hooks/use-playground-state.ts';
import { usePlaygroundOptions } from './hooks/use-playground-options.ts';
import { useChatHandler } from './hooks/use-chat-handler.ts';
import { usePlaygroundConversation } from './hooks/use-playground-conversation.ts';
import { Combobox, Input, PageShell, Select, Textarea } from './ui.tsx';
import {
  createMessageVersion, getMessageContent, getMessageContentState, getMessageEditorState,
  getMessageErrorState, getInputControlState, getSubmittableInputText,
  PLAYGROUND_PARAMETER_CONTROLS, normalizeParameterNumberValue,
} from './lib/index.ts';
import type { Message } from './types.ts';

function MessageCard({ message, isGenerating, editing, onEdit, onSave, onCancel, onDelete, onRegenerate }: {
  message: Message; isGenerating: boolean; editing: boolean;
  onEdit: () => void; onSave: (text: string, submit: boolean) => void; onCancel: () => void;
  onDelete: () => void; onRegenerate: () => void;
}) {
  const { t } = useTranslation();
  const role = useAuthStore((state) => state.auth.user?.role ?? 0);
  const content = getMessageContent(message);
  const display = getMessageContentState(message, content);
  const error = getMessageErrorState(message, role >= 10);
  const [source, setSource] = useState(false);
  const [editText, setEditText] = useState(content);
  useEffect(() => { if (editing) setEditText(content); }, [editing, content]);
  const edit = getMessageEditorState(message, editText, content);
  const roleLabel = message.from === 'user' ? t('你') : message.from === 'system' ? t('系统') : t('模型');
  return (
    <article aria-label={roleLabel} data-message-key={message.key} className={`min-w-0 rounded-2xl border border-ui-border p-4 ${message.from === 'user' ? 'ml-auto w-[92%] bg-ui-bg-subtle' : 'w-full'}`}>
      <div className='mb-2 flex items-center justify-between gap-2 text-xs text-ui-text-3'>
        <span className='font-medium text-ui-text'>{roleLabel}</span>
        {message.durationMs != null && <span>{(message.durationMs / 1000).toFixed(1)} {t('秒')}</span>}
      </div>
      {editing ? (
        <div className='space-y-3'>
          <Textarea aria-label={t('编辑消息')} value={editText} onChange={setEditText} rows={5} disabled={isGenerating} />
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' disabled={!edit.canSave || isGenerating} onClick={() => onSave(editText, false)}>{t('保存')}</Button>
            {edit.showSaveAndSubmit && <Button size='sm' disabled={!edit.canSave || isGenerating} onClick={() => onSave(editText, true)}>{t('保存并重新发送')}</Button>}
            <Button size='sm' variant='secondary' onClick={onCancel}>{t('取消')}</Button>
          </div>
        </div>
      ) : (
        <>
          {display.hasReasoning && <details className='mb-3 rounded-xl border border-ui-border p-3' open={message.isReasoningStreaming || undefined}>
            <summary className='cursor-pointer text-sm text-ui-text-2'>{message.isReasoningStreaming ? t('正在思考…') : t('思考过程')}</summary>
            <div className='mt-3 whitespace-pre-wrap break-words text-sm text-ui-text-2'>{display.reasoningContent}</div>
          </details>}
          {display.showLoader && !error && <p role='status' className='text-sm text-ui-text-3'>{t('等待模型响应…')}</p>}
          {error ? <div role='alert' className='space-y-2 break-words text-sm text-ui-text'>
            <p>{error.content}</p>
            {error.showSettingsLink && <Link className='underline' to='/console/setting'>{t('前往模型价格设置')}</Link>}
          </div> : source ? <pre className='whitespace-pre-wrap break-words text-sm text-ui-text'>{content}</pre>
            : display.showMessageContent && <MarkdownRenderer content={display.displayContent} />}
          {display.hasSources && <div className='mt-3 flex flex-wrap gap-2 text-xs'>
            {display.sources.map((item, index) => /^https?:\/\//i.test(item.href) && <a key={`${index}-${item.href}`} href={item.href} target='_blank' rel='noopener noreferrer' className='underline'>{item.title || item.href}</a>)}
          </div>}
          <div className='mt-3 flex flex-wrap gap-2'>
            <Button variant='secondary' size='sm' icon={Copy} aria-label={t('复制消息')} disabled={!content} onClick={() => void copy(content)}>{t('复制')}</Button>
            <Button variant='secondary' size='sm' icon={Pencil} disabled={isGenerating} onClick={onEdit}>{t('编辑')}</Button>
            {message.from !== 'system' && <Button variant='secondary' size='sm' icon={RotateCcw} disabled={isGenerating} onClick={onRegenerate}>{t('重新生成')}</Button>}
            {message.from === 'assistant' && !error && content && <Button variant='secondary' size='sm' onClick={() => setSource(!source)}>{source ? t('显示预览') : t('显示原文')}</Button>}
            <Button variant='secondary' size='sm' icon={Trash2} aria-label={t('删除消息')} disabled={isGenerating} onClick={onDelete}>{t('删除')}</Button>
          </div>
        </>
      )}
    </article>
  );
}

function PlaygroundSession() {
  const { t } = useTranslation();
  const state = usePlaygroundState();
  const [text, setText] = useState('');
  const [parametersOpen, setParametersOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const { sendChat, stopGeneration, isGenerating } = useChatHandler({ config: state.config, parameterEnabled: state.parameterEnabled, onMessageUpdate: state.updateMessages });
  const conversation = usePlaygroundConversation({ messages: state.messages, updateMessages: state.updateMessages, sendChat });
  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: state.config.group, currentModel: state.config.model, setModels: state.setModels,
    setGroups: state.setGroups, updateConfig: state.updateConfig,
  });
  const input = getInputControlState({ disabled: isGenerating || state.isLoadingMessages, isGenerating, isModelLoading: isLoadingModels, groups: state.groups, models: state.models, hasStopHandler: true, text });
  useEffect(() => {
    if (followOutput.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [state.messages]);
  const submit = () => {
    const value = getSubmittableInputText({ text }, !input.canSubmit || isGenerating);
    if (value == null) return;
    followOutput.current = true;
    conversation.handleEditOpenChange(false);
    conversation.handleSendMessage(value);
    setText('');
  };
  const system = state.messages.find((message) => message.from === 'system');
  const updateSystemPrompt = (value: string) => state.updateMessages((messages) => {
    if (!value.trim()) return messages.filter((message) => message.from !== 'system');
    const prompt: Message = { ...(system || { key: crypto.randomUUID(), createdAt: Date.now() }), from: 'system', versions: [createMessageVersion(value)] };
    return [prompt, ...messages.filter((message) => message.from !== 'system')];
  });
  return (
    <PageShell title={t('在线调试')} maxWidth='1100px' actions={
      <Button variant='secondary' icon={Trash2} disabled={isGenerating || !state.messages.length} onClick={() => setConfirmClear(!confirmClear)}>{t('清空对话')}</Button>
    }>
      <p className='mb-5 text-sm text-ui-text-2'>{t('使用账户额度测试模型；对话仅保存在当前浏览器。')}</p>
      {confirmClear && <div role='alert' className='mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text'>
        <span>{t('清空当前账户在此浏览器中的对话？')}</span>
        <Button size='sm' onClick={() => { conversation.handleEditOpenChange(false); state.clearMessages(); setConfirmClear(false); }}>{t('确认清空')}</Button>
        <Button size='sm' variant='secondary' onClick={() => setConfirmClear(false)}>{t('取消')}</Button>
      </div>}
      <div className='mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]'>
        <div role='group' aria-label={t('调试分组')} className='min-w-0 space-y-1 text-sm text-ui-text-2'>
          <span>{t('分组')}</span>
          <Select value={state.config.group} options={state.groups.map((group) => ({ value: group.value, label: `${group.label} · ×${group.ratio}` }))} onChange={(value) => state.updateConfig('group', value)} disabled={input.isSelectorDisabled} />
        </div>
        <div role='group' aria-label={t('调试模型')} className='min-w-0 space-y-1 text-sm text-ui-text-2'>
          <span>{t('模型')}</span>
          <Combobox value={state.config.model} options={state.models} onChange={(value) => state.updateConfig('model', value)} disabled={isGenerating || isLoadingModels} placeholder={isLoadingModels ? t('加载模型…') : t('选择模型')} searchPlaceholder={t('搜索模型')} />
        </div>
        <div className='flex items-end'><Button variant='secondary' icon={SlidersHorizontal} aria-expanded={parametersOpen} onClick={() => setParametersOpen(!parametersOpen)}>{t('参数')}</Button></div>
      </div>
      {parametersOpen && <section aria-label={t('调试参数')} className='mb-4 space-y-4 rounded-2xl border border-ui-border p-4'>
        <label className='flex items-center gap-2 text-sm text-ui-text'><input type='checkbox' checked={state.config.stream} disabled={isGenerating} onChange={(event) => state.updateConfig('stream', event.target.checked)} />{t('流式响应')}</label>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {PLAYGROUND_PARAMETER_CONTROLS.map((control) => <div key={control.key} className='space-y-2 text-sm text-ui-text'>
            <label className='flex items-center gap-2'><input type='checkbox' checked={state.parameterEnabled[control.key]} disabled={isGenerating} onChange={(event) => state.updateParameterEnabled(control.key, event.target.checked)} />{t(control.labelKey)}</label>
            <Input aria-label={control.key} type='number' min={control.min} max={control.max} step={control.step} value={state.config[control.key] ?? ''} disabled={isGenerating || !state.parameterEnabled[control.key]} onChange={(value) => {
              const normalized = normalizeParameterNumberValue(control.key, value);
              if (control.key === 'seed') state.updateConfig('seed', normalized);
              else state.updateConfig(control.key, normalized ?? 0);
            }} />
            <p className='text-xs text-ui-text-3'>{t(control.descriptionKey)}</p>
          </div>)}
        </div>
        <label className='block space-y-2 text-sm text-ui-text'><span>{t('系统提示词')}</span><Textarea aria-label={t('系统提示词')} value={system ? getMessageContent(system) : ''} onChange={updateSystemPrompt} disabled={isGenerating || state.isLoadingMessages} rows={3} /></label>
        <Button variant='secondary' size='sm' disabled={isGenerating} onClick={state.resetConfig}>{t('恢复默认参数')}</Button>
      </section>}
      <div className='flex h-[calc(100dvh-420px)] min-h-80 flex-col rounded-2xl border border-ui-border sm:h-[calc(100dvh-280px)] sm:min-h-96'>
        <div ref={scroller} role='log' aria-label={t('调试对话')} aria-live={isGenerating ? 'off' : 'polite'} className='min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:p-5' onScroll={() => {
          const node = scroller.current;
          if (node) followOutput.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
        }}>
          {state.isLoadingMessages ? <p role='status' className='text-sm text-ui-text-3'>{t('加载对话…')}</p> : state.messages.length === 0 ? <div className='flex h-full flex-col items-center justify-center gap-3 text-center text-ui-text-2'>
            <h2 className='text-xl text-ui-text'>{t('开始测试你的模型')}</h2>
            <p className='text-sm'>{t('选择模型和分组，然后发送消息。')}</p>
          </div> : state.messages.map((message) => <MessageCard key={message.key} message={message} isGenerating={isGenerating}
            editing={conversation.editingMessageKey === message.key} onEdit={() => conversation.handleEditMessage(message)}
            onCancel={() => conversation.handleEditOpenChange(false)} onSave={conversation.applyEdit}
            onDelete={() => conversation.handleDeleteMessage(message)} onRegenerate={() => { followOutput.current = true; conversation.handleRegenerateMessage(message); }} />)}
        </div>
        <div className='shrink-0 space-y-3 border-t border-ui-border p-4'>
          <Textarea aria-label={t('调试消息')} value={text} onChange={setText} rows={3} disabled={state.isLoadingMessages} placeholder={t('输入消息，Enter 发送，Shift+Enter 换行')} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
          }} />
          <div className='flex items-center justify-between gap-3'>
            <span className='text-xs text-ui-text-3'>{!isLoadingModels && state.models.length === 0 ? t('当前分组没有可用模型') : t('对话记录保存在此浏览器')}</span>
            {input.shouldShowStop ? <Button icon={Square} onClick={stopGeneration}>{t('停止生成')}</Button> : <Button icon={Send} disabled={!input.canSubmit} onClick={submit}>{t('发送')}</Button>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function Playground() {
  const userId = useAuthStore((state) => state.auth.user?.id);
  return userId == null ? null : <PlaygroundSession key={userId} />;
}
