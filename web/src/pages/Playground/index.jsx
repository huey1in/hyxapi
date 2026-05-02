/*
Copyright (C) 2025 QuantumNous

Simplified chat-style playground (no params/debug panel).
*/

import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send, Square, Trash2, ChevronDown, Bot, Users } from 'lucide-react';

import { UserContext } from '../../context/User';
import { usePlaygroundState } from '../../hooks/playground/usePlaygroundState';
import { useApiRequest } from '../../hooks/playground/useApiRequest';
import { useDataLoader } from '../../hooks/playground/useDataLoader';
import {
  showWarning,
  buildApiPayload,
  buildMessageContent,
  createMessage,
  createLoadingAssistantMessage,
  getTextContent,
} from '../../helpers';
import { MESSAGE_ROLES } from '../../constants/playground.constants';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';

// 紧凑的内嵌选择器（chip 样式）
const SelectChip = ({
  Icon,
  options,
  value,
  onChange,
  placeholder,
  emptyText,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const list = (options || []).map((m) =>
    typeof m === 'string' ? { label: m, value: m } : m,
  );
  const current = list.find((o) => o.value === value);

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className='inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors max-w-[180px]'
      >
        {Icon && <Icon size={13} className='flex-shrink-0' />}
        <span className='truncate'>
          {current?.label || value || placeholder}
        </span>
        <ChevronDown size={12} className='text-ui-text-3 flex-shrink-0' />
      </button>
      {open && (
        <div className='absolute left-0 bottom-full mb-2 w-56 max-h-72 overflow-y-auto bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-30 animate-dropdown'>
          {list.length === 0 ? (
            <div className='px-4 py-5 text-center text-xs text-ui-text-3'>
              {emptyText}
            </div>
          ) : (
            list.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  onChange(m.value);
                  setOpen(false);
                }}
                className={`flex w-full px-3 py-1.5 text-xs transition-colors text-left ${
                  value === m.value
                    ? 'bg-ui-bg-subtle text-ui-text font-semibold'
                    : 'text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text'
                }`}
              >
                {m.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const Bubble = ({ role, children }) => {
  const isUser = role === MESSAGE_ROLES.USER;
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-2`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
          isUser
            ? 'bg-ui-accent text-ui-accent-fg'
            : 'bg-ui-bg-elevated border border-ui-border text-ui-text'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

const Playground = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [searchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');

  const state = usePlaygroundState();
  const {
    inputs,
    parameterEnabled,
    models,
    groups,
    message,
    sseSourceRef,
    handleInputChange,
    saveMessagesImmediately,
    setModels,
    setGroups,
    setMessage,
    setDebugData,
    setActiveDebugTab,
    debouncedSaveConfig,
  } = state;

  const { sendRequest, onStopGenerator } = useApiRequest(
    setMessage,
    setDebugData,
    setActiveDebugTab,
    sseSourceRef,
    saveMessagesImmediately,
  );

  useDataLoader(userState, inputs, handleInputChange, setModels, setGroups);

  const isGenerating = message.some(
    (m) => m.status === 'loading' || m.status === 'incomplete',
  );

  useEffect(() => {
    if (!inputs.stream) handleInputChange('stream', true);
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) {
      showWarning(t('登录过期，请重新登录！'));
    }
  }, [searchParams, t]);

  useEffect(() => {
    debouncedSaveConfig();
  }, [inputs, parameterEnabled, debouncedSaveConfig]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [message]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isGenerating) return;
    if (!inputs.model) {
      showWarning('请先选择一个模型');
      return;
    }
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    inputRef.current?.focus();

    const userMessage = createMessage(
      MESSAGE_ROLES.USER,
      buildMessageContent(text, [], false),
    );
    const loading = createLoadingAssistantMessage();

    setMessage((prev) => {
      const next = [...prev, userMessage];
      const payload = buildApiPayload(next, null, inputs, parameterEnabled);
      sendRequest(payload, true);
      const all = [...next, loading];
      setTimeout(() => saveMessagesImmediately(all), 0);
      return all;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessage([]);
    setTimeout(() => saveMessagesImmediately([]), 0);
  };

  const renderAssistantContent = (msg) => {
    const text = getTextContent(msg);
    if (!text && msg.status === 'loading') {
      return (
        <div className='flex items-center gap-1.5 text-ui-text-3'>
          <span className='w-1.5 h-1.5 rounded-full bg-ui-text-3 animate-pulse' />
          <span className='w-1.5 h-1.5 rounded-full bg-ui-text-3 animate-pulse' style={{ animationDelay: '0.15s' }} />
          <span className='w-1.5 h-1.5 rounded-full bg-ui-text-3 animate-pulse' style={{ animationDelay: '0.3s' }} />
        </div>
      );
    }
    if (msg.error) {
      return <span className='text-ui-danger'>{msg.error}</span>;
    }
    return <MarkdownRenderer content={text || ''} />;
  };

  const canSend = !!draft.trim() && !!inputs.model;

  return (
    // 顶部留出 16(64px) 的导航栏空间，整个区块独占视口剩余高度
    <div className='fixed left-0 right-0 top-16 bottom-0 flex flex-col bg-ui-bg'>
      {/* Messages */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto'>
        {message.length === 0 ? (
          (() => {
            const username = userState?.user?.username || '';
            const hour = new Date().getHours();
            const greeting =
              hour < 6 ? '夜深了'
              : hour < 12 ? '早上好'
              : hour < 14 ? '中午好'
              : hour < 18 ? '下午好'
              : '晚上好';
            return (
              <div className='h-full flex flex-col items-center justify-center text-center px-6'>
                <h2
                  className='text-3xl md:text-5xl font-bold text-ui-text mb-3'
                  style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.025em' }}
                >
                  {greeting}
                  {username && (
                    <>
                      ，<span className='text-ui-brand'>{username}</span>
                    </>
                  )}
                </h2>
                <p className='text-ui-text-2 text-sm md:text-base'>
                  今天想聊点什么？
                </p>
              </div>
            );
          })()
        ) : (
          <div className='max-w-3xl mx-auto py-6 px-2 space-y-4'>
            {message.map((msg) => (
              <Bubble key={msg.id} role={msg.role}>
                {msg.role === MESSAGE_ROLES.USER ? (
                  <span className='whitespace-pre-wrap'>{getTextContent(msg)}</span>
                ) : (
                  renderAssistantContent(msg)
                )}
              </Bubble>
            ))}
          </div>
        )}
      </div>

      {/* Input area: single integrated card */}
      <div className='shrink-0 px-3 md:px-4 pb-4 pt-2'>
        <div className='max-w-3xl mx-auto'>
          <div className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-sm focus-within:border-ui-text-3 transition-colors'>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder='发消息给模型，Enter 发送 / Shift + Enter 换行'
              className='block w-full resize-none bg-transparent border-0 outline-none focus:ring-0 px-4 pt-3.5 pb-1 text-sm text-ui-text placeholder:text-ui-text-3 rounded-t-2xl'
              style={{ minHeight: '60px', maxHeight: '200px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
            />

            {/* Toolbar row */}
            <div className='flex items-center justify-between gap-2 px-2 pb-2'>
              <div className='flex items-center gap-1 min-w-0 flex-1 flex-wrap'>
                <SelectChip
                  Icon={Users}
                  options={groups}
                  value={inputs.group}
                  onChange={(v) => handleInputChange('group', v)}
                  placeholder='分组'
                  emptyText='暂无可用分组'
                />
                <span className='text-ui-border'>·</span>
                <SelectChip
                  Icon={Bot}
                  options={models}
                  value={inputs.model}
                  onChange={(v) => handleInputChange('model', v)}
                  placeholder='选择模型'
                  emptyText='暂无可用模型'
                />
              </div>
              <div className='flex items-center gap-1 flex-shrink-0'>
                {message.length > 0 && (
                  <button
                    onClick={handleClear}
                    title='新对话'
                    aria-label='clear'
                    className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {isGenerating ? (
                  <button
                    onClick={onStopGenerator}
                    aria-label='stop'
                    className='inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ui-bg-subtle text-ui-text hover:bg-ui-border transition-colors'
                  >
                    <Square size={13} fill='currentColor' />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label='send'
                    className='inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-30 disabled:hover:bg-ui-accent transition-colors'
                  >
                    <Send size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className='mt-2 text-center text-[11px] text-ui-text-3'>
            模型可能产生不准确的信息，请核实重要内容
          </p>
        </div>
      </div>
    </div>
  );
};

export default Playground;
