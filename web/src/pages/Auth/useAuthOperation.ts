import { useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../../lib/api-error';

// Mode changes and closing a dialog invalidate its result as well as its request.
export function useAuthOperation(onError: (message: string) => void) {
  const owner = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const [operation, setOperation] = useState('');
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  useEffect(() => {
    const current = new AbortController(); owner.current = current; locked.current = false; setOperation('');
    return () => { current.abort(); owner.current?.abort(); owner.current = null; };
  }, []);
  const cancel = () => { owner.current?.abort(); owner.current = new AbortController(); locked.current = false; setOperation(''); };
  const run = async (name: string, action: (signal: AbortSignal) => Promise<void>) => {
    const current = owner.current;
    if (!current || current.signal.aborted || locked.current) return;
    locked.current = true; setOperation(name);
    try { await action(current.signal); }
    catch (error) { if (!current.signal.aborted) { const message = apiErrorMessage(error, 'Unable to complete operation'); if (message) errorHandler.current(message); } }
    finally { if (owner.current === current) { locked.current = false; setOperation(''); } }
  };
  return { operation, busy: !!operation, run, cancel };
}
