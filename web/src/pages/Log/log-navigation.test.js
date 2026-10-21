import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: logs, entry1: sidebar } = await loadTestModules(['./src/pages/Log/log-navigation.ts', './src/lib/sidebar-modules.ts']);

test('legacy log links reach the combined table without tab parameters', () => {
  assert.equal(logs.logLocation('?request_id=test&tab=tasks', '#results'), '/console/log?request_id=test#results');
  assert.equal(logs.logLocation('?tab=midjourney'), '/console/log');
  assert.equal(logs.logLocation(), '/console/log');
});

test('merged log navigation follows administrator module configuration', () => {
  const hidden = { console: { log: false, task: false, midjourney: false } };
  assert.deepEqual(logs.visibleLogSources({}).map((tab) => tab.value), ['usage', 'tasks', 'midjourney']);
  for (const tab of logs.LOG_SOURCES) {
    const enabled = { console: { ...hidden.console, [tab.module]: true } };
    assert.deepEqual(logs.visibleLogSources(enabled).map((item) => item.value), [tab.value]);
    assert.equal(sidebar.isSidebarModuleVisible('/console/log', enabled), true);
  }
  assert.deepEqual(logs.visibleLogSources(hidden), []);
  assert.equal(sidebar.isSidebarModuleVisible('/console/log', hidden), false);
  assert.deepEqual(logs.visibleLogSources({ console: { enabled: false } }), []);
});
