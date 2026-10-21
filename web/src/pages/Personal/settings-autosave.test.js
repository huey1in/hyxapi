import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: { createSettingsAutosave }, entry1: { notificationForm, personalSettingsChanges } } = await loadTestModules(['./src/pages/Personal/settings-autosave.ts', './src/pages/Personal/personal-settings.ts']);
const initial = () => notificationForm({ id: 1, username: 'autosave', role: 1, setting: { notify_type: 'email', notification_email: 'old@example.com' } });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test('autosave serializes rapid edits and retains the final value after an earlier request completes', async () => {
  const first = deferred();
  const calls = [];
  const state = createSettingsAutosave(initial(), 1, async (patch) => { calls.push(patch); if (calls.length === 1) await first.promise; });
  state.set('record_ip_log', true);
  const pending = state.flush();
  await Promise.resolve();
  state.set('record_ip_log', false);
  state.set('accept_unset_model_ratio_model', true);
  assert.deepEqual(calls, [{ record_ip_log: true }]);
  first.resolve();
  await pending;
  assert.deepEqual(calls, [{ record_ip_log: true }, { record_ip_log: false, accept_unset_model_ratio_model: true }]);
  assert.equal(state.getSnapshot().saving, false);
  await state.flush();
  assert.equal(calls.length, 2);
});

test('text changes coalesce and flushing pending input saves before its debounce timer', async () => {
  const calls = [];
  const state = createSettingsAutosave(initial(), 1, async (patch) => { calls.push(patch); });
  state.set('notification_email', 'first@example.com', 600);
  state.set('notification_email', 'final@example.com', 600);
  assert.equal(calls.length, 0);
  await state.flush();
  assert.deepEqual(calls, [{ notification_email: 'final@example.com' }]);
});

test('debounced input saves automatically without a blur or manual flush', async () => {
  const done = deferred();
  const state = createSettingsAutosave(initial(), 1, async (patch) => { assert.deepEqual(patch, { notification_email: 'auto@example.com' }); done.resolve(); });
  state.set('notification_email', 'auto@example.com', 5);
  await done.promise;
  await state.flush();
  assert.equal(state.getSnapshot().saving, false);
});

test('invalid delivery drafts do not enable a new notification method or block unrelated preferences', async () => {
  const calls = [];
  const state = createSettingsAutosave(initial(), 1, async (patch) => { calls.push(patch); });
  state.set('notify_type', 'gotify');
  state.set('record_ip_log', true);
  await state.flush();
  assert.deepEqual(calls, [{ record_ip_log: true }]);
  assert.ok(state.getSnapshot().errors.gotify_url);
  assert.ok(state.getSnapshot().errors.gotify_token);
  state.set('gotify_url', 'https://notify.example.com', 600);
  state.set('gotify_token', 'fixture-token', 600);
  await state.flush();
  assert.deepEqual(calls[1], { notify_type: 'gotify', gotify_url: 'https://notify.example.com', gotify_token: 'fixture-token', gotify_priority: 5 });
  assert.deepEqual(state.getSnapshot().errors, {});
});

test('failed writes retain their draft and can retry without a new edit', async () => {
  let attempts = 0;
  const state = createSettingsAutosave(initial(), 1, async () => { if (++attempts === 1) throw new Error('offline'); });
  state.set('record_ip_log', true);
  await state.flush();
  assert.equal(state.getSnapshot().form.record_ip_log, true);
  assert.equal(state.getSnapshot().error.message, 'offline');
  await state.flush();
  assert.equal(attempts, 2);
  assert.equal(state.getSnapshot().error, null);
});

test('changing account ownership cancels in-flight and queued edits', async () => {
  const first = deferred();
  const calls = [];
  let signal;
  const state = createSettingsAutosave(initial(), 1, async (patch, owner) => { signal = owner; calls.push(patch); await first.promise; });
  state.set('record_ip_log', true);
  const pending = state.flush();
  await Promise.resolve();
  state.set('notification_email', 'queued@example.com', 600);
  state.cancel();
  assert.ok(signal.aborted);
  first.resolve();
  await pending;
  state.set('record_ip_log', false);
  await state.flush();
  assert.equal(calls.length, 1);
});

test('a failed older request still processes edits queued while it was in flight', async () => {
  const first = deferred();
  const calls = [];
  const state = createSettingsAutosave(initial(), 1, async (patch) => {
    calls.push(patch);
    if (calls.length === 1) { await first.promise; throw new Error('temporary failure'); }
  });
  state.set('record_ip_log', true);
  const pending = state.flush();
  await Promise.resolve();
  state.set('accept_unset_model_ratio_model', true);
  first.resolve();
  await pending;
  assert.deepEqual(calls, [{ record_ip_log: true }, { record_ip_log: true, accept_unset_model_ratio_model: true }]);
  assert.equal(state.getSnapshot().error, null);
});

test('invalid input and unauthorized administrator switches are excluded from partial patches', () => {
  const saved = initial();
  const form = { ...saved, quota_warning_threshold: '', notification_email: 'invalid', channel_notify_enabled: true, upstream_model_update_notify_enabled: true, record_ip_log: true };
  const { patch, errors } = personalSettingsChanges(form, saved, 1);
  assert.deepEqual(patch, { record_ip_log: true });
  assert.ok(errors.quota_warning_threshold);
  assert.ok(errors.notification_email);
  const admin = personalSettingsChanges(form, saved, 10);
  assert.equal(admin.patch.channel_notify_enabled, true);
  assert.equal(admin.patch.upstream_model_update_notify_enabled, true);
  for (const gotify_priority of ['', -1, 11, 1.5]) {
    assert.ok(personalSettingsChanges({ ...saved, notify_type: 'gotify', gotify_url: 'https://notify.example.com', gotify_token: 'token', gotify_priority }, saved, 10).errors.gotify_priority);
  }
});

test('a lost response cannot leave the server with an earlier value when the user toggles back', async () => {
  const first = deferred();
  const calls = [];
  let persisted = false;
  const state = createSettingsAutosave(initial(), 1, async (patch) => {
    calls.push(patch);
    persisted = patch.record_ip_log;
    if (calls.length === 1) { await first.promise; throw new Error('response lost after commit'); }
  });
  state.set('record_ip_log', true);
  const pending = state.flush();
  await Promise.resolve();
  state.set('record_ip_log', false);
  first.resolve();
  await pending;
  assert.deepEqual(calls, [{ record_ip_log: true }, { record_ip_log: false }]);
  assert.equal(persisted, false);
  assert.equal(state.getSnapshot().error, null);
});
