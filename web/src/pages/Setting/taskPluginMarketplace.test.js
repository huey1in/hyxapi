import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  fetchMarketplaceArtifact,
  MarketplaceHTTPError,
  parseMarketplaceIndex,
  resolvePluginSourceUrl,
} from './taskPluginMarketplace.js';

test('marketplace paths stay on their source without credentials', () => {
  const index = 'https://plugins.example/catalog/index.json';
  assert.equal(
    resolvePluginSourceUrl(index, './plugin.js'),
    'https://plugins.example/catalog/plugin.js',
  );
  for (const path of [
    'https://other.example/p.js',
    '//other.example/p.js',
    'javascript:alert(1)',
    'https://user:pass@plugins.example/p.js',
    '',
  ]) {
    assert.equal(resolvePluginSourceUrl(index, path), null);
  }
});

test('marketplace filters unsupported kinds and chooses an available version', () => {
  const plugins = parseMarketplaceIndex({
    indexVersion: 1,
    plugins: [
      {
        key: 'future',
        versions: [{ version: '1', path: 'x.js', kind: 'http' }],
      },
      {
        key: 'valid',
        latest: 'missing',
        versions: [{ version: '1.0', path: 'a.js', kind: 'task' }],
      },
      {
        key: 'first',
        sortPriority: 2,
        versions: [{ version: '2', path: 'b.js' }],
      },
      null,
    ],
  });
  assert.deepEqual(
    plugins.map((plugin) => [plugin.key, plugin.latest]),
    [
      ['first', '2'],
      ['valid', '1.0'],
    ],
  );
  assert.throws(() => parseMarketplaceIndex({ indexVersion: 2, plugins: [] }));
});

test('download verifies bytes, strips credentials, and rejects digest or redirect changes', async () => {
  const source = 'export const meta = {name:"测试"};\n';
  const digest = createHash('sha256').update(source).digest('hex');
  const index = 'https://plugins.example/index.json';
  const fetcher = async (_url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response(source);
  };
  assert.equal(
    (await fetchMarketplaceArtifact(index, 'a.js', digest, fetcher)).source,
    source,
  );
  await assert.rejects(
    fetchMarketplaceArtifact(index, 'a.js', '0'.repeat(64), fetcher),
    /SHA-256/,
  );
  await assert.rejects(
    fetchMarketplaceArtifact(index, 'a.js', 'bad', fetcher),
    /SHA-256/,
  );
  await assert.rejects(
    fetchMarketplaceArtifact(index, 'a.js', digest, async () => ({
      ok: true,
      url: 'https://other.example/a.js',
      arrayBuffer: () => new TextEncoder().encode(source).buffer,
    })),
    /重定向/,
  );
});

test('marketplace download follows its owner cancellation and rejects late bytes', async () => {
  const owner = new AbortController();
  let receivedSignal;
  await assert.rejects(
    fetchMarketplaceArtifact(
      'https://plugins.example/index.json',
      'a.js',
      undefined,
      async (_url, options) => {
        receivedSignal = options.signal;
        return {
          ok: true,
          arrayBuffer: async () => {
            owner.abort();
            return new Uint8Array([1]).buffer;
          },
        };
      },
      true,
      owner.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(receivedSignal.aborted, true);
  let requests = 0;
  await assert.rejects(
    fetchMarketplaceArtifact(
      'https://plugins.example/index.json',
      'a.js',
      undefined,
      async () => {
        requests++;
      },
      true,
      owner.signal,
    ),
    { name: 'AbortError' },
  );
  assert.equal(requests, 0);
});

test('marketplace HTTP failures preserve status for localized errors without reading an artifact', async () => {
  let read = false;
  await assert.rejects(
    fetchMarketplaceArtifact(
      'https://plugins.example/index.json',
      'a.js',
      undefined,
      async () => ({
        ok: false,
        status: 503,
        arrayBuffer: async () => {
          read = true;
          return new ArrayBuffer(0);
        },
      }),
    ),
    (error) => error instanceof MarketplaceHTTPError && error.status === 503,
  );
  assert.equal(read, false);
});
