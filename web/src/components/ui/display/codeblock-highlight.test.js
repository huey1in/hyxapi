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

test('sensitive code masking escapes markup and preserves explicit reveal', () => {
  const secret = 'sk-123456<secret>7890';
  const hidden = highlightCode(`TOKEN=${secret}`, 'unknown-language', secret);
  assert.match(hidden, /blur-\[4px\]/);
  assert.ok(!hidden.includes('<secret>'));
  const revealed = highlightCode(`TOKEN=${secret}`, 'unknown-language', secret, true);
  assert.ok(!revealed.includes('blur-'));
  assert.match(revealed, /&lt;secret&gt;/);
});
