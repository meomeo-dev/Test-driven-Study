import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { listening } from '../../scripts/dev-port-probe.mjs';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const script = path.join(root, 'scripts/dev-process.mjs');

test('port reset is occupied until a later refusal, while other errors surface', async () => {
  let destroyed = 0;
  const connectError = code => () => {
    const socket = new EventEmitter();
    socket.destroy = () => { destroyed++; };
    socket.setTimeout = () => {};
    queueMicrotask(() => socket.emit('error', Object.assign(new Error(code), { code })));
    return socket;
  };
  assert.equal(await listening(43187, connectError('ECONNRESET')), true);
  assert.equal(await listening(43187, connectError('ECONNREFUSED')), false);
  await assert.rejects(listening(43187, connectError('EACCES')), { code: 'EACCES' });
  assert.equal(destroyed, 3);
});

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'startup-study-'));
  const webPort = await freePort();
  let apiPort = await freePort();
  while (apiPort === webPort) apiPort = await freePort();
  const env = { ...process.env, STUDY_DATA_DIR: directory,
    STUDY_WEB_PORT: String(webPort), STUDY_API_PORT: String(apiPort) };
  const run = action => execute(process.execPath, [script, action], { cwd: root, env, timeout: 130_000 });
  t.after(async () => { await run('down'); rmSync(directory, { recursive: true }); });
  return { directory, webPort, apiPort, run, state: path.join(directory, 'dev-process.json') };
}

test('background startup survives launcher exit, reuses its PID, and stops both ports', async t => {
  const app = await fixture(t);
  const started = await app.run('up');
  assert.match(started.stdout, /Running in background/);
  const original = JSON.parse(readFileSync(app.state, 'utf8'));
  const page = await fetch(`http://127.0.0.1:${app.webPort}/memorize`);
  assert.equal(page.status, 200);
  const base = `http://127.0.0.1:${app.webPort}`;
  const courses = await (await fetch(`${base}/api/courses`)).json();
  const chinese = courses.find(course => course.id === 'elementary-chinese');
  assert.equal(chinese.version, '1.0.4');
  const subject = chinese.units[0].subject_id;
  const data = await (await fetch(`${base}/api/study/overview?subject=${subject}`)).json();
  assert.equal(data.total, 16);
  assert.equal((await fetch(`${base}/api/study/overview?subject=1`)).status, 400);
  const repeated = await app.run('up');
  assert.match(repeated.stdout, /Already running/);
  assert.equal(JSON.parse(readFileSync(app.state, 'utf8')).pid, original.pid);
  assert.match((await app.run('status')).stdout, /Running/);
  await app.run('down');
  assert.equal(existsSync(app.state), false);
  for (const port of [app.webPort, app.apiPort]) {
    await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) }));
  }
});

test('stale PID metadata does not terminate an unrelated process', async t => {
  const app = await fixture(t);
  writeFileSync(app.state, JSON.stringify({ root, pid: process.pid,
    marker: '--study-session=not-the-test-process', webPort: app.webPort, apiPort: app.apiPort }));
  const stopped = await app.run('down');
  assert.match(stopped.stdout, /no unrelated process was stopped/);
  assert.equal(existsSync(app.state), false);
});

test('occupied ports fail without leaving a process record or killing the occupant', async t => {
  const app = await fixture(t);
  const occupant = createServer(socket => socket.end());
  await new Promise(resolve => occupant.listen(app.webPort, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => occupant.close(resolve)));
  await assert.rejects(app.run('up'), error => {
    assert.match(error.stderr, /occupied/);
    return true;
  });
  assert.equal(existsSync(app.state), false);
  assert.equal(occupant.listening, true);
});
