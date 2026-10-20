import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (name) => JSON.parse(readFileSync(new URL(`./locales/${name}.json`, import.meta.url), 'utf8')).translation;
const english = read('en');
const variables = (text) => [...text.matchAll(/{{\s*([^}]+)\s*}}/g)].map((match) => match[1].trim()).sort();

for (const language of ['zh-CN', 'zh-TW', 'fr', 'ru', 'ja', 'vi']) {
  test(`${language} authentication translations retain all keys and interpolation variables`, () => {
    const translations = read(language);
    for (const [key, value] of Object.entries(english)) {
      if (!key.startsWith('auth.')) continue;
      assert.ok(translations[key], `${language}: ${key}`);
      assert.deepEqual(variables(translations[key]), variables(value), key);
    }
  });
}
