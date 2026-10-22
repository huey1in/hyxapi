import { LayoutSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Dices } from 'lucide-react';
import { API, copy, showSuccess } from '../../helpers';
import { FormField, Button, IconButton, Input, Select, SlideOver, Switch, Textarea, showError } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import type { PermissionCatalog } from '../../lib/admin-permissions';
import { normalizeAdminPermissions } from '../../lib/admin-permissions';
import { managedUserSchema, userErrorMessage, userUpdatePayload } from './user-management';
import type { ManagedUser, UserForm } from './user-management';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';

type Props = { user: ManagedUser | null; actorRole: number; onClose: () => void; onSaved: () => void };
const initialForm: UserForm = { username: '', display_name: '', password: '', role: 1, group: 'default', remark: '' };

export default function UserEditModal({ user, actorRole, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [form, setForm] = useState<UserForm>(initialForm);
  const [original, setOriginal] = useState<ManagedUser | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog>();
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const change = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    const owner = new AbortController();
    void (async () => {
      try {
        const [details, groupResponse, catalogResponse] = await Promise.all([
          user ? API.get<ApiEnvelope<unknown>>(`/api/user/${user.id}`, { signal: owner.signal, skipErrorHandler: true }) : undefined,
          API.get<ApiEnvelope<string[]>>('/api/group/', { signal: owner.signal, skipErrorHandler: true }),
          actorRole === 100 ? API.get<ApiEnvelope<PermissionCatalog>>('/api/authz/catalog', { signal: owner.signal, skipErrorHandler: true }) : undefined,
        ]);
        owner.signal.throwIfAborted();
        for (const result of [details, groupResponse, catalogResponse]) if (result && !result.data.success) throw new Error(result.data.message || 'Unable to load user settings');
        const fresh = details ? managedUserSchema.parse(details.data.data) : null;
        setOriginal(fresh); setGroups(groupResponse.data.data ?? []); setCatalog(catalogResponse?.data.data);
        setForm(fresh ? { username: fresh.username, display_name: fresh.display_name, password: '', role: fresh.role, group: fresh.group, remark: fresh.remark, admin_permissions: fresh.admin_permissions } : initialForm);
      } catch (failure) { if (!owner.signal.aborted) setError(userErrorMessage(failure)); }
      finally { if (!owner.signal.aborted) setLoading(false); }
    })();
    return () => owner.abort();
  }, [user?.id, actorRole]);
  const generate = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const password = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
    change('password', password); setGenerated(true);
  };
  const save = () => run(async (signal) => {
    if (!form.username.trim() || Array.from(form.username.trim()).length > 20) throw new Error('Username must contain 1 to 20 characters');
    if ((!user || form.password) && (Array.from(form.password).length < 8 || Array.from(form.password).length > 128)) throw new Error('Password must contain between 8 and 128 characters.');
    const payload = userUpdatePayload(form, original, actorRole === 100 ? catalog : undefined);
    const { data } = user ? await API.put<ApiEnvelope<unknown>>('/api/user/', payload, { signal, skipErrorHandler: true }) : await API.post<ApiEnvelope<unknown>>('/api/user/', payload, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to save user');
    showSuccess(t('User saved')); onSaved();
  });
  const matrix = catalog ? normalizeAdminPermissions(form.admin_permissions, catalog) : {};
  return <SlideOver open title={<h2 className='text-lg font-semibold'>{user ? t('Edit user #{{id}}', { id: user.id }) : t('Create user')}</h2>} onClose={() => { if (!busy) onClose(); }}
    footer={<><Button variant='toggle' disabled={busy} onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} disabled={loading || !!error} onClick={() => void save()}>{t(user ? 'Save' : 'Create')}</Button></>}>
    <div className='px-6 pb-6 space-y-4'>
      {error ? <p role='alert'>{t(error)}</p> : <LayoutSkeleton loading={loading}><fieldset disabled={busy || loading} className='space-y-4'>
        <FormField label={t('Username')}><Input aria-label={t('Username')} value={form.username} onChange={(value) => change('username', value)} disabled={!!user || busy} width='full' /></FormField>
        <FormField label={t('Display name')}><Input aria-label={t('Display name')} value={form.display_name} onChange={(value) => change('display_name', value)} width='full' /></FormField>
        <label className='block space-y-1.5 text-sm'>{t('Password')} {user && <span className='text-xs text-ui-text-3'>{t('Leave blank to keep the password')}</span>}
          <div className='flex gap-2'><Input aria-label={t('Password')} type='password' autoComplete='new-password' value={form.password} onChange={(value) => { change('password', value); setGenerated(false); }} width='full' /><IconButton icon={Dices} title={t('Generate random password')} onClick={generate} /><IconButton icon={Copy} title={t('Copy password')} disabled={!form.password} onClick={() => void copy(form.password).then((ok) => ok ? showSuccess(t('Password copied')) : showError(t('Copy failed')))} /></div>
        </label>
        {generated && <p className='text-xs text-ui-text-3'>{t('Random password generated. Copy it before saving.')}</p>}
        {!user && <FormField label={t('Role')}><Select popover aria-label={t('Role')} value={form.role} onChange={(value) => change('role', value)} options={[{ value: 1, label: t('Regular user') }, ...(actorRole === 100 ? [{ value: 10, label: t('Administrator') }] : [])]} width='full' /></FormField>}
        {user && <>
          <FormField label={t('User group')}><Select popover aria-label={t('User group')} value={form.group} onChange={(value) => change('group', value)} options={[...new Set([...groups, form.group])].filter(Boolean)} width='full' /></FormField>
          <FormField label={t('Remark')}><Textarea aria-label={t('Remark')} value={form.remark} onChange={(value) => change('remark', value)} width='full' /></FormField>
          <p className='text-xs text-ui-text-3'>{t('Use quota adjustment to change the balance. Editing profile fields preserves live usage.')}</p>
        </>}
        {actorRole === 100 && form.role === 10 && catalog?.resources.map((resource) => <section key={resource.resource} className='rounded-xl border border-ui-border p-3 space-y-3'>
          <h3 className='text-sm font-medium'>{t(resource.label_key)}</h3>
          {resource.actions.map((action) => <label key={action.action} className='flex items-start justify-between gap-3 text-sm'>
            <span>{t(action.label_key)}<span className='block text-xs text-ui-text-3'>{t(action.description_key)}</span></span>
            <Switch aria-label={t(action.label_key)} checked={matrix[resource.resource]?.[action.action] === true} onChange={(checked) => change('admin_permissions', { ...matrix, [resource.resource]: { ...matrix[resource.resource], [action.action]: checked } })} />
          </label>)}
        </section>)}
      </fieldset></LayoutSkeleton>}
    </div>
  </SlideOver>;
}
