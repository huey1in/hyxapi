import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const localePaths = ['en.json', 'zh-CN.json'];

const activeRatioKeys = new Set([
  '倍率', '分组倍率', '充值分组倍率', '含请求倍率', '本次请求倍率',
  '计费时的原价；本次分组倍率见详情。', '请求倍率（按顺序相乘）',
]);

for (const localeName of localePaths) {
  test(`${localeName} does not expose removed ratio-pricing copy`, () => {
    const localePath = fileURLToPath(new URL(`./locales/${localeName}`, import.meta.url));
    const translations = JSON.parse(readFileSync(localePath, 'utf8')).translation;
    const staleKeys = Object.keys(translations).filter((key) => (
      key.includes('{{ratio}}')
      || key.includes('{{ratioType}}')
      || (key.includes('倍率') && !activeRatioKeys.has(key))
    ));

    assert.deepEqual(staleKeys, []);
  });
}
