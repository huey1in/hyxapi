import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Switch,
  Textarea,
} from '../../components/ui';
import {
  jsonObject,
  numericMap,
  parseJSON,
  serializePairs,
  settingJSON,
  stringMap,
} from './setting-data';
import type { Settings } from './setting-data';

import VisualConfigEditor from '../../components/config/VisualConfigEditor';
import { SettingsDraftContext } from '../../components/config/config-drafts';
import { settingConfigShapes } from './setting-config-shapes';
import { LABELS } from './setting-fields';
import type { ConfigShape } from '../../components/config/config-value';
export { SettingsDraftContext } from '../../components/config/config-drafts';
export type { EditorCache } from '../../components/config/config-drafts';
// Only locally created editor state enters this cache. Server values are parsed
// before initialization. Retaining rows also retains duplicate/blank names on tabs.
function useDraft<T>(key: string, initial: () => T, source: string) {
  const context = useContext(SettingsDraftContext);
  if (!context) throw new Error('Missing settings draft owner');
  const [value, setValue] = useState<T>(() =>
    context.cache.has(key) ? (context.cache.get(key)!.value as T) : initial(),
  );
  useEffect(() => {
    if (!context.cache.has(key)) setValue(initial());
  }, [source, key]);
  const update = (next: T, invalid: boolean) => {
    setValue(next);
    context.cache.set(key, { value: next, invalid });
    context.changed();
  };
  return [value, update, Boolean(context.cache.get(key)?.invalid)] as const;
}
function ErrorText({ invalid }: { invalid: boolean }) {
  const { t } = useTranslation();
  return invalid ? (
    <p role="alert" className="text-xs text-ui-danger">
      {t(
        'Correct invalid settings before saving. Drafts are kept when switching tabs.',
      )}
    </p>
  ) : null;
}
function Remove({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return <IconButton icon={Trash2} title={t('Delete')} onClick={onClick} />;
}
export function ConfigEditor({ configKey, value, onChange, shape, schema = settingJSON[configKey] ?? jsonObject }: {
  configKey: string; value: string; onChange: (value: string) => void; schema?: z.ZodType; shape?: ConfigShape;
}) {
  return <VisualConfigEditor configKey={configKey} label={LABELS[configKey] ?? configKey} value={value} onChange={onChange}
    shape={shape ?? settingConfigShapes[configKey] ?? { type: 'object' }}
    validate={(raw) => parseJSON(raw, schema) !== null} />;
}
type GroupRow = { name: string; ratio: string; desc: string; usable: boolean };
export function GroupRatioEditor({
  values,
  onChange,
  suggestions = [],
}: {
  values: Settings;
  onChange: (key: string, value: string) => void;
  suggestions?: string[];
}) {
  const { t } = useTranslation();
  const ratios = parseJSON(values.GroupRatio || '{}', numericMap);
  const usable = parseJSON(values.UserUsableGroups || '{}', stringMap);
  const [rows, update, invalid] = useDraft<GroupRow[]>(
    'group-rows',
    () =>
      [...new Set([...Object.keys(ratios ?? {}), ...Object.keys(usable ?? {})])]
        .sort()
        .map((name) => ({
          name,
          ratio: String(ratios?.[name] ?? 1),
          desc: usable?.[name] ?? '',
          usable: usable?.[name] !== undefined,
        })),
    values.GroupRatio + '\n' + values.UserUsableGroups,
  );
  if (ratios === null || usable === null)
    return (
      <div className="space-y-3">
        {['GroupRatio', 'UserUsableGroups'].map((key) => (
          <ConfigEditor
            key={key}
            configKey={key}
            value={values[key]}
            onChange={(value) => onChange(key, value)}
          />
        ))}
      </div>
    );
  const sync = (next: GroupRow[]) => {
    const text = serializePairs(
      next.map((row) => ({ key: row.name, value: row.ratio })),
      true,
    );
    update(next, text === null);
    if (text === null) return;
    onChange('GroupRatio', text);
    onChange(
      'UserUsableGroups',
      JSON.stringify(
        Object.fromEntries(
          next
            .filter((row) => row.usable)
            .map((row) => [row.name.trim(), row.desc || row.name.trim()]),
        ),
        null,
        2,
      ),
    );
  };
  const edit = (index: number, patch: Partial<GroupRow>) =>
    sync(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {suggestions
          .filter((name) => !rows.some((row) => row.name === name))
          .map((name) => (
            <Button
              key={name}
              size="sm"
              variant="toggle"
              onClick={() =>
                sync([...rows, { name, ratio: '1', desc: name, usable: false }])
              }
            >
              + {name}
            </Button>
          ))}
      </div>
      {rows.map((row, index) => (
        <div key={index} className="flex min-w-0 flex-wrap items-center gap-2">
          <div style={{ flex: '1 1 100px', minWidth: 0 }}>
            <Input
              aria-label={t('Group name') + ` ${index + 1}`}
              value={row.name}
              onChange={(name) => edit(index, { name })}
              width="full"
            />
          </div>
          <div style={{ width: 80 }}>
            <Input
              aria-label={t('Group ratio') + ` ${index + 1}`}
              value={row.ratio}
              onChange={(ratio) => edit(index, { ratio })}
              width="full"
            />
          </div>
          <div style={{ flex: '1 1 100px', minWidth: 0 }}>
            <Input
              aria-label={t('Description') + ` ${index + 1}`}
              value={row.desc}
              disabled={!row.usable}
              onChange={(desc) => edit(index, { desc })}
              width="full"
            />
          </div>
          <Switch
            aria-label={t('User selectable') + ` ${index + 1}`}
            checked={row.usable}
            onChange={(usable) => edit(index, { usable })}
          />
          <Remove onClick={() => sync(rows.filter((_, i) => i !== index))} />
        </div>
      ))}
      <Button
        size="sm"
        variant="toggle"
        icon={Plus}
        onClick={() =>
          sync([...rows, { name: '', ratio: '1', desc: '', usable: false }])
        }
      >
        {t('Add')}
      </Button>
      <ErrorText invalid={invalid} />
    </div>
  );
}
export function PolicyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <ConfigEditor configKey='global.chat_completions_to_responses_policy' value={value} onChange={onChange} />;
}
export function AffinityRulesEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <ConfigEditor configKey='channel_affinity_setting.rules' value={value} onChange={onChange} />;
}
export function ListEditor({ configKey, value, onChange }: { configKey: string; value: string; onChange: (value: string) => void }) {
  return <ConfigEditor configKey={configKey} value={value} onChange={onChange} />;
}

