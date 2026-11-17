import { readFileSync, writeFileSync } from 'node:fs';
import { TYPES, currentBranch, fail, git, isLinkedWorktree, nextId, slugify } from './issue-lib.mjs';
const args = process.argv.slice(2);
let type = 'feat';
let force = false;
const titleParts = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--force' || arg === '-f') force = true;
  else if (arg === '--type' || arg === '-t') type = args[++index];
  else if (arg.startsWith('--type=')) type = arg.slice(7);
  else titleParts.push(arg);
}
if (isLinkedWorktree()) {
  fail('Git worktree development is prohibited. Create issues in the primary checkout.');
}
if (currentBranch() !== 'main') {
  if (!force) fail('Create issues only in the primary checkout on main');
  console.warn('Issue numbering override: issue numbering may be stale');
}
if (!TYPES.includes(type)) fail('Unsupported issue type');
const title = titleParts.join(' ').trim();
const slug = slugify(title);
if (!slug) fail('Provide a title with ASCII letters or digits');
const id = String(nextId()).padStart(4, '0');
const branch = `${type}/${id}-${slug}`;
let text = readFileSync('issues/_template.md', 'utf8');
for (const [key, value] of Object.entries({ id, type, status: 'open', labels: '[]', branch,
  created: new Date().toISOString().slice(0, 10), title })) {
  text = text.replaceAll(`{{${key}}}`, value);
}
const filename = `issues/${id}-${type}-${slug}.md`;
writeFileSync(filename, text, { flag: 'wx' });
console.log(`${filename}\nBranch: ${branch}`);
console.log('Complete the issue, run issue:check, and commit it on main.');
console.log(`Then run git switch -c ${branch} main in the primary checkout.`);
if (git(['status', '--porcelain', '--', 'issues/']).split('\n').some(line => line.startsWith('??'))) {
  console.warn('Commit untracked issues on main before switching to implementation.');
}
