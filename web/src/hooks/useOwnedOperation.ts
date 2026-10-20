import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showError } from '../components/ui';
import { apiErrorMessage } from '../lib/api-error';

// Each window is keyed by account/session and target. Closing it cancels its
// requests; a synchronous lock also prevents duplicate financial/security actions.
export function useOwnedOperation() {
  const { t } = useTranslation();
  const lifetime = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const owner = new AbortController(); lifetime.current = owner; lock.current = false; setBusy(false); return () => { owner.abort(); if (lifetime.current === owner) lifetime.current = null; }; }, []);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || lock.current) return false;
    lock.current = true; setBusy(true);
    try { await action(owner.signal); owner.signal.throwIfAborted(); return true; }
    catch (error) { const message = apiErrorMessage(error, 'Unable to complete operation'); if (!owner.signal.aborted && message) showError(t(message)); return false; }
    finally { if (lifetime.current === owner) { lock.current = false; setBusy(false); } }
  };
  return { busy, run };
}
