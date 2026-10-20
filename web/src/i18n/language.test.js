import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLanguage, supportedLanguages } from './language.ts';

test('browser and legacy locale aliases retain all seven interface languages', () => {
  for (const [input, expected] of Object.entries({
    zhCN: 'zh-CN', 'zh_Hans_CN': 'zh-CN', 'zh-Hant-HK': 'zh-TW',
    zhTW: 'zh-TW', 'ZH_hk': 'zh-TW', 'zh-MO': 'zh-TW',
    'en-US': 'en', 'fr-CA': 'fr', 'ja-JP': 'ja', 'vi-VN': 'vi', 'ru_RU': 'ru',
    de: 'en',
  })) assert.equal(normalizeLanguage(input), expected, input);
  assert.equal(supportedLanguages.length, 7);
  assert.equal(normalizeLanguage(null), null);
});
