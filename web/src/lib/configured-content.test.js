import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';
const { entry0: { configuredContentKind } } = await loadTestModules(['./src/lib/configured-content.ts']);

test('configured documents isolate HTML, preserve Markdown samples, and only link HTTP URLs', () => {
  assert.equal(configuredContentKind('  '), 'empty');
  assert.equal(configuredContentKind(' https://example.test/terms?a=1 '), 'url');
  assert.equal(configuredContentKind('javascript:alert(1)'), 'markdown');
  assert.equal(configuredContentKind('<!-- document -->\n<!doctype html><body>Terms</body>'), 'html');
  assert.equal(configuredContentKind('<h1>Terms</h1><script>alert(1)</script>'), 'html');
  assert.equal(configuredContentKind('# Usage\n\n```html\n<div>example</div>\n```'), 'markdown');
});
