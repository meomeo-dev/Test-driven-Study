import concurrently from 'concurrently';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) loadEnvFile('.env');
const ports = ['STUDY_API_PORT', 'STUDY_WEB_PORT'];
for (const name of ports) {
  const value = process.env[name];
  if (value && (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535)) {
    throw new Error(`${name} must be a port between 1024 and 65535`);
  }
}
const { result } = concurrently([
  { command: 'go run ./cmd/server', name: 'api', prefixColor: 'green' },
  { command: 'node scripts/web.mjs', name: 'web', prefixColor: 'cyan' },
], { killOthers: ['failure', 'success'], successCondition: 'all' });
try { await result; }
catch { process.exitCode = 1; }
