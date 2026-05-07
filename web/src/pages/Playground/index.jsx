/*
Copyright (C) 2025 QuantumNous

Simplified chat-style playground (no params/debug panel).
*/

import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import { Send, Square, Trash2, RotateCcw, Copy, Check, AlertCircle, ImagePlus, X as XIcon } from 'lucide-react';
import ChevronDownIcon from '../../components/layout/headerbar/icons/ChevronDownIcon';

import { UserContext } from '../../context/User';
import { usePlaygroundState } from '../../hooks/playground/usePlaygroundState';
import { useApiRequest } from '../../hooks/playground/useApiRequest';
import { useDataLoader } from '../../hooks/playground/useDataLoader';
import {
  showWarning,
  showSuccess,
  copy,
  buildApiPayload,
  buildMessageContent,
  createMessage,
  createLoadingAssistantMessage,
  getTextContent,
} from '../../helpers';
import { MESSAGE_ROLES } from '../../constants/playground.constants';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';

// 紧凑的内嵌选择器（参考 LanguageSelector 的下拉菜单风格，popup 通过 portal 渲染避免被卡片裁切）
const SelectChip = ({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        const popup = document.getElementById('playground-select-chip-popup');
        if (popup && popup.contains(e.target)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popupWidth = 224; // w-56 = 14rem = 224px
    const margin = 8;
    let left = r.left;
    if (left + popupWidth + margin > window.innerWidth) {
      left = window.innerWidth - popupWidth - margin;
    }
    if (left < margin) left = margin;
    setPos({ left, bottom: window.innerHeight - r.top + 8 });
  }, [open]);

  const list = (options || []).map((m) =>
    typeof m === 'string' ? { label: m, value: m } : m,
  );
  const current = list.find((o) => o.value === value);

  return (
    <div className='relative' ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className='inline-flex items-center gap-1 h-9 px-2 md:px-3 rounded-xl text-[13px] font-medium text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors max-w-[110px] md:max-w-[150px] min-w-0'
      >
        <span className='truncate'>{current?.label || placeholder}</span>
        <ChevronDownIcon
          size={13}
          className={`text-ui-text-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && createPortal(
        <div
          id='playground-select-chip-popup'
          className='fixed w-56 bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-xl overflow-hidden z-[200] animate-dropdown'
          style={{ left: pos.left, bottom: pos.bottom }}
        >
          <div className='px-2 py-2 flex flex-col gap-0.5 max-h-72 overflow-y-auto'>
            {list.length === 0 ? (
              <div className='px-3 py-4 text-center text-xs text-ui-text-3'>
                {emptyText}
              </div>
            ) : (
              list.map((m) => {
                const selected = value === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      onChange(m.value);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      selected
                        ? 'bg-ui-bg-subtle text-ui-text font-medium'
                        : 'text-ui-text hover:bg-ui-bg-subtle'
                    }`}
                  >
                    <span className='truncate'>{m.label}</span>
                    {selected && (
                      <svg
                        width='14'
                        height='14'
                        viewBox='0 0 14 14'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='flex-shrink-0'
                      >
                        <path d='M2 7l3.5 3.5 6.5-7' />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// 从消息中抽取图片 URL 列表
const getMessageImages = (msg) => {
  if (!msg || !Array.isArray(msg.content)) return [];
  return msg.content
    .filter((p) => p?.type === 'image_url' && p?.image_url?.url)
    .map((p) => p.image_url.url);
};

const UserBubble = ({ children, images = [] }) => (
  <div className='flex justify-end px-2 min-w-0'>
    <div className='max-w-[85%] md:max-w-[75%] min-w-0 flex flex-col items-end gap-2'>
      {images.length > 0 && (
        <div className='flex flex-wrap gap-1.5 justify-end'>
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=''
              className='max-w-[200px] max-h-[180px] rounded-xl border border-ui-border object-cover'
            />
          ))}
        </div>
      )}
      {children && (
        <div
          className='rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-ui-bg-subtle text-ui-text border border-ui-border max-w-full'
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {children}
        </div>
      )}
    </div>
  </div>
);

const AssistantActionBtn = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className='inline-flex items-center justify-center w-7 h-7 rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
  >
    {children}
  </button>
);

