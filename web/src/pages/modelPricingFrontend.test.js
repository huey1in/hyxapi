import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

let editor;
let helpers;
let log;

before(async () => {
  globalThis.window = {
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, removeItem: () => {} },
    location: { pathname: '/' },
    dispatchEvent: () => {},
  };
  globalThis.localStorage = globalThis.window.localStorage;

  const modules = await loadTestModules([
    './src/pages/Setting/pricing-editor.ts',
    './src/helpers/utils.jsx',
    './src/pages/Log/log-data.ts',
  ]);
  editor = modules.entry0;
  helpers = modules.entry1;
  log = modules.entry2;
});

test('saving one pricing row replaces only that row and preserves other drafts', () => {
  const rows = [
    { _key: 'server-1', id: 1, model_name: 'saved', _dirty: true },
    { _key: 'local-2', id: 0, model_name: 'unsaved draft', _dirty: true },
  ];

  const next = editor.replacePricingRow(rows, 'server-1', {
    id: 1,
    model_name: 'saved by server',
    billing_type: 0,
  });

  assert.equal(next[0].model_name, 'saved by server');
  assert.equal(next[0]._dirty, false);
  assert.equal(next[0]._key, 'server-1');
  assert.strictEqual(next[1], rows[1]);
});

test('deleting by stable key removes the intended row after rows reorder', () => {
  const target = { _key: 'server-7', id: 7 };
  const rowsAfterReorder = [{ _key: 'local-1', id: 0 }, { _key: 'server-8', id: 8 }, target];

  assert.deepEqual(editor.removePricingRow(rowsAfterReorder, 'server-7'), [
    rowsAfterReorder[0],
    rowsAfterReorder[1],
  ]);
});

test('new unsaved pricing rows receive unique stable local keys', () => {
  const first = editor.createBlankPricingRow();
  const second = editor.createBlankPricingRow();
  const firstKey = first._key;

  first.model_name = 'draft';

  assert.equal(first._key, firstKey);
  assert.notEqual(first._key, second._key);
  assert.match(first._key, /^local-/);
});

test('supported models without prices appear as unsaved pricing rows', () => {
  const saved = editor.normalizePricingRow({
    id: 7,
    model_name: 'gpt-priced',
    input_price: 1,
  });

  const rows = editor.mergePricingRowsWithModels(
    [saved],
    ['gpt-priced', 'claude-new', 'claude-new'],
  );

  assert.equal(rows.length, 2);
  assert.strictEqual(rows[0], saved);
  assert.deepEqual(rows[1], {
    ...editor.normalizePricingRow({ model_name: 'claude-new' }),
    _key: 'suggested-claude-new',
    _new: true,
    _dirty: false,
  });
});

test('model pricing pagination slices rows without mutating drafts', () => {
  const rows = Array.from({ length: 23 }, (_, index) => ({ _key: `row-${index}` }));

  assert.equal(editor.getModelPricingPageCount(rows.length, 10), 3);
  assert.deepEqual(editor.getModelPricingPageRows(rows, 2, 10), rows.slice(10, 20));
  assert.equal(rows.length, 23);
});

test('model pricing pagination clamps the active page after deletion', () => {
  assert.equal(editor.clampModelPricingPage(3, 19, 10), 2);
  assert.equal(editor.clampModelPricingPage(0, 19, 10), 1);
  assert.equal(editor.clampModelPricingPage(2, 19, 50), 1);
});

test('upstream sync selects only new model prices by default', () => {
  const preview = [
    { model_name: 'new-model', status: 'new' },
    { model_name: 'changed-model', status: 'changed' },
    { model_name: 'description-model', status: 'description' },
  ];

  assert.deepEqual(editor.getDefaultModelPricingSyncSelection(preview), ['new-model', 'description-model']);
  assert.deepEqual(editor.buildModelPricingSyncPayload(preview, ['new-model', 'missing-model']), {
    model_names: ['new-model'],
  });
});

test('pricing payload excludes local UI state', () => {
  assert.deepEqual(editor.toModelPricingPayload({
    id: 0,
    model_name: '  gpt-test  ',
    billing_type: '1',
    request_price: 2,
    _key: 'local-1',
    _new: true,
    _dirty: true,
  }), {
    id: 0,
    model_name: 'gpt-test',
    billing_type: 1,
    request_price: 2,
  });
});

