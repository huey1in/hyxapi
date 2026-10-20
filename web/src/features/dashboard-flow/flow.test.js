import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { buildDashboardFlowData, getFlowStages }, entry1: { layoutFlow } } = await loadTestModules(['./src/features/dashboard-flow/flow.ts', './src/features/dashboard-flow/layout.ts']);
const rows = [
  { user_id: 1, username: 'private-alice', node_name: 'private-east', token_id: 1, token_name: 'private-token', use_group: 'vip', model_name: 'model-a', channel_id: 1, channel_name: 'private-channel', quota: 100, token_used: 30, count: 2 },
  { user_id: 2, username: 'private-bob', node_name: 'private-west', token_id: 2, token_name: 'private-backup', use_group: 'default', model_name: 'model-b', channel_id: 2, channel_name: 'private-second', quota: 50, token_used: 70, count: 1 },
];

test('flow totals preserve routing dimensions while roles and selected metrics change', () => {
  for (const role of ['user', 'admin', 'root']) {
    for (const [metric, expected] of [['quota', 150], ['tokens', 100], ['requests', 3]]) {
      const data = buildDashboardFlowData(rows, metric, { role });
      assert.deepEqual(data.summary, { quota: 150, tokens: 100, requests: 3 });
      for (const stage of getFlowStages(role)) assert.equal(data.flow.nodes.filter((node) => node.kind === stage).reduce((sum, node) => sum + node.value, 0), expected);
      assert(data.flow.nodes.every((node) => getFlowStages(role).includes(node.kind)));
      const diagram = layoutFlow(data.flow, getFlowStages(role));
      assert.equal(diagram.links.length, data.flow.links.length);
      for (const link of diagram.links) { assert(link.thickness > 0); assert(!link.path.includes('NaN')); }
    }
  }
});

test('flow filters, masked labels and overflow aggregation preserve identity and accounting', () => {
  const filtered = buildDashboardFlowData(rows, 'quota', { role: 'root', selectedNodes: [{ kind: 'group', id: 'group:vip' }] });
  assert.equal(filtered.summary.quota, 100);
  const masked = buildDashboardFlowData(rows, 'quota', { role: 'root', maskSensitive: true });
  assert(masked.flow.nodes.every((node) => !node.label.includes('private-')));
  assert(masked.flow.links.every((link) => !link.sourceLabel.includes('private-') && !link.targetLabel.includes('private-')));
  assert.equal(new Set(masked.flow.nodes.map((node) => node.id)).size, masked.flow.nodes.length);
  const aggregate = buildDashboardFlowData(rows, 'quota', { role: 'root', topNodeLimit: 1, overflowMode: 'aggregate' });
  const hidden = buildDashboardFlowData(rows, 'quota', { role: 'root', topNodeLimit: 1, overflowMode: 'hide' });
  assert.equal(aggregate.flow.nodes.filter((node) => node.kind === 'model').reduce((sum, node) => sum + node.value, 0), 150);
  assert.equal(hidden.flow.nodes.filter((node) => node.kind === 'model').reduce((sum, node) => sum + node.value, 0), 100);
});
