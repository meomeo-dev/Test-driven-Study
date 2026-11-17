import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { listening } from './dev-port-probe.mjs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (existsSync('.env')) loadEnvFile('.env');
const directory = path.resolve(process.env.STUDY_DATA_DIR ?? 'var');
const stateFile = path.join(directory, 'dev-process.json');
const logFile = path.join(directory, 'dev.log');
const script = path.join(root, 'scripts/dev.mjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function configuredPort(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be a port between 1024 and 65535`);
  }
  return port;
}

function readState() {
  if (!existsSync(stateFile)) return undefined;
  const record = JSON.parse(readFileSync(stateFile, 'utf8'));
  if (record.root !== root || !Number.isInteger(record.pid) || record.pid <= 0
      || typeof record.marker !== 'string' || !record.marker.startsWith('--study-session=')
      || ![record.webPort, record.apiPort].every(port => Number.isInteger(port) && port >= 1024 && port <= 65535)) {
    throw new Error(`Invalid process record; inspect ${stateFile}`);
  }
  return record;
}

function owned(record) {
  if (!record || !Number.isInteger(record.pid) || record.pid <= 0) return false;
  try {
    const command = execFileSync('ps', ['-p', String(record.pid), '-o', 'command='], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return command.includes(script) && command.includes(record.marker);
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

async function healthy(record) {
  try {
    const [api, web] = await Promise.all([
      fetch(`http://127.0.0.1:${record.apiPort}/api/health`, { signal: AbortSignal.timeout(1500) }),
      fetch(`http://127.0.0.1:${record.webPort}/memorize`, { signal: AbortSignal.timeout(1500) }),
    ]);
    return api.ok && web.ok && (await api.json()).status === 'ok';
  } catch (error) {
    if (error instanceof TypeError || error.name === 'TimeoutError') return false;
    throw error;
  }
}

function describe(record, label) {
  console.log(`${label} (PID ${record.pid})`);
  console.log(`Frontend: http://127.0.0.1:${record.webPort}/memorize`);
  console.log(`API: http://127.0.0.1:${record.apiPort}`);
  console.log(`Log: ${logFile}`);
}

async function waitUntilReady(record) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (!owned(record)) throw new Error(`Development server exited; inspect ${logFile}`);
    if (await healthy(record)) return;
    await pause(200);
  }
  throw new Error(`Development startup timed out; inspect ${logFile}`);
}

async function stop(record) {
  if (!owned(record)) {
    unlinkSync(stateFile);
    console.log('Removed stale process record; no unrelated process was stopped.');
    return;
  }
  process.kill(-record.pid, 'SIGTERM');
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    const ports = await Promise.all([listening(record.webPort), listening(record.apiPort)]);
    if (!owned(record) && ports.every(active => !active)) {
      unlinkSync(stateFile);
      console.log('Development server stopped.');
      return;
    }
    await pause(200);
  }
  throw new Error(`Shutdown incomplete; inspect ${logFile} and ${stateFile}`);
}

async function launch(record) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const state = openSync(stateFile, 'wx', 0o600);
  let log;
  try {
    log = openSync(logFile, 'a', 0o600);
    const child = spawn(process.execPath, [script, record.marker], {
      cwd: root, detached: true, stdio: ['ignore', log, log], env: process.env,
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    record.pid = child.pid;
    writeFileSync(state, `${JSON.stringify(record, null, 2)}\n`);
    child.unref();
  } catch (error) {
    if (owned(record)) process.kill(-record.pid, 'SIGTERM');
    unlinkSync(stateFile);
    throw error;
  } finally {
    closeSync(state);
    if (log !== undefined) closeSync(log);
  }
}

async function up() {
  const previous = readState();
  if (owned(previous)) {
    await waitUntilReady(previous);
    describe(previous, 'Already running');
    return;
  }
  if (previous) unlinkSync(stateFile);
  const record = { root, marker: `--study-session=${randomUUID()}`,
    webPort: configuredPort('STUDY_WEB_PORT', 43387),
    apiPort: configuredPort('STUDY_API_PORT', 43388), startedAt: new Date().toISOString() };
  if (record.webPort === record.apiPort) throw new Error('Frontend and API ports must differ');
  for (const port of [record.webPort, record.apiPort]) {
    if (await listening(port)) throw new Error(`Port ${port} is occupied; stop the existing server or change .env`);
  }
  await launch(record);
  try { await waitUntilReady(record); }
  catch (error) { await stop(record); throw error; }
  describe(record, 'Running in background');
}

async function main() {
  if (process.platform === 'win32') {
    throw new Error('Background management requires macOS/Linux; use npm run dev on Windows.');
  }
  const action = process.argv[2];
  if (action === 'up') return up();
  if (!['down', 'status'].includes(action)) throw new Error('Use up, down, or status');
  const record = readState();
  if (!record) {
    console.log('Development server is not managed or not running.');
    if (action === 'status') process.exitCode = 1;
    return;
  }
  if (action === 'down') return stop(record);
  const ready = owned(record) && await healthy(record);
  describe(record, ready ? 'Running' : 'Not ready or stopped');
  if (!ready) process.exitCode = 1;
}

try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
