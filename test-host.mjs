/**
 * Offline checks for the Host helpers. No DSH runtime needed.
 *
 *   node test-host.mjs
 *
 * Covers the two things that once broke in production: the CRLF handling in
 * `setFrontmatterFlag` (rewriting a skill file must not mangle its line endings)
 * and the prefix-route matching (a trailing slash in the registered path made
 * every API call 404).
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const API_BASE = '/agency-skill-panel/api';
const FLAG = 'disable-model-invocation';

/* --- copies of the plugin's helpers --------------------------------------- */

async function setFrontmatterFlag(filePath, disabled) {
  const text = await readFile(filePath, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[0] !== '---') return undefined;
  const close = lines.indexOf('---', 1);
  if (close < 0) return undefined;

  const head = lines.slice(1, close);
  const at = head.findIndex((line) => line.startsWith(`${FLAG}:`));
  const next = `${FLAG}: ${disabled ? 'true' : 'false'}`;

  if (at >= 0) {
    if (head[at].trim() === next) return disabled;
    head[at] = next;
  } else if (disabled) {
    head.push(next);
  } else {
    return disabled;
  }

  const rebuilt = ['---', ...head, '---', ...lines.slice(close + 1)].join(eol);
  if (rebuilt === text) return disabled;
  await writeFile(filePath, rebuilt, 'utf8');
  return disabled;
}

/** Mirrors the dispatcher: exact match, else `prefix` or `prefix + '/'`. */
function routeOf(url, prefix) {
  const pathname = new URL(url, 'http://localhost').pathname;
  const hit = pathname === prefix || pathname.startsWith(`${prefix}/`);
  return { hit, route: hit ? pathname.slice(prefix.length) : undefined };
}

/* --- tests ---------------------------------------------------------------- */

const dir = join(tmpdir(), `agency-panel-test-${Date.now()}`);
await mkdir(dir, { recursive: true });

const src = String.raw`---
name: agency-frontend-developer
description: Expert frontend developer specializing in React.
color: cyan
---

# Frontend Developer Agent Personality

Body line one.
Body line two.
`;

const file = join(dir, 'SKILL.md');
await writeFile(file, src, 'utf8');

const results = [];
const check = (label, ok, detail) => {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

// 1. disable inserts the flag without touching anything else
await setFrontmatterFlag(file, true);
let text = await readFile(file, 'utf8');
check('disable adds the flag', text.includes(`${FLAG}: true`));
check('disable keeps the body', text.includes('Body line one.\nBody line two.'));
check('disable keeps other keys', text.includes('color: cyan') && text.includes('description: Expert frontend'));
check('disable leaves exactly two fences', text.split('\n').filter((l) => l === '---').length === 2);

// 2. idempotent
const before = text;
await setFrontmatterFlag(file, true);
check('disable is idempotent', (await readFile(file, 'utf8')) === before);

// 3. enable flips to false (keeps a stable line to find later)
await setFrontmatterFlag(file, false);
text = await readFile(file, 'utf8');
check('enable flips to false', text.includes(`${FLAG}: false`));
check('enable keeps the body', text.includes('Body line one.'));

// 4. re-disable works after enable
await setFrontmatterFlag(file, true);
check('re-disable after enable', (await readFile(file, 'utf8')).includes(`${FLAG}: true`));

// 5. a file without frontmatter is refused, not corrupted
const plain = join(dir, 'plain.md');
await writeFile(plain, '# no frontmatter\n', 'utf8');
check('file without frontmatter is refused', (await setFrontmatterFlag(plain, true)) === undefined);
check('refused file is untouched', (await readFile(plain, 'utf8')) === '# no frontmatter\n');

// 6. CRLF files stay CRLF
const crlf = join(dir, 'crlf.md');
await writeFile(crlf, src.split('\n').join('\r\n'), 'utf8');
await setFrontmatterFlag(crlf, true);
let crlfOut = await readFile(crlf, 'utf8');
check('CRLF file stays CRLF', !/[^\r]\n/.test(crlfOut));
check('CRLF file got the flag', crlfOut.includes(`${FLAG}: true`));
await setFrontmatterFlag(crlf, false);
crlfOut = await readFile(crlf, 'utf8');
check('CRLF enable also stays CRLF', !/[^\r]\n/.test(crlfOut) && crlfOut.includes(`${FLAG}: false`));

// 7. route parsing — the trailing slash was the bug that shipped a 404
check('route: /state', routeOf(`${API_BASE}/state`, API_BASE).route === '/state');
check('route: /toggle', routeOf(`${API_BASE}/toggle`, API_BASE).route === '/toggle');
check('route: /bulk', routeOf(`${API_BASE}/bulk`, API_BASE).route === '/bulk');
check('route: bare base', routeOf(API_BASE, API_BASE).route === '');
check('route: sibling does not match', routeOf('/agency-skill-panel/apix', API_BASE).hit === false);
check(
  'regression: trailing-slash prefix never matched',
  routeOf(`${API_BASE}/state`, `${API_BASE}/`).hit === false,
);

await rm(dir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exitCode = 1;
