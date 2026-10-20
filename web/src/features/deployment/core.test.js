import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDraft, payload, priceInput, updateConfiguration, safePublicURL } from './core.ts';

const draft = { ...initialDraft, name: ' inference ', image: ' vendor/model:latest ', hardware: '3', gpus: '2', replicas: '4', hours: '24', locations: [1, 2], environment: '{"DATE":"2026-10-19T12:00:00"}', secrets: '{"TOKEN":"private"}', args: '["--port","8000"]' };

test('deployment quote and creation share hardware, regions, duration and replicas', () => {
  const body = payload(draft);
  assert.deepEqual(priceInput(body), { hardware_id: 3, location_ids: [1, 2], gpus_per_container: 2, duration_hours: 24, replica_count: 4, currency: 'usdc' });
  assert.equal(body.resource_private_name, 'inference');
  assert.equal(body.registry_config.image_url, 'vendor/model:latest');
  assert.equal(body.container_config.env_variables.DATE, '2026-10-19T12:00:00');
  assert.equal(body.container_config.secret_env_variables.TOKEN, 'private');
  assert.deepEqual(body.container_config.args, ['--port', '8000']);
  body.location_ids.push(9);
  assert.deepEqual(draft.locations, [1, 2]);
});

test('invalid allocation and port values cannot become payable requests', () => {
  for (const patch of [{ hours: '0' }, { replicas: '1.5' }, { hardware: '-1' }, { gpus: 'Infinity' }, { hours: '9007199254740993' }, { port: '65536' }, { locations: [] }, { locations: [1, 1] }, { locations: [-1] }, { image: ' ' }]) assert.throws(() => payload({ ...draft, ...patch }));
});

test('container configuration validates JSON types without coercing secrets', () => {
  for (const patch of [{ environment: '[]' }, { environment: '{"VALUE":1}' }, { secrets: 'null' }, { entrypoint: '{}' }, { args: '["valid",5]' }]) assert.throws(() => payload({ ...draft, ...patch }));
});

test('updates preserve explicit empty collections and zero port, reject unknown fields', () => {
  assert.deepEqual(updateConfiguration('{"env_variables":{},"entrypoint":[],"traffic_port":0}'), { env_variables: {}, entrypoint: [], traffic_port: 0 });
  for (const input of ['[]', '{}', '{"duration_hours":10}', '{"traffic_port":"8000"}', '{"image_url":false}', '{"secret_env_variables":{"TOKEN":null}}']) assert.throws(() => updateConfiguration(input));
});

test('container links accept only public HTTP URLs without embedded credentials', () => {
  assert.equal(safePublicURL('https://inference.example/v1'), 'https://inference.example/v1');
  for (const input of ['javascript:alert(1)', 'data:text/html,hello', '//example.com', 'https://user:secret@example.com']) assert.equal(safePublicURL(input), undefined);
});
