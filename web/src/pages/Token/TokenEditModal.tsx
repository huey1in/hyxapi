import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import { Button, Input, NumberInput, Switch, Select, MultiSelect, SlideOver, showError as notifyError } from '../../components/ui';
import SortableMultiSelect from '../../components/ui/select/SortableMultiSelect';
import { autoGroupsPayload, initialTokenGroupSelection, reconcileAutoGroups, validateAutoGroups } from './autoGroups';
import type { AutoGroupMode } from './autoGroups';
import type { ManagedToken } from './token-management';
import { tokenErrorMessage } from './token-management';
import type { ApiEnvelope } from '../../types/api';

type Draft = Partial<ManagedToken>;
type TokenForm = Draft & { automatic: boolean; auto_groups_mode: AutoGroupMode; auto_groups: string[]; groups: string[] };
type GroupOption = { value: string; label: string };
type AutoConfig = { groups: string[]; max_count: number };
type Props = { open: boolean; token: Draft | null; onClose: () => void; onSaved: () => void; onChanged: () => void };
const toLocalInput = (ts?: number) => {
  if (!ts || ts === -1) return '';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnix = (v: string) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

const TokenEditModal = ({ open, token, onClose, onSaved, onChanged }: Props) => {
  const { t } = useTranslation();
  const showError = (error: unknown) => { const message = tokenErrorMessage(error); if (message) notifyError(t(message)); };
  const isEdit = !!token?.id;
  const lifetime = useRef<AbortController | null>(null);
  const savingLock = useRef(false);
  const [createCount, setCreateCount] = useState<number | ''>(1);
  const [form, setForm] = useState<TokenForm>({ automatic: true, auto_groups_mode: 'inherit', auto_groups: [], groups: [] });
  const [groups, setGroups] = useState<string[]>([]);
  const [models, setModels] = useState<GroupOption[]>([]);
  const [autoConfig, setAutoConfig] = useState<AutoConfig>({ groups: [], max_count: 5 });
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [autoNotice, setAutoNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const u = <K extends keyof TokenForm>(key: K) => (value: TokenForm[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!open) return;
    const owner = new AbortController(); lifetime.current = owner;
    savingLock.current = false; setSaving(false); setCreateCount(1);
    return () => { owner.abort(); if (lifetime.current === owner) lifetime.current = null; };
  }, [open, token?.id]);

  useEffect(() => {
    if (!token) return;
    const selection = initialTokenGroupSelection(token);
    setForm({
      ...token,
      model_limits_enabled: token.model_limits_enabled || false,
      model_limits: token.model_limits || '',
      allow_ips: token.allow_ips || '',
      cross_group_retry: !!token.cross_group_retry,
      groups: selection.groups,
      automatic: selection.automatic,
      auto_groups_mode: token.auto_groups?.length ? 'custom' : 'inherit',
      auto_groups: token.auto_groups || [],
      group_switch_status_codes: token.group_switch_status_codes || [429, 500, 502, 503, 504],
      group_switch_retry_count: Number(token.group_switch_retry_count) || 0,
    });
  }, [token]);

  useEffect(() => {
    if (!open || !token) return;
    const owner = new AbortController();
    setGroups([]);
    setGroupsLoading(true);
    setGroupsError('');
    setAutoNotice(false);
    Promise.all([API.get<ApiEnvelope<Record<string, unknown>>>('/api/user/self/groups', { signal: owner.signal, skipErrorHandler: true }), API.get<ApiEnvelope<AutoConfig>>('/api/token/auto-groups', { signal: owner.signal, skipErrorHandler: true })]).then(([usable, auto]) => {
      if (owner.signal.aborted) return;
      if (!usable.data?.success || !auto.data?.success) throw new Error(usable.data?.message || auto.data?.message || t('Failed to load groups'));
      const available = Object.keys(usable.data.data || {}).filter((value) => value !== 'auto');
      const config = auto.data.data;
      const selection = reconcileAutoGroups(token.auto_groups, available, config.max_count);
      setGroups(available);
      setAutoConfig(config);
      setAutoNotice(selection.changed);
      setForm((previous) => ({
        ...previous,
        groups: initialTokenGroupSelection({ ...token, group: previous.automatic ? 'auto' : '', groups: previous.groups }, available).groups,
        auto_groups_mode: selection.mode,
        auto_groups: selection.groups,
      }));
    }).catch((error) => { if (!owner.signal.aborted) setGroupsError((error instanceof Error ? error.message : '') || t('Failed to load groups. Close and retry.')); })
      .finally(() => { if (!owner.signal.aborted) setGroupsLoading(false); });
    return () => owner.abort();
  }, [open, token]);

  useEffect(() => {
    if (!open || groupsLoading) return;
    const owner = new AbortController();
    const selected = form.automatic ? (form.auto_groups_mode === 'custom' ? form.auto_groups || [] : autoConfig.groups) : form.groups || [];
    Promise.all(selected.map((group) => API.get<ApiEnvelope<string[]>>(`/api/user/models?group=${encodeURIComponent(group)}`, { signal: owner.signal, skipErrorHandler: true }))).then((responses) => {
      if (!owner.signal.aborted) setModels([...new Set(responses.flatMap((res) => res.data?.success && Array.isArray(res.data.data) ? res.data.data : []))].map((name) => ({ value: name, label: name })));
    }).catch(() => { if (!owner.signal.aborted) setModels([]); });
    return () => owner.abort();
  }, [open, groupsLoading, form.automatic, form.groups, form.auto_groups_mode, form.auto_groups, autoConfig]);

  const save = async () => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || savingLock.current) return;
    if (!form.name?.trim()) return showError(t('Please enter a name'));
    const count = isEdit ? 1 : Number(createCount);
    if (!Number.isInteger(count) || count < 1 || count > 1000) return showError(t('Create between 1 and 1000 API keys'));
    if (new TextEncoder().encode(form.name.trim()).length > (count > 1 ? 43 : 50)) return showError(t('Key name is too long for the requested creation count'));
    if (groupsLoading || groupsError) return showError(groupsError || t('Loading group configuration…'));
    if (form.automatic) {
      const error = validateAutoGroups(form.auto_groups_mode, form.auto_groups || [], autoConfig.max_count, groups, (key, options) => t(key, options ?? {}));
      if (error) return showError(error);
    } else if (!form.groups?.length) return showError(t('Select at least one group or use automatic groups'));
    savingLock.current = true; setSaving(true);
    let created = 0;
    try {
      const payload = {
        name: form.name.trim(),
        unlimited_quota: form.unlimited_quota,
        allow_user_quota_query: !!form.allow_user_quota_query,
        remain_quota: form.unlimited_quota ? 0 : Number(form.remain_quota) || 0,
        expired_time: Number(form.expired_time) || -1,
        group: form.automatic ? 'auto' : form.groups?.[0],
        groups: form.automatic ? [] : form.groups || [],
        auto_groups: autoGroupsPayload(form.automatic, form.auto_groups_mode, form.auto_groups || []),
        group_switch_status_codes: (form.group_switch_status_codes || []).map(Number),
        group_switch_retry_count: Math.max(0, Math.min(10, Number(form.group_switch_retry_count) || 0)),
        model_limits_enabled: !!form.model_limits_enabled,
        model_limits: form.model_limits || '',
        allow_ips: form.allow_ips || '',
        cross_group_retry: !!form.cross_group_retry,
      };
      for (let index = 0; index < count; index++) {
        owner.signal.throwIfAborted();
        const name = index === 0 ? payload.name : `${payload.name}-${crypto.randomUUID().slice(0, 6)}`;
        const res = isEdit
          ? await API.put<ApiEnvelope<unknown>>('/api/token/', { ...payload, id: token?.id }, { signal: owner.signal, skipErrorHandler: true })
          : await API.post<ApiEnvelope<unknown>>('/api/token/', { ...payload, name }, { signal: owner.signal, skipErrorHandler: true });
        owner.signal.throwIfAborted();
        if (!res.data?.success) throw new Error(res.data?.message || 'Unable to save API key');
        created++;
      }
      showSuccess(isEdit ? t('API key updated') : t('Created {{count}} API keys', { count: created })); onSaved();
    } catch (error) {
      if (!owner.signal.aborted) {
        showError(error);
        if (created > 0) { showSuccess(t('Created {{count}} of {{requested}} API keys', { count: created, requested: count })); onSaved(); }
      }
    } finally {
      if (owner.signal.aborted) onChanged();
      if (lifetime.current === owner) { savingLock.current = false; setSaving(false); }
    }
  };

  const selectedModels = form.model_limits ? form.model_limits.split(',').filter(Boolean) : [];
  const selectedGroups = form.automatic ? [] : form.groups || [];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{isEdit ? t('Edit API key') : t('Create API key settings')}</span>}
      footer={
        <>
          <Button variant='toggle' onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={save} loading={saving} disabled={groupsLoading || !!groupsError || !form.automatic && !form.groups.length}>{isEdit ? t('Save') : t('Create')}</Button>
        </>
      }
    >
      <div className='px-6 py-4 space-y-5'>
        <div className='flex items-center justify-between gap-3'>
          <label htmlFor='token-name' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Name')}</label>
          <div className='w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0'>
            <Input id='token-name' value={form.name || ''} onChange={u('name')} placeholder={t('For example, my-app')} width='full' />
          </div>
        </div>

        {!isEdit && <div className='flex items-center justify-between gap-3'>
          <label htmlFor='token-create-count' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Number of API keys')}</label>
          <div className='w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0'>
            <NumberInput id='token-create-count' value={createCount} onChange={setCreateCount} min={1} max={1000} step={1} width='full' aria-label={t('Number of API keys')} />
          </div>
        </div>}

        <div className='flex items-center justify-between gap-3'>
          <label htmlFor='token-group-mode' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Group mode')}</label>
          <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 justify-end'>
            <Select id='token-group-mode' popover value={form.automatic ? 'auto' : 'manual'} options={[
              { value: 'auto', label: t('Automatic groups') }, { value: 'manual', label: t('Ordered groups') },
            ]} onChange={(value) => setForm((previous) => ({ ...previous, automatic: value === 'auto', groups: previous.groups.length ? previous.groups : groups.slice(0, 1), cross_group_retry: value === 'auto' || previous.cross_group_retry }))} width='full' />
          </div>
        </div>

        {form.automatic && (
          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-3'>
              <label htmlFor='token-auto-group-config' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Auto group configuration')}</label>
              <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 justify-end'>
                {groupsLoading ? <p className='text-xs text-ui-text-3'>{t('Loading group configuration…')}</p> : groupsError ? <p role='alert' className='text-xs text-ui-danger'>{groupsError}</p> : <Select id='token-auto-group-config' popover value={form.auto_groups_mode || 'inherit'} options={[
                  { value: 'inherit', label: t('All available groups') }, { value: 'custom', label: t('Custom Auto groups') },
                ]} onChange={u('auto_groups_mode')} width='full' />}
              </div>
            </div>
            {!groupsLoading && !groupsError && <>
              {autoNotice && <p role='status' className='text-xs text-amber-600'>{t('Unavailable or excess groups were removed. Review before saving. An empty custom list requires a new selection or explicit inheritance.')}</p>}
              {form.auto_groups_mode === 'custom' ? <>
                <div className='flex items-center justify-between gap-3'>
                  <label htmlFor='token-group-priority' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Group priority')}</label>
                  <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 justify-end'>
                    <SortableMultiSelect id='token-group-priority' label={t('Group priority')} options={groups} value={form.auto_groups || []} onChange={u('auto_groups')} maxSelected={autoConfig.max_count} placeholder={t('Add Auto group')} />
                  </div>
                </div>
                <p className='text-xs text-ui-text-3'>{t('Choose up to {{count}} groups. Auto routing prefers the lowest effective billing multiplier; list order breaks ties.', { count: autoConfig.max_count })}</p>
              </> : <p className='text-xs text-ui-text-3 break-words'>{t('Automatically choose the lowest billing multiplier among available groups for the requested model. No manual group selection is required.')}</p>}
              <div className='flex items-center justify-between gap-3'>
                <span className='text-sm text-ui-text'>{t('Switch to the next group after retries are exhausted')}</span>
                <Switch checked={!!form.cross_group_retry} onChange={u('cross_group_retry')} />
              </div>
            </>}
          </div>
        )}

        {!form.automatic && (
          <div className='flex items-center justify-between gap-3'>
            <label htmlFor='token-group-priority' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Group priority')}</label>
            <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 justify-end'>
              <SortableMultiSelect id='token-group-priority' label={t('Group priority')} options={groups} value={selectedGroups} onChange={u('groups')} disabled={groupsLoading} placeholder={t('Add group')} />
            </div>
          </div>
        )}
        {!form.automatic && groupsError && <p role='alert' className='text-xs text-ui-danger'>{groupsError}</p>}

        {selectedGroups.length > 1 && (
          <div>
            <label className='block text-sm text-[#666] mb-1.5'>{t('HTTP status codes for switching groups')}</label>
            <MultiSelect
              options={[401, 403, 408, 429, 500, 502, 503, 504].map((code) => ({ value: String(code), label: String(code) }))}
              value={(form.group_switch_status_codes || []).map(String)}
              onChange={(values) => u('group_switch_status_codes')(values.map(Number))}
              placeholder={t('Select status codes that switch groups')}
            />
            <div className='mt-3'>
              <label className='block text-sm text-[#666] mb-1.5'>{t('Retries before switching')}</label>
              <NumberInput
                value={form.group_switch_retry_count || 0}
                onChange={(value) => u('group_switch_retry_count')(Number(value) || 0)}
                min={0}
                max={10}
                step={1}
              />
              <p className='mt-1.5 text-xs text-ui-text-3'>{t('Retry in the current group for these status codes, then switch after the retry limit.')}</p>
            </div>
          </div>
        )}

        <div className='flex items-center justify-between'>
            <span className='text-sm text-ui-text'>{t('Unlimited quota')}</span>
          <Switch aria-label={t('Unlimited quota')} checked={!!form.unlimited_quota} onChange={u('unlimited_quota')} />
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-sm text-ui-text'>{t('Allow this key to query account quota')}</span>
          <Switch checked={!!form.allow_user_quota_query} onChange={u('allow_user_quota_query')} />
        </div>

        {!form.unlimited_quota && (
          <div className='flex items-center justify-between gap-3'>
            <label htmlFor='token-amount' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Amount')}</label>
            <div className='w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0'>
              <NumberInput
                id='token-amount' width='full'
                value={quotaToDisplayAmount(form.remain_quota || 0)}
                onChange={(v) => u('remain_quota')(displayAmountToQuota(v))}
                min={0} step='any'
              />
            </div>
          </div>
        )}

        <div className='flex items-center justify-between gap-3'>
          <label htmlFor='token-expiration' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Expiration time')}</label>
          <div className='flex w-[min(280px,calc(100%_-_88px))] min-w-0 shrink-0 items-center gap-2'>
            <input
              id='token-expiration'
              type='datetime-local'
              value={toLocalInput(form.expired_time)}
              onChange={(e) => u('expired_time')(toUnix(e.target.value) || -1)}
              className='h-9 min-w-0 flex-1 rounded-xl border border-ui-border bg-transparent px-1.5 text-xs text-ui-text'
            />
            <Button size='sm' shrink={false} variant='toggle' selected={form.expired_time === -1}
              onClick={() => u('expired_time')(-1)}>{t('Never')}</Button>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-sm text-ui-text'>{t('Model restrictions')}</span>
          <Switch aria-label={t('Model restrictions')} checked={!!form.model_limits_enabled} onChange={u('model_limits_enabled')} />
        </div>

        {form.model_limits_enabled && (
          <div className='flex items-center justify-between gap-3'>
            <label htmlFor='token-allowed-models' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Allowed models')}</label>
            <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 justify-end'>
              <MultiSelect
                id='token-allowed-models' popover width='full'
                options={models}
                value={selectedModels}
                onChange={(arr) => u('model_limits')(arr.join(','))}
                placeholder={t('Select allowed models')}
                searchable
              />
            </div>
          </div>
        )}

        <div>
          <label className='block text-sm text-[#666] mb-1.5'>{t('IP allowlist')}</label>
          <textarea
            value={form.allow_ips || ''}
            onChange={(e) => u('allow_ips')(e.target.value)}
            placeholder={t('One IP address per line; leave empty for no restriction')}
            rows={3}
            className='w-full rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text resize-none outline-hidden focus:border-[#999] transition-colors'
          />
        </div>
      </div>
    </SlideOver>
  );
};


export default TokenEditModal;
