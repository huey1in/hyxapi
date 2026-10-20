import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, MultiSelect, Select, Switch, Textarea } from '../../components/ui';
import { deriveModelMappingPairs, mergeModelMappingPairs, synchronizeModelMapping } from './model-mapping-rules';
import type { ModelMappingDirection, ModelMappingPair, ModelMappingRule, ModelMappingSync } from './model-mapping-rules';
import { findMissingModelsInMapping, parseModelsString, validateModelMappingJson } from './model-mapping-validation';

type Row = ModelMappingPair & { id: number };
type Props = {
  value: string; models: string; upstreamModels: string[];
  onChange: (value: string) => void; onModelsChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void; onFetchUpstream: (signal?: AbortSignal) => Promise<string[]>;
};

function readPairs(value: string): ModelMappingPair[] {
  const validation = validateModelMappingJson(value);
  if (!validation.valid) throw new Error('Mapping must be a JSON object with string values.');
  return Object.entries(JSON.parse(value.trim() || '{}')).map(([from, to]) => ({ from, to: String(to) }));
}

export default function ModelMappingEditor(props: Props) {
  const { t } = useTranslation();
  const id = useId();
  const requestOptions = [...new Set(parseModelsString(props.models))];
  const upstreamOptions = [...new Set(props.upstreamModels)];
  const rowInputs = useRef(new Map<number, HTMLInputElement>());
  const focusRow = useRef<number | null>(null);
  const serial = useRef(0);
  const parseRows = (value: string) => readPairs(value).map((pair) => ({ ...pair, id: ++serial.current }));
  const [rows, setRows] = useState<Row[]>(() => { try { return parseRows(props.value); } catch { return []; } });
  const [mode, setMode] = useState<'visual' | 'json'>(() => validateModelMappingJson(props.value).valid ? 'visual' : 'json');
  const [json, setJSON] = useState(props.value);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [batch, setBatch] = useState(false);
  const [syncModels, setSyncModels] = useState(true);
  const last = useRef(props.value);
  const dirty = useRef(false);
  const synced = useRef<Pick<ModelMappingSync, 'added' | 'removed'>>({ added: [], removed: [] });
  useEffect(() => {
    if (focusRow.current !== null) { rowInputs.current.get(focusRow.current)?.focus(); focusRow.current = null; }
  }, [rows]);

  useEffect(() => {
    if (props.value === last.current) return;
    last.current = props.value; setJSON(props.value);
    try { setRows(parseRows(props.value)); setError(''); }
    catch (cause) { setError(t((cause as Error).message)); setMode('json'); }
  }, [props.value]);
  useEffect(() => props.onValidityChange(!error), [error, props.onValidityChange]);

  const publish = (value: string) => { dirty.current = true; last.current = value; setJSON(value); props.onChange(value); };
  const synchronize = (value: string) => {
    const result = synchronizeModelMapping(parseModelsString(props.models), value, synced.current);
    if (result) {
      synced.current = result; dirty.current = false;
      if (result.models.join(',') !== props.models) props.onModelsChange(result.models.join(','));
    }
  };
  const emitRows = (next: Row[]) => {
    setRows(next);
    const sources = new Set<string>();
    for (const row of next) {
      const from = row.from.trim(); const to = row.to.trim();
      if (!from && !to) continue;
      if (!from || !to) { setError(t('Complete both model names or remove the unfinished row.')); return; }
      if (sources.has(from)) { setError(t('Duplicate request model name: {{name}}', { name: from })); return; }
      sources.add(from);
    }
    setError('');
    const pairs = next.filter((row) => row.from.trim() && row.to.trim()).map((row) => [row.from.trim(), row.to.trim()]);
    publish(pairs.length ? JSON.stringify(Object.fromEntries(pairs), null, 2) : '');
  };
  const updateJSON = (value: string) => {
    publish(value);
    try { readPairs(value); setError(''); } catch (cause) { setError(t((cause as Error).message)); }
  };
  const missing = findMissingModelsInMapping(props.value, parseModelsString(props.models));
  const switchMode = () => {
    if (mode === 'json') {
      try { setRows(parseRows(json)); setError(''); setMode('visual'); }
      catch (cause) { setError(t((cause as Error).message)); }
    } else if (!error) setMode('json');
  };
  const applyBatch = (pairs: ModelMappingPair[], sync: boolean) => {
    const merged = mergeModelMappingPairs(props.value, pairs);
    if (merged === null) { setError(t('Fix the current JSON configuration first.')); return; }
    publish(merged); setRows(parseRows(merged)); setError('');
    if (sync) synchronize(merged);
    setBatch(false);
  };
  return <div className='space-y-3' onKeyDown={(event) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && syncModels && dirty.current && !error) synchronize(last.current);
  }} onBlur={(event) => {
    if (syncModels && dirty.current && !error && !event.currentTarget.contains(event.relatedTarget as Node)) synchronize(last.current);
  }}>
    <p className='text-xs text-ui-text-3'>{t('Users request the name on the left; the gateway sends the name on the right upstream.')}</p>
    <div className='flex flex-wrap items-center gap-2'>
      <Button size='sm' variant='toggle' onClick={switchMode}>{t(mode === 'visual' ? 'Edit JSON' : 'Visual editor')}</Button>
      <Button size='sm' variant='toggle' disabled={!!error} onClick={() => setBatch(true)}>{t('Batch generate mappings')}</Button>
      <label className='flex items-center gap-2 text-xs text-ui-text-2'>
        <Switch size='sm' checked={syncModels} onChange={setSyncModels} />{t('Sync request aliases with channel models')}
      </label>
    </div>
    {mode === 'json' ? <Textarea value={json} onChange={updateJSON} rows={6} width='full' aria-label={t('Model mapping JSON')} /> : <>
      {rows.length > 6 && <Input value={filter} onChange={setFilter} width='full' placeholder={t('Filter request or upstream models')} />}
      <div className='space-y-2 max-h-80 overflow-y-auto'>
        {rows.filter((row) => !filter || `${row.from} ${row.to}`.toLowerCase().includes(filter.toLowerCase())).map((row) => <div key={row.id} className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2'>
          <Input ref={(node) => { if (node) rowInputs.current.set(row.id, node); else rowInputs.current.delete(row.id); }} list={`${id}-requests`} value={row.from} onChange={(from) => emitRows(rows.map((item) => item.id === row.id ? { ...item, from } : item))} width='full' aria-label={t('Request model name')} placeholder={t('Request model name')} />
          <span className='text-ui-text-3 text-xs'>→</span>
          <Input list={`${id}-upstreams`} value={row.to} onChange={(to) => emitRows(rows.map((item) => item.id === row.id ? { ...item, to } : item))} width='full' aria-label={t('Upstream model name')} placeholder={t('Upstream model name')} />
          <button type='button' aria-label={t('Remove mapping {{name}}', { name: row.from || row.id })} onClick={() => emitRows(rows.filter((item) => item.id !== row.id))} className='text-ui-text-3 hover:text-ui-danger shrink-0 cursor-pointer'>×</button>
        </div>)}
      </div>
      <datalist id={`${id}-requests`}>{requestOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <datalist id={`${id}-upstreams`}>{upstreamOptions.map((value) => <option key={value} value={value} />)}</datalist>
      <Button size='sm' variant='toggle' onClick={() => { const next = ++serial.current; focusRow.current = next; setRows([...rows, { id: next, from: '', to: '' }]); }}>{t('Add mapping')}</Button>
    </>}
    {error && <p role='alert' className='text-xs text-ui-danger'>{error}</p>}
    {!error && missing.length > 0 && <div className='space-y-2'>
      <p className='text-xs text-ui-text-3 break-all'>{t('Aliases missing from channel models: {{models}}', { models: missing.join(', ') })}</p>
      <Button size='sm' variant='toggle' onClick={() => props.onModelsChange([...new Set([...parseModelsString(props.models), ...missing])].join(','))}>{t('Add aliases to channel models')}</Button>
    </div>}
    {batch && <MappingBatch models={parseModelsString(props.models)} upstreamModels={props.upstreamModels} current={props.value}
      onFetchUpstream={props.onFetchUpstream} onClose={() => setBatch(false)} onApply={applyBatch} />}
  </div>;
}

