import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: data } = await loadTestModules([
  './src/pages/Setting/setting-data.ts',
]);

test('worker settings reject unsafe endpoints across hidden tabs and allow disabling direct downloads', () => {
  for (const value of [
    ' ',
    'worker.example',
    'ftp://worker.example',
    'https://user:secret@worker.example',
    'https://worker.example/#fragment',
    'https://worker.example\n',
  ]) {
    assert.deepEqual(data.invalidSettingKeys({ WorkerUrl: value }, {}), [
      'WorkerUrl',
    ]);
  }
  for (const value of [
    '',
    'https://worker.example/download',
    'http://127.0.0.1:9000',
  ]) {
    assert.deepEqual(data.invalidSettingKeys({ WorkerUrl: value }, {}), []);
  }
  assert.deepEqual(
    data.invalidSettingKeys({ WorkerAllowHttpImageRequestEnabled: 'yes' }, {}),
    ['WorkerAllowHttpImageRequestEnabled'],
  );
});
