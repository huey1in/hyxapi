import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import { loadTestModules } from '../scripts/load-test-modules.mjs';

const { entry0: { default: App }, entry1: { CONSOLE_ROUTE_REDIRECTS } } = await loadTestModules(['./src/App.tsx', './src/lib/console-routes.ts']);
const routes = createRoutesFromChildren(App().props.children);
const routeAt = (path) => matchRoutes(routes, path)?.at(-1).route;

test('all console destinations have registered canonical routes and old paths redirect', () => {
  assert.equal(routeAt('/console').path, '/console');
  for (const [previous, current] of Object.entries(CONSOLE_ROUTE_REDIRECTS)) {
    assert.equal(routeAt(current).path, current, current);
    assert.equal(routeAt(previous).path, `${previous}/*`, previous);
    assert.notEqual(routeAt(previous).element.type, routeAt(current).element.type, previous);
  }
  assert.equal(routeAt('/user/reset').path, '/user/reset');
});

test('management routes mount the correct subscription and ticket pages', () => {
  assert.notEqual(routeAt('/subscription').element.type, routeAt('/subscription/manage').element.type);
  assert.equal(routeAt('/tickets').element.props.management, undefined);
  assert.equal(routeAt('/tickets/manage?ticket=23').element.props.management, true);
});
