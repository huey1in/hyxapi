import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Square, Trash2, Copy, Check, AlertCircle, RotateCcw, ImagePlus, X,
} from 'lucide-react';
import { API, showError, showSuccess, showWarning, copy as copyText } from '../../helpers';
import { UserContext } from '../../context/User';
import { Button, IconButton, Select, Textarea } from '../../components/ui';
import { cn } from '../../components/ui/tokens';

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

const UserBubble = ({ children, images = [] }) => (
  <div className='flex justify-end px-2 min-w-0'>
    <div className='max-w-[85%] md:max-w-[75%] min-w-0 flex flex-col items-end gap-2'>
      {images.length > 0 && (
        <div className='flex flex-wrap gap-1.5 justify-end'>
          {images.map((url, i) => (
            <img key={i} src={url} alt=''
              className='max-w-[200px] max-h-[180px] rounded-xl border border-ui-border object-cover' />
          ))}
        </div>
      )}
      {children && (
        <div
          className='rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-ui-bg-subtle text-ui-text-1 border border-ui-border max-w-full'
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {children}
        </div>
      )}
    </div>
  </div>
);

const AssistantMessage = ({ msg, onRetry }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!msg.content) return;
    const ok = await copyText(msg.content);
    if (ok) { setCopied(true); showSuccess('已复制'); setTimeout(() => setCopied(false), 1500); }
  };
  const isError = msg.status === 'error';
  return (
    <div className='flex flex-col gap-1.5 px-4'>
      {isError ? (
        <div className='flex items-start gap-2 text-ui-danger text-sm leading-relaxed'>
          <AlertCircle size={15} className='flex-shrink-0 mt-0.5' />
          <span className='whitespace-pre-wrap break-words'>{msg.content || msg.error || '请求失败'}</span>
        </div>
      ) : (
        <div className='text-sm text-ui-text-1 leading-relaxed whitespace-pre-wrap break-words'>
          {msg.content || ''}
        </div>
      )}
      {msg.status !== 'loading' && (
        <div className='flex items-center gap-0.5 -ml-1'>
          {!isError && msg.content && (
            <IconButton size='sm' icon={copied ? Check : Copy} onClick={onCopy} title={copied ? '已复制' : '复制'} aria-label='copy' />
          )}
          {onRetry && (
            <IconButton size='sm' icon={RotateCcw} onClick={onRetry} title='重新生成' aria-label='retry' />
          )}
        </div>
      )}
    </div>
  );
};

