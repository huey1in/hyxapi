import Skeleton from '../../components/ui/feedback/Skeleton';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import { Button, Card, Input, Notice, Steps, ContentSkeleton } from '../../components/ui';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import { useAuthOperation } from '../Auth/useAuthOperation';
import { registrationPayload } from '../Auth/auth-flow';
import type { ApiEnvelope } from '../../types/api';

const setupSchema = z.object({ status: z.boolean(), root_init: z.boolean().optional(), database_type: z.string().optional() });
type UsageMode = 'external' | 'self' | 'demo';
const modes: { value: UsageMode; title: string; description: string }[] = [
  { value: 'external', title: 'External operations', description: 'Serve multiple users or teams with billing and quota control.' },
  { value: 'self', title: 'Personal use', description: 'Use the platform privately without requiring configured model prices.' },
  { value: 'demo', title: 'Demo site', description: 'Mark this deployment as a demonstration site.' },
];
const stepKeys = ['Database', 'Administrator', 'Usage mode', 'Complete'];

export default function Setup() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ username: '', password: '', confirm: '', email: '', verificationCode: '' });
  const [usageMode, setUsageMode] = useState<UsageMode>('external');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const { busy, run } = useAuthOperation((message) => setError(t(message)));
  const redirectTimer = useRef<number | undefined>(undefined);
  const query = useQuery({ queryKey: ['public-setup-status'], queryFn: async ({ signal }) => setupSchema.parse(await authResult(API.get('/api/setup', { signal, disableDuplicate: true, skipAuthRefresh: true, skipErrorHandler: true }))), retry: false, gcTime: 0, refetchOnWindowFocus: false });
  const status = query.data;
  useEffect(() => { if (status?.status) window.location.replace('/'); }, [status?.status]);
  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);
  const validateAdministrator = () => {
    if (status?.root_init) return true;
    try { registrationPayload(form, false, ''); return true; }
    catch (failure) { setError(t(apiErrorMessage(failure))); return false; }
  };
  const next = () => { setError(''); if (step === 1 && !validateAdministrator()) return; setStep((value) => Math.min(stepKeys.length - 1, value + 1)); };
  const submit = () => {
    if (completed || !status || !validateAdministrator()) return;
    void run('setup', async (signal) => {
      setError('');
      const response = await API.post<ApiEnvelope<unknown>>('/api/setup', {
        username: form.username.trim(), password: form.password, confirmPassword: form.confirm,
        SelfUseModeEnabled: usageMode === 'self', DemoSiteEnabled: usageMode === 'demo',
      }, { signal, skipAuthRefresh: true, skipErrorHandler: true });
      signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || 'Unable to initialize the system');
      setCompleted(true); setForm((value) => ({ ...value, password: '', confirm: '' }));
      showSuccess(t('System initialized successfully'));
      redirectTimer.current = window.setTimeout(() => window.location.replace('/'), 1500);
    });
  };
  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className='min-h-screen flex items-center justify-center p-6' style={{ backgroundColor: 'var(--page-bg)' }}>
    <Card className='w-full max-w-2xl'>
      <h1 className='text-2xl font-semibold text-ui-text-1 mb-1'>{t('System initialization')}</h1>
      <p className='text-ui-text-2 text-sm mb-6'>{t('Complete the first-time Hyxware setup')}</p>
      {query.isPending ? <ContentSkeleton variant='form'><div className='mb-8'><Steps items={stepKeys.map((key) => ({ title: t(key) }))} current={0} /></div><Skeleton height={44} /><Skeleton className='mt-3' width='75%' height={20} /><div className='mt-8 flex justify-between'><Skeleton width={85} height={36} /><Skeleton width={65} height={36} /></div></ContentSkeleton> : query.isError ? <div role='alert' className='space-y-3'><Notice kind='warning'>{t(apiErrorMessage(query.error, 'Unable to load setup status'))}</Notice><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : status && <>
        <div className='mb-8'><Steps items={stepKeys.map((key) => ({ title: t(key) }))} current={step} /></div>
        {error && <div role='alert' className='mb-4'><Notice kind='warning'>{error}</Notice></div>}
        {step === 0 && <div className='space-y-3'>
          <Notice kind='info'>{t('Database: {{type}} · Connected', { type: status.database_type || t('Unknown') })}</Notice>
          <p className='text-sm text-ui-text-2'>{t('The database is ready. Continue to the next step.')}</p>
        </div>}
        {step === 1 && (status.root_init ? <Notice kind='success'>{t('An administrator account already exists. Continue with that account.')}</Notice> : <div className='space-y-4'>
          <div><label className='block text-sm text-ui-text-2 mb-1.5'>{t('Administrator username')}</label><Input aria-label={t('Administrator username')} value={form.username} onChange={update('username')} placeholder='admin' autoComplete='username' /></div>
          <div><label className='block text-sm text-ui-text-2 mb-1.5'>{t('Password')}</label><Input aria-label={t('Password')} type='password' value={form.password} onChange={update('password')} autoComplete='new-password' /></div>
          <div><label className='block text-sm text-ui-text-2 mb-1.5'>{t('Confirm password')}</label><Input aria-label={t('Confirm password')} type='password' value={form.confirm} onChange={update('confirm')} autoComplete='new-password' /></div>
        </div>)}
        {step === 2 && <fieldset className='space-y-3' disabled={busy || completed}><legend className='text-sm text-ui-text-2 mb-3'>{t('How will you use the platform?')}</legend>{modes.map((mode) => <label key={mode.value} className='flex gap-3 rounded-xl border border-ui-border p-4 cursor-pointer'>
          <input type='radio' name='usage-mode' checked={usageMode === mode.value} onChange={() => setUsageMode(mode.value)} aria-label={t(mode.title)} />
          <span><strong className='block text-sm text-ui-text-1'>{t(mode.title)}</strong><span className='text-sm text-ui-text-2'>{t(mode.description)}</span></span>
        </label>)}</fieldset>}
        {step === 3 && <div className='space-y-3'>
          <Notice kind='info'>{completed ? t('Setup complete. Redirecting…') : t('Confirm these settings before completing setup.')}</Notice>
          <ul className='text-sm text-ui-text-1 space-y-1.5 pl-4'>
            <li>{t('Database')}: {status.database_type || t('Ready')}</li>
            <li>{t('Administrator')}: {status.root_init ? t('Use the existing account') : form.username.trim()}</li>
            <li>{t('Usage mode')}: {t(modes.find((mode) => mode.value === usageMode)!.title)}</li>
          </ul>
        </div>}
        <div className='flex justify-between mt-8'>
          <Button variant='toggle' onClick={() => { setError(''); setStep((value) => Math.max(0, value - 1)); }} disabled={step === 0 || busy || completed}>{t('Previous')}</Button>
          {step < stepKeys.length - 1 ? <Button onClick={next}>{t('Next')}</Button> : <Button loading={busy} disabled={completed} onClick={submit}>{t('Complete setup')}</Button>}
        </div>
      </>}
    </Card>
  </div>;
}
