import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightCode } from './codeblock-highlight.ts';

test('untrusted code remains text with absent, unsupported and supported grammars', () => {
  const payload = '<img src=x onerror="window.executed=true"><script>alert(1)</script>&';
  for (const language of [undefined, 'unknown-language', 'toml', 'json', 'bash']) {
    const result = highlightCode(payload, language);
    assert.ok(!result.includes('<img'), String(language));
    assert.ok(!result.includes('<script'), String(language));
    assert.ok(result.includes('&lt;'), String(language));
    assert.ok(result.includes('&amp;'), String(language));
  }
});
