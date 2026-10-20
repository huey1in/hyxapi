import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: types, entry1: { buildAuditDetails } } = await loadTestModules(['./src/features/audit/types.ts', './src/features/audit/audit-details.ts']);
const t = (key, params = {}) => key.replace(/{{(\w+)}}/g, (_match, name) => String(params[name] ?? ''));
const entry = (patch = {}) => ({ event_id: 'audit-1', user_id: 3, username: 'member', actor_role: 1, created_at: 1792420000,
  category: 'operation', action: 'token.update', token_ref: '', auth_method: 'session', ip: '127.0.0.1', user_agent: 'Browser',
  method: 'PUT', route: '/api/token/', status: 200, success: true, request_id: 'request-1', content: '', other: null, ...patch });

test('audit filters use server-supported fields, normalize fingerprints, and isolate self scope', () => {
  const filters = { ...types.emptyAuditFilters(), username: ' another-user ', request_id: ' exact-request ', category: 'security', success: 'false', token_ref: 'A'.repeat(64) };
  const self = types.auditParams(filters, 'self', 2, 50);
  assert.equal(self.username, undefined);
  assert.equal(self.request_id, 'exact-request');
  assert.equal(self.token_ref, 'a'.repeat(64));
  assert.equal(self.p, 2);
  assert.equal(self.page_size, 50);
  assert.equal(types.auditParams(filters, 'all').username, 'another-user');
  for (const invalid of [{ start: 'invalid' }, { start: '2026-10-19T12:00', end: '2026-10-18T12:00' }, { token_ref: 'secret-token' }, { success: 'yes' }, { category: 'unknown' }]) {
    assert.throws(() => types.auditParams({ ...filters, ...invalid }, 'self'));
  }
});

test('access records constrain category and current or historical token without leaking a user filter', () => {
  const base = { p: 1, page_size: 20, category: 'security', username: 'another-user', token_ref: 'b'.repeat(64) };
  const current = types.accessAuditParams(base, 'current', 'A'.repeat(64));
  assert.equal(current.category, 'access_token');
  assert.equal(current.token_ref, 'a'.repeat(64));
  assert.equal(current.username, undefined);
  const historical = types.accessAuditParams(base, 'historical', 'a'.repeat(64));
  assert.equal(historical.token_ref, undefined);
  assert.equal(historical.exclude_token_ref, 'a'.repeat(64));
  assert.equal(types.accessAuditParams(base, 'all').token_ref, undefined);
  assert.throws(() => types.accessAuditParams(base, 'current'));
  assert.throws(() => types.accessAuditParams(base, 'historical'));
});

test('new audit metadata supplies real actions and preserves nested operation details', () => {
  const row = entry({ other: { op: { action: 'token.update', params: { id: 8, name: '<script>name</script>', changed_fields: ['model_limits', 'allow_ips'] } } } });
  const result = buildAuditDetails(row, t);
  assert.match(result.summary, /<script>name<\/script>/);
  assert.match(result.operation.description, /Model Limits/);
  assert.match(result.operation.description, /IP Whitelist/);
  assert.equal(result.actor, 'member (ID: 3)');
  assert.equal(result.authentication, 'Session');
  assert.equal(types.auditPageSchema.parse({ items: [row], total: 1 }).items[0].event_id, 'audit-1');
  assert.throws(() => types.auditPageSchema.parse({ items: [{ ...row, success: 'true' }], total: 1 }));
});

test('failed bulk operations never present a deleted count as a successful result', () => {
  const result = buildAuditDetails(entry({ action: 'token.delete_batch', success: false, status: 500,
    other: { op: { action: 'token.delete_batch', params: { total: 3, count: 3, requested_ids: [1, 2, 3] } } } }), t);
  assert.match(result.operation.description, /Requested: 3/);
  assert.doesNotMatch(result.operation.description, /Deleted:/);
  assert.equal(result.operation.fields.some((field) => field.label === 'Deleted tokens'), false);
});

test('failed quota adjustment shows requested amount and reason without claiming applied balances', () => {
  globalThis.localStorage = { getItem: () => null };
  const result = buildAuditDetails(entry({ action: 'user.quota_add', success: false, other: { op: { action: 'user.quota_add', params: {
    target_username: 'target', target_user_id: 9, requested_quota: 500000, from: 1, to: 500001, failure_reason: 'permission_denied',
  } } } }), t);
  assert.match(result.operation.description, /Requested quota: \$1\.000000/);
  assert.match(result.operation.description, /Insufficient permission/);
  assert.equal(result.operation.fields.some((field) => field.label === 'Quota after adjustment'), false);
});

test('unknown access-token scopes remain counted until a label dictionary is available', () => {
  const row = entry({ action: 'access_token.update', other: { op: { action: 'access_token.update', params: { scopes: ['private_internal:secret', 'channel:read'] } } } });
  const result = buildAuditDetails(row, t, { scopeResources: [{ resource: 'channel', label_key: 'Channels', actions: [{ action: 'read', label_key: 'Read', description_key: 'Read channels' }] }] });
  const scopes = result.fields.find((field) => field.label === 'Permissions');
  assert.equal(scopes.value.Channels, 'Read');
  assert.match(scopes.value.Other, /1 permissions are no longer available/);
  assert.doesNotMatch(JSON.stringify(scopes), /private_internal/);
});