const formatHtml = (html: string) => {
  const source = String(html || '').trim();
  if (!source) return '';
  const tokens =
    source.replace(/>\s*</g, '><').match(/<![^>]*>|<[^>]+>|[^<]+/g) || [];
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);
  let depth = 0;
  return tokens
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return '';
      if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
      const line = `${'  '.repeat(depth)}${trimmed}`;
      const tag = trimmed.match(/^<([\w-]+)/)?.[1]?.toLowerCase();
      if (
        tag &&
        !voidTags.has(tag) &&
        !/\/>$/.test(trimmed) &&
        !/^<!/.test(trimmed) &&
        !trimmed.includes(`</${tag}>`)
      )
        depth += 1;
      return line;
    })
    .filter(Boolean)
    .join('\n');
};

export const emailTemplateKeys = new Set([
  'EmailTemplateVerification',
  'EmailTemplatePasswordReset',
]);
export function EmailTemplateEditor({
  configKey,
  value,
  onChange,
}: {
  configKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('edit');
  const reset = configKey === 'EmailTemplatePasswordReset';
  const preview = useMemo(
    () =>
      value
        .replaceAll('{{siteName}}', 'HyxAPI')
        .replaceAll('{{code}}', '482913')
        .replaceAll('{{expireMinutes}}', '10')
        .replaceAll(
          '{{resetLink}}',
          `${window.location.origin}/user/reset?email=example%40example.com&token=example`,
        ),
    [value],
  );
  return (
    <div className="email-template-editor">
      <div className="email-template-editor__toolbar">
        <div className="email-template-editor__modes">
          {['edit', 'preview'].map((item) => (
            <Button
              key={item}
              size="sm"
              variant="toggle"
              selected={mode === item}
              onClick={() => setMode(item)}
            >
              {t(item === 'edit' ? 'Edit' : 'Preview')}
            </Button>
          ))}
        </div>
        {mode === 'edit' && (
          <Button
            size="sm"
            variant="link"
            onClick={() => onChange(formatHtml(value))}
          >
            {t('Format HTML')}
          </Button>
        )}
      </div>
      {mode === 'edit' ? (
        <Textarea
          aria-label={t('Email template')}
          value={value}
          onChange={onChange}
          rows={18}
          spellCheck={false}
        />
      ) : (
        <div className="email-template-editor__preview">
          <div className="email-template-editor__preview-label">
            {t('Sample preview')}
          </div>
          <iframe title={t('Email preview')} sandbox="" srcDoc={preview} />
        </div>
      )}
      <div className="email-template-editor__variables">
        {t('Available variables')}: {'{{siteName}}'},{' '}
        {reset ? '{{resetLink}}' : '{{code}}'}, {'{{expireMinutes}}'}
      </div>
    </div>
  );
}
