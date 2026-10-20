import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  NumberInput,
  Select,
  Switch,
  TagInput,
  Textarea,
} from '../../components/ui';
import {
  affinityRuleSchema,
  jsonObject,
  numericMap,
  parseJSON,
  serializePairs,
  settingJSON,
  stringMap,
} from './setting-data';
import type { AffinityRule, Pair, Settings } from './setting-data';

export type EditorCache = Map<string, { value: unknown; invalid: boolean }>;
export const SettingsDraftContext = createContext<{
  cache: EditorCache;
  changed: () => void;
} | null>(null);
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
export function RawJSONEditor({
  configKey,
  value,
  onChange,
  schema = settingJSON[configKey] ?? jsonObject,
}: {
  configKey: string;
  value: string;
  onChange: (value: string) => void;
  schema?: z.ZodType;
}) {
  const { t } = useTranslation();
  const invalid = parseJSON(value, schema) === null;
  const context = useContext(SettingsDraftContext);
  const update = (text: string) => {
    context?.cache.delete(configKey);
    if (configKey === 'GroupRatio' || configKey === 'UserUsableGroups')
      context?.cache.delete('group-rows');
    context?.changed();
    onChange(text);
  };
  return (
    <div className="space-y-2">
      <Textarea
        aria-label={`${configKey} JSON`}
        value={value}
        rows={10}
        spellCheck={false}
        invalid={invalid}
        onChange={update}
        width="full"
      />
      <ErrorText invalid={invalid} />
      <p className="text-xs text-ui-text-3">
        {t('Edit JSON to preserve nested configuration and additional fields.')}
      </p>
    </div>
  );
}
export function RatioEditor({
  configKey,
  value,
  onChange,
  numericValue = true,
}: {
  configKey: string;
  value: string;
  onChange: (value: string) => void;
  numericValue?: boolean;
}) {
  const { t } = useTranslation();
  const parsed = parseJSON(
    value || '{}',
    numericValue ? numericMap : stringMap,
  );
  const [pairs, update, invalid] = useDraft<Pair[]>(
    configKey,
    () =>
      Object.entries(parsed ?? {}).map(([key, item]) => ({
        key,
        value: String(item),
      })),
    value,
  );
  if (parsed === null)
    return (
      <RawJSONEditor configKey={configKey} value={value} onChange={onChange} />
    );
  const sync = (rows: Pair[]) => {
    const text = serializePairs(rows, numericValue);
    update(
      rows,
      text === null || parseJSON(text, settingJSON[configKey]) === null,
    );
    if (text !== null) onChange(text);
  };
  return (
    <div className="space-y-2">
      {pairs.map((pair, index) => (
        <div key={index} className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              aria-label={t('Name') + ` ${index + 1}`}
              value={pair.key}
              width="full"
              onChange={(key) =>
                sync(
                  pairs.map((row, i) => (i === index ? { ...row, key } : row)),
                )
              }
            />
          </div>
          <div style={{ width: 100, flexShrink: 0 }}>
            <Input
              aria-label={
                t(numericValue ? 'Ratio' : 'Description') + ` ${index + 1}`
              }
              value={pair.value}
              width="full"
              onChange={(item) =>
                sync(
                  pairs.map((row, i) =>
                    i === index ? { ...row, value: item } : row,
                  ),
                )
              }
            />
          </div>
          <Remove onClick={() => sync(pairs.filter((_, i) => i !== index))} />
        </div>
      ))}
      <Button
        size="sm"
        variant="toggle"
        icon={Plus}
        onClick={() =>
          sync([...pairs, { key: '', value: numericValue ? '1' : '' }])
        }
      >
        {t('Add')}
      </Button>
      <ErrorText invalid={invalid} />
    </div>
  );
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
          <RawJSONEditor
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
export function PolicyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const key = 'global.chat_completions_to_responses_policy';
  const obj = parseJSON(value || '{}', jsonObject);
  if (!obj || parseJSON(value || '{}', settingJSON[key]) === null)
    return <RawJSONEditor configKey={key} value={value} onChange={onChange} />;
  return (
    <div className="space-y-3">
      {[
        { key: 'enabled', label: 'Enabled', checked: obj.enabled === true },
        {
          key: 'all_channels',
          label: 'All channels',
          checked: obj.all_channels !== false,
        },
      ].map((field) => (
        <div key={field.key} className="flex items-center justify-between">
          <span className="text-xs text-ui-text-2">{t(field.label)}</span>
          <Switch
            aria-label={t(field.label)}
            checked={field.checked}
            onChange={(enabled) =>
              onChange(JSON.stringify({ ...obj, [field.key]: enabled }))
            }
          />
        </div>
      ))}
    </div>
  );
}
type AffinityDraft = {
  [key: string]: unknown;
  name?: string;
  model_regex?: string[] | null;
  path_regex?: string[] | null;
  user_agent_include?: string[] | null;
  key_sources: AffinityRule['key_sources'];
  ttl_seconds: number | '';
  value_regex?: string;
  session_mode?: AffinityRule['session_mode'];
  skip_retry_on_failure?: boolean;
  include_using_group?: boolean;
  include_model_name?: boolean;
  include_rule_name?: boolean;
  sourcesText: string;
  templateText: string;
};
export function AffinityRulesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const key = 'channel_affinity_setting.rules';
  const parsed = parseJSON(value || '[]', z.array(affinityRuleSchema));
  const [rows, update, invalid] = useDraft<AffinityDraft[]>(
    key,
    () =>
      (parsed ?? []).map((row) => ({
        ...row,
        sourcesText: JSON.stringify(row.key_sources, null, 2),
        templateText: JSON.stringify(
          row.param_override_template ?? {},
          null,
          2,
        ),
      })),
    value,
  );
  if (parsed === null)
    return <RawJSONEditor configKey={key} value={value} onChange={onChange} />;
  const sync = (next: AffinityDraft[]) => {
    const serialized = next.map(({ sourcesText, templateText, ...row }) => ({
      ...row,
      key_sources: parseJSON(sourcesText, z.array(jsonObject)),
      param_override_template: parseJSON(templateText, jsonObject),
    }));
    const valid =
      next.every((row) => parseJSON(row.templateText, jsonObject) !== null) &&
      z.array(affinityRuleSchema).safeParse(serialized).success;
    update(next, !valid);
    if (valid) onChange(JSON.stringify(serialized));
  };
  const edit = (index: number, patch: Partial<AffinityDraft>) =>
    sync(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className="space-y-3 rounded-xl border border-ui-border p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label={t('Rule name') + ` ${index + 1}`}
              width="full"
              value={row.name ?? ''}
              onChange={(name) => edit(index, { name })}
            />
            <Remove onClick={() => sync(rows.filter((_, i) => i !== index))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['model_regex', 'path_regex', 'user_agent_include'] as const).map(
              (field) => (
                <div key={field} className="min-w-0">
                  <div className="mb-1 text-xs text-ui-text-3">{t(field)}</div>
                  <TagInput
                    value={row[field] ?? []}
                    onChange={(values) => edit(index, { [field]: values })}
                  />
                </div>
              ),
            )}
            <div>
              <div className="mb-1 text-xs text-ui-text-3">
                {t('Session value regex')}
              </div>
              <Input
                aria-label={t('Session value regex') + ` ${index + 1}`}
                value={row.value_regex ?? ''}
                width="full"
                onChange={(value_regex) => edit(index, { value_regex })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-ui-text-3">
                {t('TTL (seconds)')}
              </div>
              <NumberInput
                aria-label={t('TTL (seconds)') + ` ${index + 1}`}
                min={0}
                value={row.ttl_seconds}
                onChange={(ttl_seconds) => edit(index, { ttl_seconds })}
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-ui-text-3">
                {t('Session mode')}
              </div>
              <Select
                value={row.session_mode ?? ''}
                options={['', 'inherit', 'off', 'prefer', 'strict'].map(
                  (mode) => ({
                    value: mode,
                    label: mode
                      ? t(mode)
                      : t(
                          row.skip_retry_on_failure
                            ? 'Legacy strict mode'
                            : 'Legacy preferred mode',
                        ),
                  }),
                )}
                onChange={(mode) => {
                  const session_mode =
                    affinityRuleSchema.shape.session_mode.parse(mode);
                  edit(index, { session_mode });
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {(
              [
                'include_using_group',
                'include_model_name',
                'include_rule_name',
              ] as const
            ).map((field) => (
              <label
                key={field}
                className="flex items-center gap-2 text-xs text-ui-text-2"
              >
                {t(field)}
                <Switch
                  aria-label={t(field)}
                  checked={row[field] === true}
                  onChange={(enabled) => edit(index, { [field]: enabled })}
                />
              </label>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-xs text-ui-text-2">
              {t('Session key sources')}
            </summary>
            <Textarea
              aria-label={t('Session key sources') + ` ${index + 1}`}
              rows={5}
              value={row.sourcesText}
              onChange={(sourcesText) => edit(index, { sourcesText })}
              spellCheck={false}
              width="full"
            />
          </details>
          <details>
            <summary className="cursor-pointer text-xs text-ui-text-2">
              {t('Request transformation template')}
            </summary>
            <Textarea
              aria-label={
                t('Request transformation template') + ` ${index + 1}`
              }
              rows={6}
              value={row.templateText}
              onChange={(templateText) => edit(index, { templateText })}
              spellCheck={false}
              width="full"
            />
          </details>
        </div>
      ))}
      <ErrorText invalid={invalid} />
      <p className="text-xs text-ui-text-3">
        {t(
          'Preferred mode can switch channels after failure. Strict mode keeps the bound channel. Disabling binding preserves the request template.',
        )}
      </p>
      <Button
        size="sm"
        variant="toggle"
        icon={Plus}
        onClick={() =>
          sync([
            ...rows,
            {
              name: '',
              model_regex: [],
              key_sources: [{ type: 'gjson', path: '' }],
              ttl_seconds: 0,
              session_mode: 'inherit',
              sourcesText: '[{"type":"gjson","path":""}]',
              templateText: '{}',
            },
          ])
        }
      >
        {t('Add rule')}
      </Button>
    </div>
  );
}
const listFields: Record<string, string[]> = {
  'console_setting.announcements': ['content', 'type', 'extra'],
  PayMethods: ['name', 'type', 'color', 'min_topup'],
};
export function ListEditor({
  configKey,
  value,
  onChange,
}: {
  configKey: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const rows = parseJSON(value || '[]', z.array(jsonObject));
  if (rows === null)
    return (
      <RawJSONEditor configKey={configKey} value={value} onChange={onChange} />
    );
  const sync = (items: typeof rows) => onChange(JSON.stringify(items));
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex min-w-0 flex-wrap items-end gap-2 rounded-xl border border-ui-border p-3"
        >
          {listFields[configKey].map((field) => (
            <div
              key={field}
              style={{
                flex: field === 'content' ? '1 1 100%' : '1 1 140px',
                minWidth: 0,
              }}
            >
              <div className="mb-1 text-xs text-ui-text-3">{t(field)}</div>
              {field === 'content' ? (
                <Textarea
                  aria-label={t(field) + ` ${index + 1}`}
                  rows={6}
                  value={String(row[field] ?? '')}
                  onChange={(item) =>
                    sync(
                      rows.map((entry, i) =>
                        i === index ? { ...entry, [field]: item } : entry,
                      ),
                    )
                  }
                  width="full"
                />
              ) : (
                <Input
                  aria-label={t(field) + ` ${index + 1}`}
                  value={String(row[field] ?? '')}
                  onChange={(item) =>
                    sync(
                      rows.map((entry, i) =>
                        i === index ? { ...entry, [field]: item } : entry,
                      ),
                    )
                  }
                  width="full"
                />
              )}
            </div>
          ))}
          <Remove onClick={() => sync(rows.filter((_, i) => i !== index))} />
        </div>
      ))}
      <ErrorText
        invalid={parseJSON(value || '[]', settingJSON[configKey]) === null}
      />
      <Button
        size="sm"
        variant="toggle"
        icon={Plus}
        onClick={() =>
          sync([
            ...rows,
            configKey === 'PayMethods'
              ? { name: '', type: '', color: '', min_topup: '' }
              : {
                  content: '',
                  type: 'default',
                  extra: '',
                  publishDate: new Date().toISOString(),
                },
          ])
        }
      >
        {t('Add')}
      </Button>
    </div>
  );
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
        .replaceAll('{{siteName}}', 'Hyxware')
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
