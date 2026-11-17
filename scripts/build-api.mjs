import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
mkdirSync('var/bin', { recursive: true });
const file = process.platform === 'win32' ? 'test-driven-study.exe' : 'test-driven-study';
execFileSync('go', ['build', '-o', `var/bin/${file}`, './cmd/server'], { stdio: 'inherit' });
