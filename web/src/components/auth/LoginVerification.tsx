import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers/api';
import { Button, Modal, Input, Select } from '../ui';
import { authResult } from '../../lib/secure-verification';
import { requestPasskeyAssertion, rememberPasskeyRPID } from '../../features/auth/passkey/assertion';
import type { PasskeyDomains } from '../../features/auth/passkey/assertion';
import type { PasskeyOptionsPayload } from '../../features/auth/passkey/types';
import type { LoginChallenge, LoginResult } from '../../features/auth/secure-verification/types';
import { apiErrorMessage } from '../../lib/api-error';

type Props = { challenge: LoginChallenge; onComplete: (result: LoginResult) => void; onCancel: () => void };
function LoginChallengeDialog({ challenge, onComplete, onCancel }: Props) {
  const { t } = useTranslation();
  const methods = challenge.methods.filter((entry) => entry.available && (entry.method === '2fa' || entry.method === 'passkey'));
  const [method, setMethod] = useState(methods[0]?.method ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(challenge.expires_at * 1000 <= Date.now());
  const [error, setError] = useState('');
  const [domains, setDomains] = useState<PasskeyDomains>({ rpIDs: [] });
  const [rpID, setRPID] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const abort = new AbortController(); owner.current = abort; lock.current = false; setBusy(false);
    const timer = window.setTimeout(() => { abort.abort(); setExpired(true); setBusy(false); }, Math.max(0, challenge.expires_at * 1000 - Date.now()));
    return () => { abort.abort(); window.clearTimeout(timer); if (owner.current === abort) owner.current = null; };
  }, [challenge.expires_at]);

  const cancel = () => { owner.current?.abort(); onCancel(); };
  const verify = async () => {
    const abort = owner.current;
    if (!abort || abort.signal.aborted || lock.current || !methods.length) return;
    if (challenge.expires_at * 1000 <= Date.now()) { setExpired(true); return; }
    if (method === '2fa' && !code.trim()) { setError(t('Enter a verification or backup code')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const options = { signal: abort.signal, skipAuthRefresh: true, skipErrorHandler: true };
      let result: LoginResult;
      if (method === 'passkey') {
        const passkey = await requestPasskeyAssertion(
          (selected) => authResult<PasskeyOptionsPayload>(API.post('/api/user/login/passkey/begin', { flow_token: challenge.flow_token, ...(selected ? { rp_id: selected } : {}) }, options)),
          abort.signal, { rpID: rpID || undefined, onDomains: setDomains },
        );
        result = await authResult<LoginResult>(API.post('/api/user/login/passkey/finish', {
          flow_token: challenge.flow_token, passkey_flow_token: passkey.flowToken, credential: passkey.assertion,
        }, options));
        abort.signal.throwIfAborted(); rememberPasskeyRPID(passkey.rpID);
      } else {
        result = await authResult<LoginResult>(API.post('/api/user/login/verify', { flow_token: challenge.flow_token, method: '2fa', code: code.trim() }, options));
      }
      abort.signal.throwIfAborted(); onComplete(result);
    } catch (error) { if (!abort.signal.aborted) setError(apiErrorMessage(error, 'Sign-in verification failed')); }
    finally { if (owner.current === abort) { lock.current = false; setBusy(false); } }
  };
  return <Modal open title={t('Complete sign-in verification')} onClose={cancel}
    footer={<><Button onClick={cancel}>{t('Cancel')}</Button><Button loading={busy} disabled={expired || !methods.length} onClick={() => void verify()}>{t('Verify')}</Button></>}>
    <div className='flex flex-col gap-3.5'>
      {expired ? <p role='alert' className='text-sm text-ui-text-2'>{t('Sign-in verification expired; sign in again')}</p> : <>
        {error && <p role='alert' className='text-sm text-ui-text-2'>{t(error)}</p>}
        {methods.length === 0 && <p role='alert' className='text-sm text-ui-text-2'>{t('No verification method is available; contact an administrator.')}</p>}
        <Select aria-label={t('Verification method')} value={method} disabled={busy} options={methods.map((entry) => ({ value: entry.method, label: t(entry.method === '2fa' ? 'Two-factor or backup code' : 'Passkey') }))} onChange={(value) => { setMethod(value); setCode(''); setError(''); }} />
        {method === '2fa' && <Input aria-label={t('Verification or backup code')} value={code} onChange={setCode} disabled={busy} autoComplete='one-time-code' placeholder={t('Verification or backup code')}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void verify(); } }} />}
        {method === 'passkey' && domains.rpIDs.length > 1 && <Select aria-label={t('Passkey domain')} value={rpID || domains.rpID} disabled={busy} options={domains.rpIDs.map((id) => ({ value: id, label: id }))} onChange={setRPID} />}
      </>}
    </div>
  </Modal>;
}

export default function LoginVerification(props: Props) {
  return <LoginChallengeDialog key={props.challenge.flow_token} {...props} />;
}
