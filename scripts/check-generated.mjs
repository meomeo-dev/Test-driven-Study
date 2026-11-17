import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function fingerprints(directory) {
  return Object.fromEntries(readdirSync(directory).sort().map(name => {
    const file = path.join(directory, name);
    return [name, createHash('sha256').update(readFileSync(file)).digest('hex')];
  }));
}
const directories = ['web/src/api/generated', 'internal/storage/storedb'];
const before = directories.map(fingerprints);
execFileSync('npm', ['run', 'generate'], { stdio: 'inherit' });
const after = directories.map(fingerprints);
if (JSON.stringify(before) !== JSON.stringify(after)) {
  throw new Error('Generated bindings were stale; review and retain the regenerated files');
}
console.log('Generated HTTP types and SQL bindings are current.');
