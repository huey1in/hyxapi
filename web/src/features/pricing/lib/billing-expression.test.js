import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileBillingExpression } from './billing-expression/parser.ts';
import { evaluateBillingExpression } from './billing-expression/runtime.ts';
import { readTokenTierChain } from './billing-expression/display.ts';
import { parseVisualBillingDocument, serializeVisualBillingDocument } from './billing-expression/visual.ts';
import { buildRequestRuleExpr, splitBillingExprAndRequestRules } from './billing-expr.ts';

const fixtures = JSON.parse(readFileSync(new URL('../../../../../pkg/billingexpr/testdata/frontend_simulation.json', import.meta.url), 'utf8'));
for (const fixture of fixtures) test(`browser billing agrees with Go: ${fixture.name}`, () => {
  const result = evaluateBillingExpression(fixture.expression, {
    tokens: fixture.tokens, imageCount: fixture.imageCount, usage: fixture.usage,
    request: { body: fixture.body ?? {}, headers: fixture.headers },
  });
  assert.equal(result.status, 'success');
  assert.ok(Math.abs(result.cost - fixture.cost) < 1e-9);
  assert.equal(result.matchedTier, fixture.tier);
  assert.deepEqual(result.requestRules.map((rule) => rule.multiplier), fixture.multipliers ?? []);
  assert.deepEqual(result.requestRules.map((rule) => rule.matched), fixture.matched ?? []);
  if (fixture.billingUnit) {
    assert.equal(result.billingUnit, fixture.billingUnit);
    assert.equal(result.fixedPrice, fixture.fixedPrice);
  }
  if (fixture.displayTiers) {
    const compiled = compileBillingExpression(fixture.expression);
    assert.equal(compiled.status, 'ready');
    assert.deepEqual(readTokenTierChain(compiled.ast), fixture.displayTiers);
  }
});

test('visual billing round-trips original source, explicit zero prices and unsupported expressions', () => {
  const source = 'v1: tier("base", p * 2.00 + cr * 0 + c * 8)';
  const document = parseVisualBillingDocument(source);
  assert.ok(document);
  assert.deepEqual(serializeVisualBillingDocument(document), { ok: true, source });
  document.root.prices.find((price) => price.variable === 'p').value = '3';
  assert.equal(serializeVisualBillingDocument(document).source, source.replace('2.00', '3'));
  document.root.prices[0].value = '';
  assert.equal(serializeVisualBillingDocument(document).ok, false);
  assert.equal(parseVisualBillingDocument('tier("custom", max(p, 100) * 2)'), null);
});

test('time rule ranges distinguish overnight from daytime', () => {
  for (const [start, end, hour, multiplier] of [['9', '12', 10, 2], ['9', '12', 20, 1], ['21', '6', 23, 2], ['21', '6', 12, 1]]) {
    const rule = buildRequestRuleExpr([{ multiplier: '2', conditions: [{ source: 'time', timeFunc: 'hour', timezone: 'UTC', mode: 'range', rangeStart: start, rangeEnd: end, value: '' }] }]);
    const result = evaluateBillingExpression(`tier("base", p * 1) * ${rule}`, { tokens: { p: 10 }, now: new Date(`2026-10-18T${hour}:00:00Z`) });
    assert.equal(result.status, 'success');
    assert.equal(result.cost, 10 * multiplier);
  }
});

test('noncanonical rules and unknown context keep the raw expression', () => {
  const source = 'tier("base", p * 2) * (param("priority") == true ? 2 : 1.5)';
  assert.deepEqual(splitBillingExprAndRequestRules(source), { billingExpr: source, requestRuleExpr: '' });
  assert.equal(evaluateBillingExpression('param("priority") == nil ? 2 : 3').status, 'missing_context');
  assert.equal(evaluateBillingExpression('globalThis.process').status, 'unsupported');
});
