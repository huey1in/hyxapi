import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCCSwitchURL, ccSwitchKeySchema, ccSwitchModelsSchema } from './cc-switch.ts';

const options = { app: 'claude', name: 'HyxAPI / development & tests', apiKey: 'test-key', serverAddress: 'https://api.example.test/', models: { model: 'provider/model?x=1&y=2', haikuModel: 'light+fast', sonnetModel: 'balanced', opusModel: 'powerful' } };

test('CC Switch links encode the selected key, names and model aliases for each native client', () => {
  for (const [app, format, endpoint] of [
    ['claude', 'anthropic', 'https://api.example.test'],
    ['codex', 'openai_responses', 'https://api.example.test/v1'],
    ['gemini', 'gemini_native', 'https://api.example.test'],
  ]) {
    const url = new URL(buildCCSwitchURL({ ...options, app }));
    assert.equal(url.protocol, 'ccswitch:');
    assert.equal(url.host, 'v1');
    assert.equal(url.pathname, '/import');
    const p = url.searchParams;
    assert.equal(p.get('resource'), 'provider');
    assert.equal(p.get('app'), app);
    assert.equal(p.get('apiFormat'), format);
    assert.equal(p.get('endpoint'), endpoint);
    assert.equal(p.get('homepage'), 'https://api.example.test');
    assert.equal(p.get('apiKey'), 'sk-test-key');
    assert.equal(p.get('name'), options.name);
    assert.equal(p.get('model'), options.models.model);
    assert.equal(p.get('enabled'), 'true');
    for (const field of ['haikuModel', 'sonnetModel', 'opusModel']) assert.equal(p.get(field), app === 'claude' ? options.models[field] : null);
    assert.equal(p.has('usageAccessToken'), false);
  }
});

test('CC Switch preserves deployment paths and normalizes key prefixes without repeated API versions', () => {
  const params = new URL(buildCCSwitchURL({ ...options, app: 'codex', serverAddress: 'https://api.example.test/gateway/v1/', apiKey: 'sk-existing-key' })).searchParams;
  assert.equal(params.get('endpoint'), 'https://api.example.test/gateway/v1');
  assert.equal(params.get('apiKey'), 'sk-existing-key');
  assert.equal(new URL(buildCCSwitchURL({ ...options, app: 'codex', serverAddress: 'http://localhost:3000/gateway/' })).searchParams.get('endpoint'), 'http://localhost:3000/gateway/v1');
  assert.equal(new URL(buildCCSwitchURL({ ...options, models: { model: 'model', haikuModel: '' } })).searchParams.has('haikuModel'), false);
});

test('CC Switch rejects missing or masked keys, invalid models and unexpected destinations', () => {
  for (const serverAddress of ['javascript:alert(1)', 'file:///tmp', 'https://user:pass@example.test', 'https://api.example.test?secret=x', 'https://api.example.test/#fragment', 'invalid']) assert.throws(() => buildCCSwitchURL({ ...options, serverAddress }), /Invalid API server address/);
  for (const apiKey of ['', 'sk-', 'masked***key', 'key\nvalue']) {
    assert.throws(() => buildCCSwitchURL({ ...options, apiKey }), /Invalid API key response/);
    assert.equal(ccSwitchKeySchema.safeParse({ success: true, data: { key: apiKey } }).success, false);
  }
  assert.throws(() => buildCCSwitchURL({ ...options, app: 'toString' }), /Invalid CC Switch application/);
  assert.throws(() => buildCCSwitchURL({ ...options, name: ' ' }), /Please enter a name/);
  assert.throws(() => buildCCSwitchURL({ ...options, models: { model: '' } }), /Please select a primary model/);
  assert.equal(ccSwitchModelsSchema.safeParse({ success: true, data: [{ id: 'model' }] }).success, true);
  for (const data of [null, ['model'], [{ id: '' }], [{ name: 'model' }]]) assert.equal(ccSwitchModelsSchema.safeParse({ success: true, data }).success, false);
});
