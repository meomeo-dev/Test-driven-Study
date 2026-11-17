import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

export const TYPES = ['feat', 'fix', 'perf', 'docs', 'chore'];
export const STATUSES = ['open', 'in-progress', 'closed', 'draft'];
export const REQUIRED_FIELDS = ['id', 'type', 'status', 'branch', 'created'];
export const REQUIRED_SECTIONS = [
  '背景 / 目标', '关键功能清单（Key Feature List，KFL）', '改造面', '非目标',
  '验收标准（Acceptance Criteria，AC）', '讨论',
];
export const FILENAME_RE = /^(\d{4})-([a-z]+)-([a-z0-9一-鿿-]+)\.md$/;
export const MAIN_BRANCH = 'main';
export function fail(message) { console.error(message); process.exit(1); }
export function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
export function gitSafe(args) {
  try { return { ok: true, out: git(args) }; }
  catch (error) { return { ok: false, out: error.stderr?.toString().trim() ?? error.message }; }
}
export const currentBranch = () => git(['branch', '--show-current']);
export function isLinkedWorktree() {
  return git(['rev-parse', '--git-dir']) !== git(['rev-parse', '--git-common-dir']);
}
export function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60).replace(/-$/, '');
}
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  return Object.fromEntries(match[1].split(/\r?\n/).filter(line => line.includes(':'))
    .map(line => {
      const index = line.indexOf(':');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
}
export function validateIssue(filename, text) {
  const errors = [];
  const match = filename.match(FILENAME_RE);
  if (!match) errors.push('Invalid issue filename');
  const fields = parseFrontmatter(text);
  for (const field of REQUIRED_FIELDS) if (!fields[field]) errors.push(`Missing ${field}`);
  if (!TYPES.includes(fields.type)) errors.push('Invalid type');
  if (!STATUSES.includes(fields.status)) errors.push('Invalid status');
  if (match) {
    if (Number(fields.id) !== Number(match[1])) errors.push('ID differs from filename');
    if (fields.type !== match[2]) errors.push('Type differs from filename');
    if (fields.branch !== `${match[2]}/${match[1]}-${match[3]}`) errors.push('Branch differs from filename');
  }
  if (fields.status === 'closed' && !fields['closed-by']) errors.push('Closed issue needs closed-by');
  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(`## ${section}`)) errors.push(`Missing section ${section}`);
  }
  if (['{{', '待填写', 'TODO'].some(marker => text.includes(marker))) errors.push('Unresolved placeholder');
  return errors;
}
export function listIssueFiles() {
  return readdirSync('issues').filter(name => name.endsWith('.md')
    && !name.startsWith('_') && name !== 'README.md').sort();
}
export function nextId() {
  const numbers = listIssueFiles().map(name => Number(name.match(FILENAME_RE)?.[1] ?? 0));
  return Math.max(0, ...numbers) + 1;
}
