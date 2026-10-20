const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');

function externalURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol)
      && !url.username && !url.password;
  } catch { return false; }
}

function reservePort(preferred = 0) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(preferred, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function serverEnvironment(dataDir, port, inherited = process.env) {
  fs.mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, 'session-secret');
  let secret;
  try { secret = fs.readFileSync(secretPath, 'utf8').trim(); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    secret = randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, secret, { mode: 0o600, flag: 'wx' });
  }
  if (secret.length < 32) throw new Error('The local session-secret file is invalid. Restore it from your backup.');
  return {
    ...inherited, PORT: String(port), BIND_ADDRESS: '127.0.0.1',
    SQL_DSN: '', LOG_SQL_DSN: '', REDIS_CONN_STRING: '',
    SQLITE_PATH: path.join(dataDir, 'hyxware.db'), SESSION_SECRET: secret,
    SESSION_COOKIE_SECURE: 'false', ENABLE_PPROF: 'false', GIN_MODE: 'release',
  };
}

class LocalServer {
  constructor(binary, dataDir) {
    this.binary = binary;
    this.dataDir = dataDir;
    this.logs = [];
    this.process = null;
    this.stopping = false;
    this.onUnexpectedExit = () => {};
  }

  async start({ timeout = 60000 } = {}) {
    if (this.process) throw new Error('The local server is already running.');
    fs.mkdirSync(this.dataDir, { recursive: true });
    const portPath = path.join(this.dataDir, 'server-port');
    let preferred = 0;
    try {
      preferred = Number(fs.readFileSync(portPath, 'utf8').trim());
      if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) throw new Error('The saved desktop port is invalid.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let port;
    try { port = await reservePort(preferred); } catch (error) {
      if (error.code === 'EADDRINUSE') throw new Error(`The saved desktop port ${preferred} is occupied. Close the other local service and try again.`);
      throw error;
    }
    if (!preferred) fs.writeFileSync(portPath, String(port), { mode: 0o600, flag: 'wx' });
    this.origin = `http://127.0.0.1:${port}`;
    const env = serverEnvironment(this.dataDir, port);
    const child = spawn(this.binary, ['--port', String(port), '--log-dir', path.join(this.dataDir, 'logs')], {
      cwd: this.dataDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.process = child;
    this.closed = new Promise((resolve) => child.once('close', resolve));
    let failure;
    child.once('error', (error) => { failure = error; });
    const append = (data) => {
      this.logs.push(data.toString().slice(-8192));
      if (this.logs.length > 100) this.logs.shift();
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('close', (code) => {
      failure ||= new Error(`The local server exited (${code ?? 'signal'}).`);
      if (!this.stopping && this.ready) this.onUnexpectedExit(failure);
    });
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (failure || child.exitCode !== null || child.signalCode !== null) throw failure || new Error('The local server stopped.');
      const healthy = await new Promise((resolve) => {
        const request = http.get(this.origin + '/api/setup', { timeout: 1000 }, (response) => {
          let body = '';
          response.on('data', (data) => { if (body.length < 65536) body += data; });
          response.on('end', () => {
            try { resolve(response.statusCode === 200 && JSON.parse(body).success === true); } catch { resolve(false); }
          });
          response.on('error', () => resolve(false));
        });
        request.on('error', () => resolve(false));
        request.on('timeout', () => { request.destroy(); resolve(false); });
      });
      if (healthy && !failure && child.exitCode === null && child.signalCode === null) {
        this.ready = true;
        return this.origin;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('The local server did not become ready within 60 seconds.');
  }

  async stop() {
    this.stopping = true;
    const child = this.process;
    if (!child) return;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      let timer;
      await Promise.race([this.closed, new Promise((resolve) => { timer = setTimeout(resolve, 5000); })]);
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await this.closed;
    this.process = null;
  }
}

module.exports = { LocalServer, externalURL, reservePort, serverEnvironment };