test('admin pricing rows preserve an imported invalid billing type for repair', () => {
  const row = editor.normalizePricingRow({
    id: 9,
    model_name: 'invalid-import',
    billing_type: 99,
  });

  assert.equal(row.billing_type, 99);
  assert.deepEqual(editor.getBillingTypeOptions(row.billing_type)[0], {
    value: 99,
    label: 'Invalid type (99)',
  });
});

test('model pricing errors prefer the server message', () => {
  const error = {
    message: 'Request failed with status code 400',
    response: { data: { message: '模型价格已存在' } },
  };

  assert.equal(editor.getModelPricingErrorMessage(error, '保存失败'), '模型价格已存在');
  assert.equal(editor.getModelPricingErrorMessage({
    message: 'Request failed with status code 404',
    response: { data: { message: '模型价格不存在' } },
  }, '删除失败'), '模型价格不存在');
});

test('log detail exposes only token prices for token billing', () => {
  const fields = log.getBillingPriceFields({
    billing_type: 0,
    input_price: 1,
    output_price: 2,
    request_price: 3,
  });

  assert.deepEqual(fields.map(({ key }) => key), ['input_price', 'output_price']);
});

test('log detail exposes only request price for request billing', () => {
  const fields = log.getBillingPriceFields({
    billing_type: 1,
    input_price: 1,
    output_price: 2,
    request_price: 3,
  });

  assert.deepEqual(fields.map(({ key }) => key), ['request_price']);
});

test('direct model price calculation does not expose legacy display mode fields', () => {
  const price = helpers.calculateModelPrice({
    record: { billing_type: 'tokens', input_price: 2, output_price: 8 },
    selectedGroup: 'default',
    groupRatio: { default: 1.5 },
    displayPrice: (value) => `$${value}`,
  });

  assert.equal(price.inputPrice, '$3');
  assert.equal(price.outputPriceUSD, 12);
  assert.equal('isTokensDisplay' in price, false);
  assert.equal('quotaDisplayType' in price, false);
  assert.equal('currency' in price, false);
});

test('model price items hide zero-valued optional prices', () => {
  const items = helpers.getModelPriceItems({
    isPerToken: true,
    unitLabel: 'M',
    inputPrice: '$1',
    inputPriceUSD: 1,
    completionPrice: '$2',
    outputPriceUSD: 2,
    cachePrice: '$0',
    cacheReadPriceUSD: 0,
    createCachePrice: '$0',
    cacheWritePriceUSD: 0,
    imagePrice: '$0',
    imagePriceUSD: 0,
    audioInputPrice: '$0',
    audioInputPriceUSD: 0,
    audioOutputPrice: '$0',
    audioOutputPriceUSD: 0,
  }, (key) => key);

  assert.deepEqual(items.map(({ key }) => key), ['input', 'completion']);
});

test('configured free prices remain visible while missing prices stay absent', () => {
  const price = helpers.calculateModelPrice({
    record: { billing_type: 'tokens', configured: true, input_price: 0, output_price: 0 },
    selectedGroup: 'default', groupRatio: { default: 2 },
  });
  assert.deepEqual(helpers.getModelPriceItems(price, (key) => key).map(({ key, configuredValue }) => [key, configuredValue]), [['input', 0], ['completion', 0]]);
  assert.deepEqual(helpers.getModelPriceItems({ ...price, configured: false }, (key) => key), []);
  const request = helpers.calculateModelPrice({ record: { billing_type: 'request', request_price: 0 }, selectedGroup: 'default' });
  assert.deepEqual(helpers.getModelPriceItems(request, (key) => key).map(({ configuredValue }) => configuredValue), [0]);
  const missing = helpers.calculateModelPrice({ record: { billing_type: 'tokens', configured: true }, selectedGroup: 'default' });
  assert.deepEqual(helpers.getModelPriceItems(missing, (key) => key), []);
});


test('expression pricing keeps its active rule instead of presenting inactive zero prices', () => {
  const expression = 'tier("base", p * 2 + c * 8)';
  const price = helpers.calculateModelPrice({ record: {
    billing_mode: 'tiered_expr', billing_expr: expression,
    input_price: 0, output_price: 0, request_price: 0,
  }, selectedGroup: 'default' });
  assert.equal(price.isExpression, true);
  assert.equal(price.expression, expression);
  assert.match(price.price, /表达式|expression/i);
  assert.equal(price.inputPrice, undefined);
});
