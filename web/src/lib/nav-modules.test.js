import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';
const { entry0: { parseHeaderNavModules, publicModuleAccess, publicRouteModule } } = await loadTestModules(['./src/lib/nav-modules.ts']);

test('public navigation accepts persisted legacy switches and fails back on malformed values', () => {
  for (const raw of [null, '', 'null', '[]', 'broken', 1]) assert.equal(publicModuleAccess(parseHeaderNavModules(raw), 'pricing', false), 'allowed');
  const config = parseHeaderNavModules('{"console":"false","home":0,"pricing":{"enabled":"true","requireAuth":1},"rankings":"0"}');
  assert.equal(config.console, false);
  assert.equal(config.home, false);
  assert.equal(publicModuleAccess(config, 'pricing', false), 'sign-in');
  assert.equal(publicModuleAccess(config, 'pricing', true), 'allowed');
  assert.equal(publicModuleAccess(config, 'rankings', true), 'disabled');
  assert.equal(publicModuleAccess(parseHeaderNavModules({ pricing: { enabled: false, requireAuth: true } }), 'pricing', false), 'disabled');
  assert.equal(publicModuleAccess(parseHeaderNavModules({ pricing: { enabled: ' 1 ', requireAuth: ' 1 ' } }), 'pricing', false), 'sign-in');
  assert.equal(publicModuleAccess(parseHeaderNavModules({ pricing: ' 0 ' }), 'pricing', false), 'disabled');
});

test('public module guards include details and exclude console routes and prefix lookalikes', () => {
  assert.equal(publicRouteModule('/pricing'), 'pricing');
  assert.equal(publicRouteModule('/pricing/model/gpt'), 'pricing');
  assert.equal(publicRouteModule('/rankings'), 'rankings');
  assert.equal(publicRouteModule('/pricing-extra'), null);
  assert.equal(publicRouteModule('/console/pricing'), null);
});
