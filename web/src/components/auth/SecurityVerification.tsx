import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers/api';
import { Button, Modal, Input, Select } from '../ui';
import { authResult } from '../../lib/secure-verification';
import { subscribeVerificationRequests } from '../../lib/verification-request';
import { encryptPassword } from '../../features/auth/lib/password-encryption';
import { requestPasskeyAssertion, rememberPasskeyRPID } from '../../features/auth/passkey/assertion';
import type { PasskeyDomains } from '../../features/auth/passkey/assertion';
import type { PasskeyOptionsPayload } from '../../features/auth/passkey/types';
import { isPasskeySupported } from '../../lib/passkey';
import { oauthExchange } from '../../lib/oauth-exchange';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import type { SecurityProof, VerificationOperation, VerificationRequirements, VerificationMethod } from '../../features/auth/secure-verification/types';

const labels: Record<VerificationMethod, string> = {
  '2fa': 'Two-factor or backup code', password: 'Login password', passkey: 'Passkey',
  oauth: 'Linked third-party account', session: 'Current login session',
};
type Request = {
  operation: VerificationOperation; resolve: (proof: SecurityProof) => void; reject: (error: Error) => void;
  abort: AbortController; dispose: () => void;
};
const cancelled = () => new DOMException('Security verification cancelled', 'AbortError');

