const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { externalURL, reservePort, serverEnvironment, LocalServer } = require('./runtime.cjs');

function directory(t) {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'hyxware-desktop-'));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

test('desktop isolates local state from inherited database credentials and retains its session secret', (t) => {
  const dataDir = directory(t);
  const before = { SQL_DSN: 'external-private-db', LOG_SQL_DSN: 'external-log-db', REDIS_CONN_STRING: 'redis://external', SESSION_SECRET: 'foreign-secret' };
  const first = serverEnvironment(dataDir, 39393, before);
  const second = serverEnvironment(dataDir, 49494, before);
  assert.equal(first.SQL_DSN, '');
  assert.equal(first.LOG_SQL_DSN, '');
  assert.equal(first.REDIS_CONN_STRING, '');
  assert.equal(first.BIND_ADDRESS, '127.0.0.1');
  assert.equal(first.SQLITE_PATH, path.join(dataDir, 'hyxware.db'));
  assert.notEqual(first.SESSION_SECRET, before.SESSION_SECRET);
  assert.equal(first.SESSION_SECRET, second.SESSION_SECRET);
  assert.equal(second.PORT, '49494');
  fs.writeFileSync(path.join(dataDir, 'session-secret'), 'broken');
  assert.throws(() => serverEnvironment(dataDir, 3000), /invalid/);
});

test('external links allow supported clients and reject local executable and credential URLs', () => {
  for (const value of ['https://example.com', 'http://localhost:3000', 'cherrystudio://import?data=encoded', 'ccswitch://import']) assert.equal(externalURL(value), true, value);
  for (const value of ['file:///C:/Windows/test.exe', 'javascript:alert(1)', 'data:text/html,abc', 'https://key:secret@example.com', 'unknown://run', 'not a URL']) assert.equal(externalURL(value), false, value);
});

test('ephemeral port selection leaves an occupied server running', async (t) => {
  const existing = net.createServer();
  await new Promise((resolve) => existing.listen(0, '127.0.0.1', resolve));
  t.after(() => existing.close());
  const port = await reservePort();
  assert.notEqual(port, existing.address().port);
  assert.equal(existing.listening, true);
  await assert.rejects(reservePort(existing.address().port), { code: 'EADDRINUSE' });
});

test('missing server binary reports failure and cleanup completes', async (t) => {
  const local = new LocalServer(path.join(directory(t), 'missing-binary'), directory(t));
  await assert.rejects(local.start({ timeout: 3000 }), /ENOENT/);
  await local.stop();
  assert.equal(local.process, null);
});