const TOPIC_POOL = [
  '帮我写一段 Python 网络爬虫的示例代码',
  '用 30 秒 pitch 一家做向量数据库的初创公司',
  '推荐 5 部值得二刷的科幻电影',
  '用通俗的语言解释 Transformer 模型',
  '给我一份学习 Rust 的两周计划',
  '如何用 React 实现一个虚拟列表？',
  '解释 OAuth 2.0 授权码流程',
  '总结《人类简史》的核心论点',
  '整理我去东京 5 天的行程草稿',
  '对比 PostgreSQL 与 MySQL 的差异',
  '用 Go 实现一个 LRU 缓存',
  '讲讲快排算法的最坏情况',
  '帮我写一份会议纪要的模板',
  '把这段话翻译成简洁的英文：……',
  '写一首关于深夜调试代码的现代诗',
  '设计一份番茄工作法每日计划',
];

const sampleTopics = (n) => {
  const arr = [...TOPIC_POOL];
  const out = [];
  while (out.length < n && arr.length) {
    const idx = Math.floor(Math.random() * arr.length);
    out.push(arr.splice(idx, 1)[0]);
  }
  return out;
};

const AssistantMessage = ({ msg, onRetry, t }) => {
  const text = getTextContent(msg);
  const isError = msg.status === 'error';
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!text) return;
    const ok = await copy(text);
    if (ok) {
      setCopied(true);
      showSuccess(t('已复制'));
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className='flex flex-col gap-1.5 px-4'>
      {isError ? (
        <div className='flex items-start gap-2 text-ui-danger text-sm leading-relaxed'>
          <AlertCircle size={15} className='flex-shrink-0 mt-0.5' />
          <span className='whitespace-pre-wrap break-words'>{text || msg.error || t('请求失败')}</span>
        </div>
      ) : (
        <div className='text-sm text-ui-text leading-relaxed'>
          <MarkdownRenderer content={text || ''} />
        </div>
      )}
      {msg.status !== 'loading' && msg.status !== 'incomplete' && (
        <div className='flex items-center gap-0.5 -ml-1'>
          {!isError && text && (
            <AssistantActionBtn onClick={onCopy} title={copied ? t('已复制') : t('复制')}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </AssistantActionBtn>
          )}
          {onRetry && (
            <AssistantActionBtn onClick={onRetry} title={t('重新生成')}>
              <RotateCcw size={13} />
            </AssistantActionBtn>
          )}
        </div>
      )}
    </div>
  );
};