function VerificationQueue() {
  const { t } = useTranslation();
  const queue = useRef<Request[]>([]);
  const active = useRef<Request | null>(null);
  const inFlight = useRef<Request | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [requirements, setRequirements] = useState<VerificationRequirements | null>(null);
  const [method, setMethod] = useState<VerificationMethod | ''>('');
  const [provider, setProvider] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [domains, setDomains] = useState<PasskeyDomains>({ rpIDs: [] });
  const [rpID, setRPID] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeVerificationRequests((operation, resolve, reject, signal) => {
      if (signal?.aborted) { reject(cancelled()); return; }
      const item: Request = { operation, resolve, reject, abort: new AbortController(), dispose: () => {} };
      const cancel = () => {
        item.abort.abort(); item.dispose(); item.reject(cancelled());
        if (active.current === item) { active.current = queue.current.shift() ?? null; setRequest(active.current); }
        else queue.current = queue.current.filter((entry) => entry !== item);
      };
      item.dispose = () => signal?.removeEventListener?.('abort', cancel);
      signal?.addEventListener?.('abort', cancel, { once: true });
      if (active.current) queue.current.push(item);
      else { active.current = item; setRequest(item); }
    });
    return () => {
      unsubscribe();
      for (const item of [...(active.current ? [active.current] : []), ...queue.current]) {
        item.abort.abort(); item.dispose(); item.reject(cancelled());
      }
      active.current = null; queue.current = []; inFlight.current = null;
    };
  }, []);

  const loadRequirements = async (item: Request) => {
    const signal = item.abort.signal;
    setRequirements(null); setError('');
    try {
      const [data, supported] = await Promise.all([
        authResult<VerificationRequirements>(API.get('/api/verify/methods', { params: { scope: item.operation.scope }, signal, skipErrorHandler: true, disableDuplicate: true })),
        isPasskeySupported(),
      ]);
      signal.throwIfAborted();
      if (active.current !== item) return;
      const methods = data.methods.filter((entry) => entry.available && (entry.method !== 'passkey' || supported));
      setRequirements({ ...data, methods }); setMethod(methods[0]?.method ?? '');
      setProvider(data.oauth_providers?.[0]?.slug ?? '');
    } catch (error) { if (!signal.aborted && active.current === item) setError(apiErrorMessage(error, 'Unable to load verification methods')); }
  };
  useEffect(() => {
    if (!request) return;
    setBusy(false); setMethod(''); setProvider(''); setValue(''); setDomains({ rpIDs: [] }); setRPID('');
    void loadRequirements(request);
  }, [request]);

  const finish = (proof?: SecurityProof) => {
    if (!request || active.current !== request) return;
    request.abort.abort(); request.dispose();
    if (proof) request.resolve(proof); else request.reject(cancelled());
    active.current = queue.current.shift() ?? null; setRequest(active.current);
  };
  const totpOnly = request?.operation.scope === '2fa.backup_codes.regenerate';
  const verify = async () => {
    if (!request || active.current !== request || inFlight.current === request || !method || !requirements) return;
    if ((method === 'password' || method === '2fa') && !value.trim()) { setError(t('Enter a password or verification code')); return; }
    if (method === '2fa' && totpOnly && !/^\d{6}$/.test(value.trim())) { setError(t('Enter a six-digit verification code')); return; }
    if (method === 'oauth' && !provider) return;
    const item = request;
    const signal = item.abort.signal;
    if (signal.aborted) return;
    inFlight.current = item; setBusy(true); setError('');
    try {
      let proof: SecurityProof;
      if (method === 'oauth') {
        proof = await oauthExchange<SecurityProof>(provider, 'verify', item.operation, undefined, signal);
      } else if (method === 'passkey') {
        const passkey = await requestPasskeyAssertion((selected) => authResult<PasskeyOptionsPayload>(API.post('/api/user/passkey/verify/begin', { ...item.operation, ...(selected ? { rp_id: selected } : {}) }, { signal, skipErrorHandler: true })), signal, { rpID: rpID || undefined, onDomains: setDomains });
        proof = await authResult<SecurityProof>(API.post('/api/user/passkey/verify/finish', { flow_token: passkey.flowToken, credential: passkey.assertion }, { signal, singleUseAuthorization: true, skipErrorHandler: true }));
        signal.throwIfAborted(); rememberPasskeyRPID(passkey.rpID);
      } else {
        const input = method === 'password'
          ? requirements.password_encryption_enabled ? await encryptPassword(value) : { password: value }
          : method === '2fa' ? { code: value.trim() } : {};
        signal.throwIfAborted();
        proof = await authResult<SecurityProof>(API.post('/api/verify', { ...item.operation, method, ...input }, { signal, skipErrorHandler: true }));
      }
      signal.throwIfAborted();
      if (active.current !== item) return;
      if (!proof.proof_token || proof.scope !== item.operation.scope || proof.method !== method || proof.expires_at * 1000 <= Date.now()) throw new Error('Invalid verification result; verify again');
      finish(proof);
    } catch (error) { if (!signal.aborted && active.current === item) setError(apiErrorMessage(error, 'Verification failed; retry')); }
    finally { if (inFlight.current === item) inFlight.current = null; if (active.current === item) setBusy(false); }
  };

  if (!request) return null;
  return <Modal open title={t('Security verification')} onClose={() => finish()} onConfirm={verify}
    cancelText={t('Cancel')} confirmText={t('Verify and continue')} loading={busy}
    footer={<><Button onClick={() => finish()}>{t('Cancel')}</Button><Button loading={busy} onClick={() => void verify()} disabled={!requirements?.methods.length}>{t('Verify and continue')}</Button></>}>
    <div className='flex flex-col gap-3.5'>
      <p className='m-0 text-sm text-ui-text-3'>{t('Verify your identity to complete this operation.')}</p>
      {error && <p role='alert' className='text-sm text-ui-text-2'>{t(error)}</p>}
      {!requirements ? <><p className='text-sm text-ui-text-3'>{t('Loading verification methods...')}</p>{error && <Button onClick={() => void loadRequirements(request)}>{t('Retry')}</Button>}</>
        : requirements.methods.length === 0 ? <p role='alert' className='text-sm text-ui-text-2'>{t('No verification method is available; contact an administrator.')}</p> : <>
          <Select aria-label={t('Verification method')} value={method} disabled={busy} onChange={(next) => { setMethod(next); setValue(''); setError(''); }} options={requirements.methods.map((entry) => ({ value: entry.method, label: t(labels[entry.method]) }))} />
          {(method === '2fa' || method === 'password') && <Input aria-label={t(method === 'password' ? 'Login password' : totpOnly ? 'Six-digit verification code' : 'Verification or backup code')} value={value} onChange={setValue} disabled={busy}
            type={method === 'password' ? 'password' : 'text'} inputMode={totpOnly ? 'numeric' : undefined} maxLength={totpOnly ? 6 : undefined} autoComplete={method === 'password' ? 'current-password' : 'one-time-code'} placeholder={t(method === 'password' ? 'Login password' : totpOnly ? 'Six-digit verification code' : 'Verification or backup code')}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void verify(); } }} />}
          {method === 'oauth' && <Select aria-label={t('Identity provider')} value={provider} disabled={busy} onChange={setProvider} options={requirements.oauth_providers.map((entry) => ({ value: entry.slug, label: entry.name }))} />}
          {method === 'passkey' && domains.rpIDs.length > 1 && <Select aria-label={t('Passkey domain')} value={rpID || domains.rpID} disabled={busy} options={domains.rpIDs.map((id) => ({ value: id, label: id }))} onChange={setRPID} />}
        </>}
    </div>
  </Modal>;
}

export default function SecurityVerification() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <VerificationQueue key={identity} />;
}
