import { readFileSync } from 'node:fs';
import path from 'node:path';
import { listIssueFiles, validateIssue } from './issue-lib.mjs';
const files = process.argv[2] ? [process.argv[2]] : listIssueFiles().map(name => `issues/${name}`);
let failed = false;
for (const filename of files) {
  const errors = validateIssue(path.basename(filename), readFileSync(filename, 'utf8'));
  console.log(`${errors.length ? '✗' : '✓'} ${filename}`);
  for (const error of errors) console.error(`  ${error}`);
  failed ||= errors.length > 0;
}
if (failed) process.exitCode = 1;
