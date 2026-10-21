import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: logs, entry1: sidebar } = await loadTestModules(['./src/pages/Log/log-navigation.ts', './src/lib/sidebar-modules.ts']);

test('log links select a canonical tab and preserve query parameters and fragments', () => {
  assert.equal(logs.logTabFromSearch(''), 'usage');
  assert.equal(logs.logTabFromSearch('?tab=tasks'), 'tasks');
  assert.equal(logs.logTabFromSearch('?tab=midjourney'), 'midjourney');
  assert.equal(logs.logTabFromSearch('?tab=invalid'), 'usage');
  assert.equal(logs.logTabLocation('tasks', '?request_id=test&tab=usage', '#results'), '/console/log?request_id=test&tab=tasks#results');
  assert.equal(logs.logTabLocation('midjourney', '?tab=tasks'), '/console/log?tab=midjourney');
  assert.equal(logs.logTabLocation('usage', '?request_id=test&tab=midjourney'), '/console/log?request_id=test');
  assert.equal(logs.logTabLocation('usage'), '/console/log');
});

test('merged log navigation follows administrator module configuration', () => {
  const hidden = { console: { log: false, task: false, midjourney: false } };
  assert.deepEqual(logs.visibleLogTabs({}).map((tab) => tab.value), ['usage', 'tasks', 'midjourney']);
  for (const tab of logs.LOG_TABS) {
    const enabled = { console: { ...hidden.console, [tab.module]: true } };
    assert.deepEqual(logs.visibleLogTabs(enabled).map((item) => item.value), [tab.value]);
    assert.equal(sidebar.isSidebarModuleVisible('/console/log', enabled), true);
  }
  assert.deepEqual(logs.visibleLogTabs(hidden), []);
  assert.equal(sidebar.isSidebarModuleVisible('/console/log', hidden), false);
  assert.deepEqual(logs.visibleLogTabs({ console: { enabled: false } }), []);
});
