import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSupportedModelBrands } from './modelBrands.js';

test('returns only configured vendors referenced by supported models', () => {
  const models = [
    { model_name: 'gpt-4.1', vendor_id: 1 },
    { model_name: 'gpt-4o-mini', vendor_id: 1 },
    { model_name: 'claude-sonnet-4', vendor_id: 2 },
  ];
  const vendors = [
    { id: 1, name: 'OpenAI', icon: 'OpenAI' },
    { id: 2, name: 'Anthropic', icon: 'Claude.Color' },
    { id: 3, name: 'Unused', icon: 'Gemini.Color' },
  ];

  assert.deepEqual(extractSupportedModelBrands(models, vendors), [
    { name: 'OpenAI', icon: 'OpenAI' },
    { name: 'Anthropic', icon: 'Claude.Color' },
  ]);
});

test('infers and deduplicates brands for models without vendor metadata', () => {
  const models = [
    { model_name: 'gemini-2.5-pro' },
    { model_name: 'gemini-2.5-flash' },
    { model_name: 'deepseek-chat' },
    { model_name: 'unknown-model' },
  ];

  assert.deepEqual(extractSupportedModelBrands(models, []), [
    { name: 'Google', icon: 'Gemini.Color' },
    { name: 'DeepSeek', icon: 'DeepSeek.Color' },
  ]);
});