function MappingBatch(props: { models: string[]; upstreamModels: string[]; current: string; onFetchUpstream: (signal?: AbortSignal) => Promise<string[]>; onClose: () => void; onApply: (pairs: ModelMappingPair[], sync: boolean) => void }) {
  const { t } = useTranslation();
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => { const controller = new AbortController(); owner.current = controller; return () => { controller.abort(); owner.current = null; }; }, []);
  const [source, setSource] = useState(props.upstreamModels.length ? 'upstream' : 'channel');
  const [upstream, setUpstream] = useState(props.upstreamModels);
  const [selected, setSelected] = useState<string[]>([]);
  const [direction, setDirection] = useState<ModelMappingDirection>(props.upstreamModels.length ? 'upstream' : 'request');
  const [ruleType, setRuleType] = useState<ModelMappingRule['type']>(props.upstreamModels.length ? 'strip-suffix' : 'add-suffix');
  const [affix, setAffix] = useState('');
  const [find, setFind] = useState('');
  const [replacement, setReplacement] = useState('');
  const [sync, setSync] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const candidates = source === 'upstream' ? upstream : props.models;
  const rule: ModelMappingRule = ruleType === 'strip-prefix' || ruleType === 'strip-suffix' ? { type: ruleType, values: affix }
    : ruleType === 'add-prefix' || ruleType === 'add-suffix' ? { type: ruleType, value: affix }
    : { type: 'replace', find, replaceWith: replacement };
  const derived = deriveModelMappingPairs(selected, direction, rule);
  const current = useMemo(() => JSON.parse(props.current.trim() || '{}') as Record<string, string>, [props.current]);
  const replaced = derived.pairs.filter((pair) => Object.hasOwn(current, pair.from) && current[pair.from] !== pair.to);
  const hasRule = ruleType === 'replace' ? !!find : !!affix.trim();
  const fetch = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try { const values = await props.onFetchUpstream(lifetime.signal); lifetime.signal.throwIfAborted(); setUpstream(values); setSource('upstream'); setSelected([]); }
    catch (cause) { if (!lifetime.signal.aborted) setError(t((cause as Error).message || 'Unable to fetch upstream models')); }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  return <Modal open title={t('Batch generate model mappings')} width={720} onClose={props.onClose} onConfirm={() => {}}
    footer={<><Button onClick={props.onClose}>{t('Cancel')}</Button><Button disabled={!hasRule || !derived.pairs.length || (!!replaced.length && !overwrite)}
      onClick={() => props.onApply(derived.pairs, direction === 'upstream' && sync)}>{t('Apply {{count}} mappings', { count: derived.pairs.length })}</Button></>}>
    <label className='block text-sm text-ui-text-2 space-y-2'>{t('Mapping direction')}
      <Select value={direction} onChange={(value) => {
        setDirection(value as ModelMappingDirection); setRuleType(value === 'upstream' ? 'strip-suffix' : 'add-suffix');
        setAffix(''); setFind(''); setReplacement(''); setOverwrite(false);
      }} width='full' options={[
        { value: 'upstream', label: t('Generate request aliases from upstream names') }, { value: 'request', label: t('Generate upstream names from request names') },
      ]} />
    </label>
    <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2'>
      <Select value={source} onChange={(value) => { setSource(value); setSelected([]); }} width='full' options={[
        { value: 'channel', label: t('Channel supported models') }, { value: 'upstream', label: t('Upstream model list') },
      ]} />
      <Button size='sm' disabled={busy} onClick={fetch}>{t(busy ? 'Fetching models…' : 'Fetch upstream models')}</Button>
    </div>
    <MultiSelect value={selected} onChange={setSelected} options={candidates.map((value) => ({ value, label: value }))} width='full' placeholder={t('Select models for the rule')} />
    <div className='flex flex-wrap gap-2'>
      <Button size='sm' variant='toggle' onClick={() => setSelected([...new Set(candidates)])}>{t('Select all models')}</Button>
      <Button size='sm' variant='toggle' onClick={() => setSelected([])}>{t('Clear model selection')}</Button>
    </div>
    <Select value={ruleType} onChange={(value) => { setRuleType(value as ModelMappingRule['type']); setOverwrite(false); }} width='full' options={[
      { value: 'strip-prefix', label: t('Remove prefix') }, { value: 'strip-suffix', label: t('Remove suffix') },
      { value: 'add-prefix', label: t('Add prefix') }, { value: 'add-suffix', label: t('Add suffix') }, { value: 'replace', label: t('Replace text') },
    ]} />
    {ruleType === 'replace' ? <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
      <Input value={find} onChange={setFind} placeholder={t('Find text')} width='full' /><Input value={replacement} onChange={setReplacement} placeholder={t('Replacement text (may be empty)')} width='full' />
    </div> : <Input value={affix} onChange={setAffix} placeholder={t(ruleType.startsWith('strip') ? 'Comma-separated prefixes or suffixes to remove' : 'Prefix or suffix to add')} width='full' />}
    {direction === 'upstream' && <label className='flex items-center gap-2 text-sm text-ui-text-2'><Switch size='sm' checked={sync} onChange={setSync} />{t('Publish request aliases and remove their upstream names')}</label>}
    <div className='space-y-1 max-h-60 overflow-y-auto text-xs' aria-label={t('Mapping preview')}>
      {derived.pairs.map((pair) => <p key={pair.from} className='break-all'>{pair.from} → {pair.to}</p>)}
      {!derived.pairs.length && <p className='text-ui-text-3'>{t('Select models and enter a rule to preview mappings.')}</p>}
    </div>
    {!!derived.unchanged.length && <p className='text-xs text-ui-text-3 break-all'>{t('Unchanged models skipped')}: {derived.unchanged.join(', ')}</p>}
    {!!derived.conflicts.length && <p role='alert' className='text-xs text-ui-danger break-all'>{t('Conflicting models skipped')}: {derived.conflicts.join(', ')}</p>}
    {!!replaced.length && <label className='flex items-center gap-2 text-xs text-ui-danger'><Switch size='sm' checked={overwrite} onChange={setOverwrite} />{t('Allow replacing {{count}} existing request names', { count: replaced.length })}</label>}
    {error && <p role='alert' className='text-xs text-ui-danger'>{error}</p>}
  </Modal>;
}
