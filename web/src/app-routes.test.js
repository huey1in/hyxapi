import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import { loadTestModules } from '../scripts/load-test-modules.mjs';

const { entry0: { default: App } } = await loadTestModules(['./src/App.tsx']);
const routes = createRoutesFromChildren(App().props.children);
const routeAt = (path) => matchRoutes(routes, path)?.at(-1).route;

test('current routes are registered without old console redirects', () => {
  for (const path of ['/console', '/token', '/pricing', '/log', '/topup', '/subscription', '/personal', '/notices', '/channel', '/models', '/vendors', '/user', '/operations', '/audit', '/system-status', '/redemption', '/subscription/manage', '/setting', '/tickets', '/tickets/manage', '/user/reset']) {
    assert.equal(routeAt(path).path, path, path);
  }
  for (const path of ['/console/token', '/console/my-subscription', '/console/task', '/console/midjourney', '/console/tickets', '/index.html']) assert.equal(routeAt(path).path, '*', path);
});

test('management routes mount the correct subscription and ticket pages', () => {
  assert.notEqual(routeAt('/subscription').element.type, routeAt('/subscription/manage').element.type);
  assert.equal(routeAt('/tickets').element.props.management, undefined);
  assert.equal(routeAt('/tickets/manage?ticket=23').element.props.management, true);
});
