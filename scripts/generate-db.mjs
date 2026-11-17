import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Reuse the pinned cached module without Go's online @version deprecation lookup.
// Missing tools fail closed; dependency acquisition must use an explicit proxy.
const root = process.cwd();
const cache = execFileSync('go', ['env', 'GOMODCACHE'], { encoding: 'utf8' }).trim();
const module = path.join(cache, 'github.com/sqlc-dev/sqlc@v1.31.1');
if (!existsSync(path.join(module, 'cmd/sqlc/main.go'))) {
  throw new Error('sqlc v1.31.1 is not cached. Acquire it through an explicit proxy first.');
}
execFileSync('go', ['run', '-mod=readonly', './cmd/sqlc', 'generate',
  '-f', path.join(root, 'sqlc.yaml')], {
  cwd: module, stdio: 'inherit',
  env: { ...process.env, GOPROXY: 'off', GOSUMDB: 'off' },
});