const ChatPage = () => {
  const [userState] = useContext(UserContext);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [topics] = useState(() => sampleTopics(4));
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/user/self/groups');
        if (res.data?.success && res.data.data) {
          const opts = Object.entries(res.data.data).map(([value, info]) => ({
            value,
            label: info?.desc || value,
          }));
          setGroups(opts);
          if (opts[0]) setGroup(opts[0].value);
        }
      } catch {}
    })();
  }, []);

  // Reload model list whenever the selected group changes.
  useEffect(() => {
    (async () => {
      try {
        const params = group ? `?group=${encodeURIComponent(group)}` : '';
        const res = await API.get(`/api/user/models${params}`);
        const list = res.data?.success ? res.data.data : (res.data?.data || []);
        const names = Array.isArray(list) ? list.map((m) => m.id || m).filter(Boolean) : [];
        setModels(names);
        if (!names.includes(model)) setModel(names[0] || '');
      } catch {
        setModels([]);
      }
    })();
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const isGenerating = sending;
  const canSend = (draft.trim() || pendingImages.length > 0) && !sending && model;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const buildContent = (text, images) => {
    if (!images.length) return text;
    const parts = [];
    if (text) parts.push({ type: 'text', text });
    images.forEach((url) => parts.push({ type: 'image_url', image_url: { url } }));
    return parts;
  };

  const renderUserContent = (m) => {
    if (typeof m.content === 'string') return { text: m.content, images: [] };
    if (!Array.isArray(m.content)) return { text: '', images: [] };
    const images = m.content.filter((p) => p?.type === 'image_url').map((p) => p.image_url.url);
    const text = m.content.filter((p) => p?.type === 'text').map((p) => p.text).join('');
    return { text, images };
  };

  const removePendingImage = (i) => setPendingImages((p) => p.filter((_, idx) => idx !== i));

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const handleAddImages = async (files) => {
    if (!files || files.length === 0) return;
    const urls = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try { urls.push(await fileToDataUrl(f)); } catch {}
    }
    if (urls.length) setPendingImages((p) => [...p, ...urls]);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      await handleAddImages(files);
    }
  };

  const handlePickTopic = (text) => {
    setDraft(text);
    setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 260)}px`;
      }
    }, 0);
  };

  const handleClear = () => {
    setMessages([]);
    setDraft('');
    setPendingImages([]);
  };

  const sendRequest = async (history) => {
    setSending(true);
    setMessages((p) => [...p, { id: `a-${Date.now()}`, role: 'assistant', content: '', status: 'loading' }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const resp = await fetch('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'New-API-User': String(userState?.user?.id || JSON.parse(localStorage.getItem('user') || '{}').id || ''),
        },
        body: JSON.stringify({ model, messages: history, stream: true, group }),
        signal: ctrl.signal,
        credentials: 'include',
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const ln of lines) {
          const s = ln.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            const delta = obj.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              setMessages((prev) => {
                const next = prev.slice();
                next[next.length - 1] = { ...next[next.length - 1], content: accumulated, status: 'incomplete' };
                return next;
              });
            }
          } catch {}
        }
      }
      setMessages((prev) => {
        const next = prev.slice();
        next[next.length - 1] = { ...next[next.length - 1], status: 'complete' };
        return next;
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = { ...next[next.length - 1], status: 'error', error: e.message };
          return next;
        });
        showError(e.message || '请求失败');
      } else {
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = { ...next[next.length - 1], status: 'complete' };
          return next;
        });
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    const imgs = pendingImages.slice();
    if ((!text && imgs.length === 0) || sending) return;
    if (!model) return showWarning('请先选择一个模型');

    setDraft('');
    setPendingImages([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: buildContent(text, imgs) };
    const history = [...messages, userMsg];
    setMessages(history);
    await sendRequest(history.map(({ id, status, error, ...rest }) => rest));
  };

  const handleRetry = async (idx) => {
    if (sending) return;
    const history = messages.slice(0, idx).filter((m) => m.role !== 'assistant' || m.status === 'complete');
    setMessages(messages.slice(0, idx));
    await sendRequest(history.map(({ id, status, error, ...rest }) => rest));
  };

  const onStop = () => abortRef.current?.abort();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const localizedTopics = useMemo(() => topics.map((t) => ({ key: t, label: t })), [topics]);
  const username = userState?.user?.username || '';

  return (
    <div className='flex flex-col h-[calc(100vh-64px)]' style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Messages */}
      <div ref={scrollRef} className='flex-1 overflow-y-auto ui-scrollbar'>
        {messages.length === 0 ? (
          <div className='h-full flex flex-col items-center justify-center text-center px-6'>
            <h2 className='text-3xl md:text-5xl font-bold text-ui-text-1 mb-3' style={{ letterSpacing: '-0.025em' }}>
              {greeting()}
              {username && <>，<span className='text-ui-accent'>{username}</span></>}
            </h2>
            <p className='text-ui-text-2 text-sm md:text-base mb-8'>今天想聊点什么？</p>
            <div className='w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {localizedTopics.map(({ key, label }) => (
                <Button key={key} variant='toggle' block onClick={() => handlePickTopic(label)} justify='start'>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className='max-w-3xl mx-auto pt-10 pb-6 px-2 space-y-5'>
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLoading = !isUser && !msg.content && msg.status !== 'error' && msg.status !== 'complete';
              if (isLoading) {
                return (
                  <div key={msg.id} className='flex justify-start px-4 pt-1'>
                    <span className='inline-block w-2.5 h-2.5 rounded-full bg-ui-text-1 animate-pulse' />
                  </div>
                );
              }
              if (isUser) {
                const { text, images } = renderUserContent(msg);
                return (
                  <UserBubble key={msg.id} images={images}>
                    {text && <span className='whitespace-pre-wrap'>{text}</span>}
                  </UserBubble>
                );
              }
              return <AssistantMessage key={msg.id} msg={msg} onRetry={() => handleRetry(idx)} />;
            })}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className='shrink-0 px-3 md:px-4 pb-4 pt-2'>
        <div className='max-w-3xl mx-auto space-y-2'>
          {pendingImages.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {pendingImages.map((url, i) => (
                <div key={i} className='relative group'>
                  <img src={url} alt='' className='w-16 h-16 rounded-xl border border-ui-border object-cover' />
                  <button
                    onClick={() => removePendingImage(i)}
                    className='absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--page-bg)] border border-ui-border flex items-center justify-center text-ui-text-2 hover:text-ui-danger'
                    aria-label='remove'
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            ref={inputRef}
            value={draft}
            onChange={setDraft}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={3}
            width='full'
            size={44}
            autoResize
            placeholder='发消息给模型，Enter 发送 / Shift + Enter 换行'
            footer={
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1.5'>
                  <IconButton icon={ImagePlus} onClick={() => fileInputRef.current?.click()} title='上传图片' aria-label='上传图片' />
                  {groups.length > 0 && (
                    <Select
                      value={group}
                      onChange={setGroup}
                      options={groups}
                      placeholder='分组'
                      placement='top-start'
                      size={32}
                      width={128}
                    />
                  )}
                  <Select
                    value={model}
                    onChange={setModel}
                    options={models.map((m) => ({ value: m, label: m }))}
                    placeholder='选择模型'
                    placement='top-start'
                    size={32}
                    width={180}
                  />
                </div>
                <div className='flex items-center gap-1.5'>
                  {messages.length > 0 && (
                    <IconButton icon={Trash2} onClick={handleClear} title='新对话' aria-label='clear' />
                  )}
                  {isGenerating ? (
                    <IconButton icon={Square} size='lg' onClick={onStop} aria-label='stop' />
                  ) : (
                    <IconButton icon={Send} size='lg' onClick={handleSend} disabled={!canSend} aria-label='send' />
                  )}
                </div>
              </div>
            }
          />

          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            multiple
            hidden
            onChange={(e) => { handleAddImages(e.target.files); e.target.value = ''; }}
          />

          <p className='text-center text-[11px] text-ui-text-3'>
            模型可能产生不准确的信息，请核实重要内容
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
