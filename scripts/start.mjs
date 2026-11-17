import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';

if (existsSync('.env')) loadEnvFile('.env');
const binary = process.platform === 'win32'
  ? 'var/bin/test-driven-study.exe' : 'var/bin/test-driven-study';
if (!existsSync(binary)) throw new Error('Run npm run build before npm start');
const child = spawn(binary, [], { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
