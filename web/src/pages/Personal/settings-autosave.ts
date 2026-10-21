import { personalSettingsChanges } from './personal-settings';
import type { NotificationForm, PreferenceErrors, PreferenceField, PreferencePatch } from './personal-settings';

export interface PreferenceSnapshot {
  form: NotificationForm;
  errors: PreferenceErrors;
  saving: boolean;
  error: unknown;
}

// Serialize writes and send only changed fields, including changes made while a
// previous request is in flight. A failed save keeps its draft available to retry.
export function createSettingsAutosave(initial: NotificationForm, role: number, save: (patch: PreferencePatch, signal: AbortSignal) => Promise<void>) {
  let saved = { ...initial };
  let snapshot: PreferenceSnapshot = { form: { ...initial }, errors: {}, saving: false, error: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  const owner = new AbortController();
  const retryFields = new Set<PreferenceField>();
  const listeners = new Set<() => void>();
  const publish = (value: Partial<PreferenceSnapshot>) => {
    snapshot = { ...snapshot, ...value };
    listeners.forEach((listener) => listener());
  };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const flush = (): Promise<void> => {
    clearTimer();
    if (owner.signal.aborted) return Promise.resolve();
    if (running) return running;
    // Defer execution until running holds the promise, including synchronous errors.
    running = Promise.resolve().then(async () => {
      while (!owner.signal.aborted) {
        const form = snapshot.form;
        const { patch, errors } = personalSettingsChanges(form, saved, role, retryFields);
        publish({ errors });
        if (!Object.keys(patch).length) break;
        publish({ saving: true, error: null });
        try {
          await save(patch, owner.signal);
          owner.signal.throwIfAborted();
          for (const key of Object.keys(patch) as PreferenceField[]) {
            saved = { ...saved, [key]: form[key] };
            retryFields.delete(key);
          }
        } catch (error) {
          // The server may have committed before a response was lost. Re-send
          // the latest value even when the user toggled back to the old value.
          for (const key of Object.keys(patch) as PreferenceField[]) retryFields.add(key);
          if (!owner.signal.aborted) publish({ error });
          if (!owner.signal.aborted && snapshot.form !== form && timer === undefined) continue;
          break;
        }
        if (timer !== undefined) break;
      }
    }).finally(() => {
      running = undefined;
      if (!owner.signal.aborted) publish({ saving: timer !== undefined });
    });
    return running;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set<K extends PreferenceField>(key: K, value: NotificationForm[K], delay = 0) {
      if (owner.signal.aborted || snapshot.form[key] === value) return;
      const form = { ...snapshot.form, [key]: value };
      publish({ form, errors: personalSettingsChanges(form, saved, role, retryFields).errors, saving: true, error: null });
      clearTimer();
      if (delay) timer = setTimeout(() => { void flush(); }, delay);
      else void flush();
    },
    flush,
    cancel() { clearTimer(); owner.abort(); },
  };
}
