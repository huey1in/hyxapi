import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: types, entry1: { buildAuditDetails }, entry2: { renderAuditContent }, entry3: { AUDIT_ROUTE_LABELS } } = await loadTestModules([
  './src/features/audit/types.ts', './src/features/audit/audit-details.ts', './src/features/audit/audit-content.ts', './src/features/audit/audit-route-labels.ts',
]);
const t = (key, params = {}) => key.replace(/{{(\w+)}}/g, (_match, name) => String(params[name] ?? ''));
const entry = (patch = {}) => ({ event_id: 'audit-1', user_id: 3, username: 'member', actor_role: 1, created_at: 1792420000,
  category: 'operation', action: 'token.update', token_ref: '', auth_method: 'session', ip: '127.0.0.1', user_agent: 'Browser',
  method: 'PUT', route: '/api/token/', status: 200, success: true, request_id: 'request-1', content: '', other: null, ...patch });

test('support ticket audit records identify the support role and event', () => {
  const row = entry({ actor_role: 5, action: 'ticket.update', other: { op: { action: 'ticket.update', params: { ticket_id: 11, status: 'resolved', assignee_id: 3 } } } });
  const result = buildAuditDetails(row, t);
  assert.equal(result.actorRole, 'Customer support');
  assert.match(renderAuditContent(row.other, t), /Updated support ticket 11/);
});

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

test('current backend audit actions all have an event label, including vendor operations', () => {
  const controllers = new URL('../../../../controller/', import.meta.url);
  const actions = new Set(['vendor.assign', 'vendor.merge', 'vendor.delete']);
  for (const file of readdirSync(controllers).filter((name) => name.endsWith('.go') && !name.endsWith('_test.go'))) {
    const source = readFileSync(new URL(file, controllers), 'utf8');
    for (const match of source.matchAll(/\b(?:recordManageAudit(?:For)?|recordUserSecurityAudit)\(c,\s*(?:[^,\n]+,\s*)?"([a-z_]+(?:\.[a-z_]+)+)"/g)) actions.add(match[1]);
  }
  assert.ok(actions.size > 30, 'read the actual backend event producers');
  for (const action of actions) {
    assert.ok(renderAuditContent({ op: { action } }, t), `Missing label: ${action}`);
  }
});

test('new event names are localized in the table and details even without nested metadata', () => {
  const translations = JSON.parse(readFileSync(new URL('../../i18n/locales/zh-CN.json', import.meta.url), 'utf8')).translation;
  const translate = (key, params) => t(translations[key] ?? key, params);
  const cases = {
    'vendor.metadata.save': '保存了供应商信息', 'vendor.metadata.delete': '删除了一个供应商',
    'vendor.merge': '合并了供应商', 'vendor.assign': '调整了模型的供应商归属',
    'model.delete_batch': '批量删除了模型', 'model.metadata.sync': '同步了模型信息',
    'model.pricing.update': '更新了模型计费配置', 'model.pricing.reset_input_ratios': '重置了模型输入倍率',
    'subscription.plan_reset': '重置了套餐的有效订阅', 'subscription.user_plan_reset': '重置了用户的套餐订阅',
    'channel.upstream_detect_all': '启动了上游模型检测任务', 'user.notification_email_verify': '已验证通知邮箱',
  };
  for (const [action, label] of Object.entries(cases)) {
    for (const other of [null, { op: { action, params: {} } }, { op: { action: '' } }]) {
      assert.equal(buildAuditDetails(entry({ action, content: action, other }), translate).summary, label, action);
    }
  }
});

test('known generic routes use event names while unknown events retain their original information', () => {
  const cases = [
    ['POST', '/api/model-pricing', 'Saved model pricing'],
    ['PATCH', '/api/subscription/admin/plans/:id', 'Updated subscription plan status'],
    ['PUT', '/api/authz/user/:id/permissions', 'Updated user permissions'],
    ['POST', '/api/channel/priority/reorder', 'Reordered channel priorities'],
    ['POST', '/api/plugin/task/:key/status', 'Updated task plugin status'],
  ];
  for (const [method, route, expected] of cases) {
    for (const success of [true, false]) {
      const row = entry({ action: 'generic', method, route, success, content: `${method} ${route}`,
        other: { op: { action: 'generic', params: { method, route } } } });
      assert.equal(buildAuditDetails(row, t).summary, expected);
      assert.equal(row.success, success);
      assert.equal(buildAuditDetails({ ...row, action: '', other: null }, t).summary, expected);
    }
  }
  assert.equal(buildAuditDetails(entry({ action: 'generic', method: 'POST', route: '/api/future/:id', other: null }), t).summary, 'POST /api/future/:id');
  assert.equal(buildAuditDetails(entry({ action: 'future.event', content: 'Original event information' }), t).summary, 'Original event information');
  assert.equal(buildAuditDetails(entry({ action: 'generic', route: '', method: '', other: null }), t).summary, 'Operation audit');
  assert.equal(buildAuditDetails(entry({ action: 'channel.delete', method: 'DELETE', route: '/api/channel/:id' }), t).summary, 'Deleted a channel');
});

test('all middleware fallback routes and event labels are covered by the locale dictionaries', () => {
  const middleware = readFileSync(new URL('../../../../middleware/audit.go', import.meta.url), 'utf8');
  const routeTable = middleware.split('var auditRouteActions = map[string]string{')[1].split('\n}')[0];
  const routes = [...routeTable.matchAll(/"((?:POST|PUT|PATCH|DELETE) [^"]+)"\s*:/g)].map((match) => match[1]);
  assert.ok(routes.length > 0, 'middleware audit routes must be discovered');
  assert.equal(new Set(routes).size, routes.length, 'middleware audit routes must be unique');
  for (const route of routes) assert.ok(AUDIT_ROUTE_LABELS[route], route);
  const labels = new Set([...Object.values(AUDIT_ROUTE_LABELS), 'Saved vendor metadata', 'Merged vendors', 'Assigned models to a vendor']);
  for (const language of ['en', 'zh-CN', 'zh-TW', 'fr', 'ru', 'ja', 'vi']) {
    const translations = JSON.parse(readFileSync(new URL(`../../i18n/locales/${language}.json`, import.meta.url), 'utf8')).translation;
    for (const label of labels) assert.ok(translations[label], `${language}: ${label}`);
  }
});
