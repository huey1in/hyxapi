import { useTranslation } from 'react-i18next';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input, Textarea } from '../../components/ui';
import { cn } from '../../components/ui/tokens';
import { readOverridePairs, writeOverridePairs } from './channel-data';
import type { OverridePair } from './channel-data';
export { default as Field } from '../../components/ui/input/FormField';
const MODEL_ICON_CDN =
  'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light';

const CHANNEL_TYPE_ICON_SLUG: Record<number, string> = {
  1: 'openai',
  3: 'azureai-color',
  14: 'claude-color',
  24: 'gemini-color',
  41: 'vertexai-color',
  33: 'aws-color',
  17: 'qwen-color',
  16: 'zhipu-color',
  25: 'moonshot-color',
  36: 'suno-color',
  43: 'deepseek-color',
  48: 'xai',
  20: 'openrouter',
  40: 'siliconcloud-color',
  4: 'ollama',
  34: 'cohere-color',
  39: 'cloudflare-color',
  42: 'mistral-color',
  45: 'volcengine-color',
  35: 'minimax-color',
  49: 'coze',
};

const getModelIconSlug = (model: string, channelType: number) => {
  const name = String(model || '').toLowerCase();
  if (/claude/.test(name)) return 'claude-color';
  if (/deepseek/.test(name)) return 'deepseek-color';
  if (/gemini|palm/.test(name)) return 'gemini-color';
  if (/gpt|o1|o3|o4|dall|whisper|text-embedding/.test(name)) return 'openai';
  if (/qwen|qwq|tongyi/.test(name)) return 'qwen-color';
  if (/glm|chatglm/.test(name)) return 'zhipu-color';
  if (/moonshot|kimi/.test(name)) return 'moonshot-color';
  if (/mistral|mixtral|codestral/.test(name)) return 'mistral-color';
  if (/grok|xai/.test(name)) return 'xai';
  if (/llama/.test(name)) return 'meta-color';
  if (/command|cohere/.test(name)) return 'cohere-color';
  return CHANNEL_TYPE_ICON_SLUG[channelType] || 'openai';
};

export const ModelCdnIcon = ({
  model,
  channelType,
}: {
  model: string;
  channelType: number;
}) => {
  const [failed, setFailed] = useState(false);
  const slug = getModelIconSlug(model, channelType);
  if (failed) {
    return (
      <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ui-bg-subtle text-[10px] font-semibold text-ui-text-3'>
        {String(model || '?')
          .slice(0, 1)
          .toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`${MODEL_ICON_CDN}/${slug}.png`}
      alt=''
      className='h-6 w-6 shrink-0 rounded-md object-contain'
      loading='lazy'
      onError={() => setFailed(true)}
    />
  );
};

export const MULTI_KEY_MODE_OPTIONS: {
  value: 'random' | 'polling';
  label: string;
}[] = [
  { value: 'random', label: '随机' },
  { value: 'polling', label: '轮询' },
];
export const KeyValueEditor = ({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  hint,
  jsonValues = false,
}: {
  value: string;
  onChange: (value: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  hint?: string;
  jsonValues?: boolean;
}) => {
  const { t } = useTranslation();
  const parsePairs = (input: string): OverridePair[] => {
    try {
      return readOverridePairs(input);
    } catch {
      return [];
    }
  };

  const [pairs, setPairs] = useState(() => parsePairs(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setPairs(parsePairs(value));
    }
  }, [value]);

  const sync = (newPairs: ReturnType<typeof parsePairs>) => {
    setPairs(newPairs);
    const next = writeOverridePairs(newPairs, jsonValues);
    last.current = next;
    onChange(next);
  };

  const add = () =>
    setPairs((p) => [...p, { k: '', v: '', original: '', changed: true }]);
  const remove = (i: number) => sync(pairs.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'k' | 'v', val: string) => {
    const next = [...pairs];
    next[i] = {
      ...next[i],
      [field]: val,
      changed: field === 'v' ? true : next[i].changed,
    };
    sync(next);
  };

  let invalid = false;
  try {
    readOverridePairs(value);
  } catch {
    invalid = true;
  }
  if (invalid)
    return (
      <Textarea
        aria-label={t('Repair JSON configuration')}
        value={value}
        onChange={onChange}
        rows={5}
        invalid
      />
    );
  return (
    <div className='w-full min-w-0 space-y-2'>
      {hint && <p className='text-xs text-ui-text-3 break-words'>{hint}</p>}
      {pairs.length === 0 && (
        <p className='text-xs text-ui-text-3 py-2'>
          {t('暂无数据，点击下方按钮添加键值对')}
        </p>
      )}
      {pairs.map((p, i) => (
        <div key={i} className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2'>
          <Input
            value={p.k}
            onChange={(v) => update(i, 'k', v)}
            width='full'
            placeholder={keyPlaceholder ?? t('键')}
          />
          <span className='text-ui-text-3 text-xs shrink-0'>→</span>
          <Input
            value={p.v}
            onChange={(v) => update(i, 'v', v)}
            width='full'
            placeholder={valuePlaceholder ?? t('值')}
          />
          <button
            type='button'
            onClick={() => remove(i)}
            className='text-ui-text-3 hover:text-red-500 cursor-pointer text-sm shrink-0'
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={add}
        className='text-xs text-ui-text-2 hover:text-ui-text cursor-pointer underline'
      >
        {t('+ 添加键值对')}
      </button>
    </div>
  );
};
export const ModelTagList = ({
  models,
  onChange,
}: {
  models: string;
  onChange: (value: string) => void;
}) => {
  const { t } = useTranslation();
  const list = models
    ? models
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.join(','));
  };

  if (list.length === 0) {
    return (
      <p className='text-xs text-ui-text-3 py-2'>
        {t('暂无模型，请通过上方按钮添加或手动输入')}
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 0',
        maxHeight: 180,
        overflowY: 'auto',
      }}
    >
      {list.map((m, i) => (
        <span
          key={`${m}-${i}`}
          className='min-w-0 max-w-full'
          title={m}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            paddingInline: 10,
            borderRadius: 13,
            fontSize: 12,
            color: 'var(--ui-text)',
            background: 'var(--ui-bg-subtle)',
          }}
        >
          <span className='min-w-0 truncate'>{m}</span>
          <button
            onClick={() => remove(i)}
            style={{
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              color: 'var(--ui-text-3)',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
};

export const Section = ({
  title,
  collapsible,
  children,
}: PropsWithChildren<{ title: ReactNode; collapsible?: boolean }>) => {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 mb-3',
          collapsible && 'cursor-pointer',
        )}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <span className='text-sm font-medium text-ui-text'>{title}</span>
        <div className='flex-1 h-px bg-[#eeeeee]' />
        {collapsible && (
          <ChevronDown
            size={14}
            className='text-ui-text-3'
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        )}
      </div>
      {open && <div className='space-y-4'>{children}</div>}
    </div>
  );
};
