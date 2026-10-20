import type { SecurityProof, VerificationOperation } from '../features/auth/secure-verification/types';
import type { GenericAbortSignal } from 'axios';

type Listener = (operation: VerificationOperation, resolve: (proof: SecurityProof) => void, reject: (error: Error) => void, signal?: GenericAbortSignal) => void;
let listener: Listener | null = null;
export function subscribeVerificationRequests(next: Listener): () => void {
  listener = next;
  return () => { if (listener === next) listener = null; };
}
export function requestVerification(operation: VerificationOperation, signal?: GenericAbortSignal): Promise<SecurityProof> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Security verification cancelled', 'AbortError'));
    if (!listener) return reject(new Error('Security verification is unavailable; refresh and retry'));
    let settled = false;
    const finish = (proof?: SecurityProof, error?: Error) => {
      if (settled) return;
      settled = true; signal?.removeEventListener?.('abort', cancel);
      if (proof) resolve(proof); else reject(error);
    };
    const cancel = () => finish(undefined, new DOMException('Security verification cancelled', 'AbortError'));
    signal?.addEventListener?.('abort', cancel, { once: true });
    try { listener(structuredClone(operation), (proof) => finish(proof), (error) => finish(undefined, error), signal); }
    catch (error) { finish(undefined, error instanceof Error ? error : new Error('Unable to start security verification')); }
  });
}
