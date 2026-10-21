import test from 'node:test';
import assert from 'node:assert/strict';
import { modelNameFromPricingPath } from './model-pricing-route.ts';

test('pricing routes preserve literal encoded slashes, percent signs and reserved model characters', () => {
  for (const model of ['provider/model', 'provider/literal%2Fmodel', '100% model?#[]', '供应商/模型']) {
    const path = '/pricing/model/' + encodeURIComponent(model);
    assert.equal(modelNameFromPricingPath(path), model);
    assert.equal(modelNameFromPricingPath('/console' + path), model);
  }
  assert.equal(modelNameFromPricingPath('/pricing/model/invalid%'), null);
  assert.equal(modelNameFromPricingPath('/pricing/vendor/model'), null);
});