const Playground = () => {
  const { t } = useTranslation();
  usePageTitle(t('对话'));
  const [userState] = useContext(UserContext);
  const [searchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [chatVersion, setChatVersion] = useState(0);
  const fileInputRef = useRef(null);

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

  // Persist whenever messages settle into a terminal state (complete / error)
  useEffect(() => {
    if (message.length === 0) return;
    const last = message[message.length - 1];
    if (last.status === 'complete' || last.status === 'error') {
      saveMessagesImmediately(message);
    }
  }, [message, saveMessagesImmediately]);

  const handleSend = () => {
    const text = draft.trim();
    const images = pendingImages.slice();
    if ((!text && images.length === 0) || isGenerating) return;
    if (!inputs.model) {
      showWarning(t('请先选择一个模型'));
      return;
    }
    setDraft('');
    setPendingImages([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    inputRef.current?.focus();

    const userMessage = createMessage(
      MESSAGE_ROLES.USER,
      buildMessageContent(text, images, images.length > 0),
    );
    const loading = createLoadingAssistantMessage();

    setMessage((prev) => {
      const next = [...prev, userMessage];
      // 临时把图片塞进 inputs，让 buildApiPayload 也带上
      const inputsWithImages = images.length > 0
        ? { ...inputs, imageEnabled: true, imageUrls: images }
        : inputs;
      const payload = buildApiPayload(next, null, inputsWithImages, parameterEnabled);
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

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddImages = async (files) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    try {
      const dataUrls = await Promise.all(arr.map(fileToDataUrl));
      setPendingImages((prev) => [...prev, ...dataUrls].slice(0, 8));
    } catch (e) {
      showWarning(t('图片读取失败'));
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleAddImages(files);
    }
  };

  const removePendingImage = (i) => {
    setPendingImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleClear = () => {
    // 先中断可能正在进行的流，避免后续 chunk 又把消息塞回来
    if (isGenerating) {
      try { onStopGenerator(); } catch {}
    }
    setMessage([]);
    setPendingImages([]);
    // 强制 chat 区域整体重新挂载，绕过 MarkdownContent 等 React.memo 缓存
    setChatVersion((v) => v + 1);
    // 多个 tick 后再保存一次空数组，确保任何 in-flight 的 setMessage 都已结算
    setTimeout(() => {
      setMessage([]);
      saveMessagesImmediately([]);
    }, 0);
    setTimeout(() => {
      setMessage([]);
      saveMessagesImmediately([]);
      setChatVersion((v) => v + 1);
    }, 200);
  };

  const handleRetry = (assistantIdx) => {
    if (isGenerating) return;
    const upTo = message.slice(0, assistantIdx);
    if (upTo.length === 0 || upTo[upTo.length - 1].role !== MESSAGE_ROLES.USER) {
      showWarning(t('找不到对应的用户消息'));
      return;
    }
    if (!inputs.model) {
      showWarning(t('请先选择一个模型'));
      return;
    }
    const loading = createLoadingAssistantMessage();
    const next = [...upTo, loading];
    setMessage(next);
    const payload = buildApiPayload(upTo, null, inputs, parameterEnabled);
    sendRequest(payload, true);
    setTimeout(() => saveMessagesImmediately(next), 0);
  };

  const canSend = (!!draft.trim() || pendingImages.length > 0) && !!inputs.model;

  const [topics] = useState(() => sampleTopics(4));

  const handlePickTopic = (text) => {
    setDraft(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
    });
  };

  const localizedTopics = topics.map((text) => ({ key: text, label: t(text) }));

  return (
    // 撑满 PageLayout 的 Content 区（已扣除 header 与 sidebar），不再用 fixed 以免缩窗时盖住导航
    <div
      className='absolute inset-0 flex flex-col'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      {/* Messages */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto scrollbar-hide'>
        {message.length === 0 ? (
          (() => {
            const username = userState?.user?.username || '';
            const hour = new Date().getHours();
            const greeting =
              hour < 6 ? t('夜深了')
              : hour < 12 ? t('早上好')
              : hour < 14 ? t('中午好')
              : hour < 18 ? t('下午好')
              : t('晚上好');
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
                <p className='text-ui-text-2 text-sm md:text-base mb-8'>
                  {t('今天想聊点什么？')}
                </p>
                <div className='w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  {localizedTopics.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handlePickTopic(label)}
                      className='text-left px-4 py-3 rounded-2xl border border-ui-border hover:bg-ui-bg-subtle text-[14px] leading-relaxed text-ui-text transition-colors'
                      style={{ backgroundColor: 'var(--page-bg)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()
        ) : (
          <div key={`chat-${chatVersion}`} className='max-w-3xl mx-auto pt-10 pb-6 px-2 space-y-5'>
            {message.map((msg, idx) => {
              const isUser = msg.role === MESSAGE_ROLES.USER;
              // loading dot 持续到真正有文字 / 失败 / 正式 complete 之前
              const text = getTextContent(msg);
              const isLoading =
                !isUser &&
                !text &&
                msg.status !== 'error' &&
                msg.status !== 'complete';

              if (isLoading) {
                return (
                  <div key={msg.id} className='flex justify-start px-4 pt-1'>
                    <span
                      className='inline-block w-2.5 h-2.5 rounded-full bg-ui-text'
                      style={{ animation: 'breath 1.4s ease-in-out infinite' }}
                    />
                  </div>
                );
              }

              if (isUser) {
                const imgs = getMessageImages(msg);
                const text = getTextContent(msg);
                return (
                  <UserBubble key={msg.id} images={imgs}>
                    {text && <span className='whitespace-pre-wrap'>{text}</span>}
                  </UserBubble>
                );
              }

              return (
                <AssistantMessage
                  key={msg.id}
                  msg={msg}
                  onRetry={() => handleRetry(idx)}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Input area: single integrated card */}
      <div className='shrink-0 px-3 md:px-4 pb-4 pt-2'>
        <div className='max-w-3xl mx-auto'>
          <div className='bg-ui-bg-elevated border border-ui-border rounded-[28px] shadow-sm overflow-hidden focus-within:border-ui-text-3 transition-colors'>
            {/* Pending image previews */}
            {pendingImages.length > 0 && (
              <div className='flex flex-wrap gap-2 px-4 pt-4'>
                {pendingImages.map((url, i) => (
                  <div key={i} className='relative group'>
                    <img
                      src={url}
                      alt=''
                      className='w-16 h-16 rounded-xl border border-ui-border object-cover'
                    />
                    <button
                      type='button'
                      onClick={() => removePendingImage(i)}
                      className='absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ui-bg-elevated border border-ui-border text-ui-text-2 hover:text-ui-text hover:border-ui-text-3 transition-colors flex items-center justify-center shadow-sm'
                      aria-label='remove'
                    >
                      <XIcon size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={t('发消息给模型，Enter 发送 / Shift + Enter 换行')}
              className='block w-full resize-none border-0 outline-none focus:ring-0 px-5 pt-4 pb-1 text-[15px] leading-relaxed text-ui-text placeholder:text-ui-text-3'
              style={{ minHeight: '92px', maxHeight: '260px', backgroundColor: 'transparent' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 260)}px`;
              }}
            />

            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              multiple
              hidden
              onChange={(e) => {
                handleAddImages(e.target.files);
                e.target.value = '';
              }}
            />

            {/* Bottom toolbar */}
            <div className='flex items-center justify-between gap-2 px-3 pb-3 min-w-0'>
              <div className='flex items-center gap-1 min-w-0 flex-1 overflow-hidden'>
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  title={t('上传图片')}
                  aria-label={t('上传图片')}
                  className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors flex-shrink-0'
                >
                  <ImagePlus size={16} />
                </button>
                <SelectChip
                  options={groups}
                  value={inputs.group}
                  onChange={(v) => handleInputChange('group', v)}
                  placeholder={t('分组')}
                  emptyText={t('暂无可用分组')}
                />
                <SelectChip
                  options={models}
                  value={inputs.model}
                  onChange={(v) => handleInputChange('model', v)}
                  placeholder={t('选择模型')}
                  emptyText={t('暂无可用模型')}
                />
              </div>
              <div className='flex items-center gap-1.5 flex-shrink-0'>
                {message.length > 0 && (
                  <button
                    onClick={handleClear}
                    title={t('新对话')}
                    aria-label='clear'
                    className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                {isGenerating ? (
                  <button
                    onClick={onStopGenerator}
                    aria-label='stop'
                    className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-ui-bg-subtle text-ui-text hover:bg-ui-border transition-colors'
                  >
                    <Square size={14} fill='currentColor' />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label='send'
                    className='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-30 disabled:hover:bg-ui-accent transition-all duration-150 active:scale-95'
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className='mt-2 text-center text-[11px] text-ui-text-3'>
            {t('模型可能产生不准确的信息，请核实重要内容')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Playground;
