import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDefaultTaskMatrixConfig, evaluateTaskUsageExamples, evaluateTaskVisualConfig, generateTaskExprFromConfig,
  getTaskEnumCombinations, taskMatrixToTiers, tryParseTaskMatrixConfig, tryParseTaskVisualConfig, tryParseEditableTaskConfig,
} from './task-expr.ts';
import { evaluateBillingExpression } from './billing-expression/runtime.ts';

const schema = {
  seconds: { type: 'number', unit: 'second' }, tokens: { type: 'number', unit: 'token' },
  resolution: { enum: ['720p', '1080p'] }, audio: { type: 'boolean' },
};
const tier = (label, unitPrices, conditions = [], constant = 0) => ({ label, unitPrices, conditions, constant });

test('task prices scale tokens once and retain independent seconds and base costs', () => {
  const config = { tiers: [tier('base', { seconds: 0.02, tokens: 3 }, [], 0.1)] };
  const expression = generateTaskExprFromConfig(config, schema);
  const facts = { seconds: 5, tokens: 100000, resolution: '720p' };
  const result = evaluateBillingExpression(expression, { usage: facts });
  assert.equal(result.status, 'success');
  assert.ok(Math.abs(result.cost - 0.5) < 1e-12);
  assert.equal(evaluateTaskVisualConfig(config, facts, schema).total, result.cost);
  assert.deepEqual(tryParseTaskVisualConfig(expression, schema), config);
});

test('task enum tiers preserve first match priority and fallback prices', () => {
  const config = { tiers: [tier('hd', { seconds: 0.2, tokens: 0 }, [{ field: 'resolution', value: '1080p' }]), tier('base', { seconds: 0.1, tokens: 0 })] };
  const expression = generateTaskExprFromConfig(config, schema);
  for (const [resolution, expected, matched] of [['1080p', 2, 'hd'], ['720p', 1, 'base']]) {
    const result = evaluateBillingExpression(expression, { usage: { seconds: 10, tokens: 0, resolution } });
    assert.equal(result.status, 'success');
    assert.equal(result.cost, expected);
    assert.equal(result.matchedTier, matched);
  }
});

test('task matrix expansion covers parameter combinations and preserves each independent price', () => {
  const matrixSchema = { ...schema, mode: { enum: ['fast', 'quality'] } };
  assert.equal(getTaskEnumCombinations(matrixSchema).length, 4);
  const matrix = createDefaultTaskMatrixConfig(matrixSchema);
  matrix.rows.forEach((row, i) => { row.unitPrices.seconds = (i + 1) / 10; });
  const expression = generateTaskExprFromConfig({ tiers: taskMatrixToTiers(matrix, matrixSchema) }, matrixSchema);
  assert.deepEqual(tryParseTaskMatrixConfig(expression, matrixSchema), matrix);
  for (const [i, row] of matrix.rows.entries()) {
    const result = evaluateBillingExpression(expression, { usage: { ...row.combination, seconds: 10, tokens: 0 } });
    assert.equal(result.status, 'success');
    assert.ok(Math.abs(result.cost - i - 1) < 1e-12);
  }
});

test('unsupported task shapes stay raw while boolean facts retain their types in simulation', () => {
  const expression = 'u("audio") == true ? tier("audio", u("seconds") * 0.2) : tier("silent", u("seconds") * 0.1)';
  assert.equal(tryParseTaskVisualConfig(expression, schema), null);
  assert.equal(tryParseTaskVisualConfig('tier("custom", max(u("seconds"), 10) * 0.2)', schema), null);
  for (const [audio, cost] of [[true, 2], [false, 1]]) {
    const result = evaluateBillingExpression(expression, { usage: { audio, seconds: 10 } });
    assert.equal(result.status, 'success');
    assert.equal(result.cost, cost);
  }
});

test('task simulation reports unknown quantities and invalid arithmetic instead of zero', () => {
  assert.equal(evaluateBillingExpression('tier("base", u("seconds") * 0.1)').status, 'missing_context');
  assert.notEqual(evaluateBillingExpression('tier("base", u("seconds") * 0.1)', { usage: {} }).status, 'success');
  assert.notEqual(evaluateBillingExpression('tier("base", u("seconds") * 0.1)', { usage: { seconds: 'unknown' } }).status, 'success');
  assert.deepEqual(evaluateTaskUsageExamples('tier("base", u("seconds") * 0.1)', schema, [{ label: 'ten', facts: { seconds: 10 } }]), [{ label: 'ten', total: 1 }]);
});

test('task editor keeps references to removed plugin fields verbatim', () => {
  const expression = 'tier("base", u("seconds") * 0.1 + u("removed") * 0.2)';
  assert.equal(tryParseEditableTaskConfig(expression, schema), null);
  assert.ok(tryParseEditableTaskConfig('tier("base", u("seconds") * 0.1)', schema));
});
