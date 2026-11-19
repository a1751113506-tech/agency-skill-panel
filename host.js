/**
 * Host half of the Agency Skill Panel.
 *
 * One job: expose the agency-* skill inventory plus a persisted on/off switch,
 * and apply that switch to the skill files themselves.
 *
 * The switch mechanism is the Harness's own: `dsh-tool-skill` builds the injected
 * catalog from `snapshot.skills.filter(isModelInvocable)`, and the filesystem
 * skill provider maps a frontmatter `disable-model-invocation: true` to
 * `modelInvocable: false`. So flipping that one frontmatter line is what actually
 * removes a skill from the catalog (and its tokens from every prompt). The panel
 * never touches the catalog itself.
 *
 * Two layers, on purpose:
 *   - `state.json` inside the plugin data dir is the durable intent. It survives
 *     reinstalling the skills from the upstream repo.
 *   - the skill file frontmatter is the live effect. The skill watcher sees the
 *     write, invalidates the provider cache, and the next step re-renders the
 *     catalog without the skill.
 * On activation the stored intent is re-applied, so a `convert.sh`/`install.sh`
 * run that overwrites frontmatter cannot silently re-enable everything.
 */
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'agency-skill-panel');
const STATE_FILE = join(STATE_DIR, 'state.json');
const API_BASE = '/agency-skill-panel/api';
const PREFIX = 'agency-';
/** Frontmatter key the filesystem skill provider reads. */
const FLAG = 'disable-model-invocation';

export const name = 'agency-skill-panel';
// Hard-required services only. `skills` is deliberately NOT listed: this
// profile ships with `skill-filesystem` and `tool-skill` inactive, so the
// `skills` service often does not exist at all — requiring it would leave this
// plugin permanently pending, and `apply` would never run, which surfaces to the
// user as "HTTP 404" in the panel. The panel scans the skill files directly, so
// it does not need that service (see scanRoots).
export const inject = [];

let catalogCache;

async function loadCatalog() {
  if (catalogCache !== undefined) return catalogCache;
  try {
    const raw = await readFile(join(HERE, 'catalog.zh.json'), 'utf8');
    catalogCache = JSON.parse(raw);
  } catch {
    catalogCache = { divisions: {}, skills: {} };
  }
  return catalogCache;
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(STATE_FILE, 'utf8'));
    return { disabled: Array.isArray(parsed.disabled) ? parsed.disabled.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { disabled: [] };
  }
}

async function writeState(state) {
  await mkdir(STATE_DIR, { recursive: true });
  const sorted = [...new Set(state.disabled)].sort();
  await writeFile(STATE_FILE, `${JSON.stringify({ disabled: sorted }, null, 2)}\n`, 'utf8');
  return { disabled: sorted };
}

/** Rewrite one skill file's frontmatter flag. Returns the resulting disabled flag. */
async function setFrontmatterFlag(filePath, disabled) {
  const text = await readFile(filePath, 'utf8');
  // Preserve the file's own line ending. Skill files are normally LF, but a
  // CRLF file spliced with '\n' would end up with mixed endings that some
  // editors and diff tools then rewrite wholesale.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines[0] !== '---') return undefined;
  const close = lines.indexOf('---', 1);
  if (close < 0) return undefined;

  const head = lines.slice(1, close);
  const at = head.findIndex((line) => line.startsWith(`${FLAG}:`));
  const next = `${FLAG}: ${disabled ? 'true' : 'false'}`;

  if (at >= 0) {
    // Already in the requested state: skip the write, keep the watcher quiet.
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

/**
 * Read the agency skills straight off disk.
 *
 * `ctx.skills.list({})` returned nothing from this plugin's scope even while the
 * catalog was full of agency skills, so the panel does not depend on that
 * service at all: it scans the same roots the filesystem skill provider scans
 * (`~/.dsh/skills` and `~/.agents/skills`) and reads each `SKILL.md` itself.
 * That keeps the panel correct in any scope and removes a whole failure mode.
 */
async function scanRoots() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  const roots = [join(home, 'skills'), join(homedir(), '.agents', 'skills')];
  const found = new Map();

  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(PREFIX)) continue;
      const file = join(root, entry.name, 'SKILL.md');
      const parsed = await readSkillFile(file);
      if (parsed === undefined) continue;
      // Later roots must not shadow an earlier hit: `~/.dsh/skills` wins.
      if (!found.has(entry.name)) found.set(entry.name, { ...parsed, file, slug: entry.name });
    }
  }
  return [...found.values()];
}

/** Parse one SKILL.md's frontmatter, or undefined when it is not a skill file. */
async function readSkillFile(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
  if (!text.startsWith('---')) return undefined;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  const close = lines.indexOf('---', 1);
  if (close < 0) return undefined;
  const head = lines.slice(1, close);

  const field = (key) => {
    const line = head.find((l) => l.startsWith(`${key}:`));
    if (line === undefined) return undefined;
    return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
  };

  const description = field('description');
  if (description === undefined) return undefined;
  const flag = field(FLAG);
  return {
    description,
    disabled: flag !== undefined && /^(true|1|yes|on)$/i.test(flag),
  };
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}


async function buildSnapshot(ctx) {
  const [catalog, state, listing] = await Promise.all([loadCatalog(), readState(), scanRoots()]);
  const disabledSet = new Set(state.disabled);
  const divisions = new Map();
  const skills = [];

  for (const entry of listing) {
    const slug = entry.slug;
    const zh = catalog.skills?.[slug];
    const division = catalog.divisionOf?.[slug] ?? 'specialized';
    if (!divisions.has(division)) divisions.set(division, 0);
    divisions.set(division, divisions.get(division) + 1);
    skills.push({
      slug,
      file: entry.file,
      division,
      divisionLabel: catalog.divisions?.[division] ?? division,
      label: zh?.[0] ?? slug.slice(PREFIX.length).replace(/-/g, ' '),
      desc: zh?.[1] ?? entry.description,
      enDesc: entry.description,
      // The frontmatter flag is the live truth: it is what removes the skill
      // from the catalog. The stored intent only covers files that were
      // reinstalled since the last toggle.
      disabled: entry.disabled || disabledSet.has(slug),
    });
  }

  skills.sort((a, b) => a.division.localeCompare(b.division) || a.label.localeCompare(b.label, 'zh'));
  return {
    stateFile: STATE_FILE,
    total: skills.length,
    disabled: skills.filter((s) => s.disabled).length,
    divisions: [...divisions.entries()]
      .map(([key, count]) => ({ key, label: catalog.divisions?.[key] ?? key, count }))
      .sort((a, b) => b.count - a.count),
    skills,
  };
}

/** Apply the stored intent to the skill files, in both directions. */
async function syncFiles(ctx) {
  const [state, listing] = await Promise.all([readState(), scanRoots()]);
  const disabledSet = new Set(state.disabled);
  const applied = [];
  const missing = [];

  for (const entry of listing) {
    if (!(await exists(entry.file))) {
      if (disabledSet.has(entry.slug)) missing.push(entry.slug);
      continue;
    }
    const wantDisabled = disabledSet.has(entry.slug);
    try {
      await setFrontmatterFlag(entry.file, wantDisabled);
      applied.push(entry.slug);
    } catch {
      missing.push(entry.slug);
    }
  }
  void ctx;
  return { applied: applied.length, missing };
}

export function apply(ctx) {

  // Re-apply the stored intent once at activation so an upstream reinstall
  // cannot quietly turn every disabled skill back on.
  ctx.effect(() => {
    const timer = setTimeout(() => {
      syncFiles(ctx).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, 'agency-skill-panel: initial sync');

  // Mount the API without depending on Cordis inject timing.
  //
  // `desktop-webserver` is mounted by the desktop shell, not listed in the
  // profile bundle array, so it can become available slightly after this
  // plugin applies. `ctx.inject([...])` gives no retry: if the service is
  // missing at that instant the callback never runs and the panel answers
  // HTTP 404 for the whole session — exactly the reported symptom. Polling
  // for the service turns that race into a bounded wait.
  const mountApi = () => {
    const webServer = ctx.get('webServer');
    const connection = ctx.get('connection');
    if (webServer === undefined || connection === undefined) return false;

    const sendJson = (res, status, body) => {
      const text = JSON.stringify(body);
      res.statusCode = status;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(text);
    };
    const readBody = async (req) => {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1_000_000) throw new Error('request body too large');
        chunks.push(chunk);
      }
      if (chunks.length === 0) return {};
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    };

    ctx.effect(() => webServer.register({
      kind: 'prefix',
      // No trailing slash: the dispatcher matches `pathname === prefix` or
      // `pathname.startsWith(prefix + '/')`, so a trailing slash would only
      // ever match a doubled separator.
      path: API_BASE,
      handler: async (req, res) => {
        const rejection = connection.requestRejection(req);
        if (rejection !== undefined) {
          sendJson(res, rejection, { ok: false, error: `rejected: ${rejection}` });
          return;
        }
        const route = new URL(String(req.url), 'http://localhost').pathname.slice(API_BASE.length);

        try {
          if (route === '/state' && req.method === 'GET') {
            sendJson(res, 200, await buildSnapshot(ctx));
            return;
          }

          if (route === '/toggle' && req.method === 'POST') {
            const body = await readBody(req);
            const slug = typeof body.slug === 'string' ? body.slug : '';
            if (!slug.startsWith(PREFIX) || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
              sendJson(res, 400, { ok: false, error: 'slug must be a plain agency-* skill name' });
              return;
            }
            const entry = (await scanRoots()).find((row) => row.slug === slug);
            if (entry === undefined) {
              sendJson(res, 404, { ok: false, error: `no such skill: ${slug}` });
              return;
            }
            if (!(await exists(entry.file))) {
              sendJson(res, 409, { ok: false, error: `skill file not found for ${slug}` });
              return;
            }
            const wanted = body.disabled === true;
            const state = await readState();
            const set = new Set(state.disabled);
            if (wanted) set.add(slug);
            else set.delete(slug);
            // Write intent first, then the file: a crash between the two leaves
            // the intent intact and the next activation re-applies it.
            await writeState({ disabled: [...set] });
            await setFrontmatterFlag(entry.file, wanted);
            sendJson(res, 200, { ok: true, slug, disabled: wanted, file: entry.file, ...(await buildSnapshot(ctx)) });
            return;
          }

          if (route === '/bulk' && req.method === 'POST') {
            const body = await readBody(req);
            const wanted = body.disabled === true;
            const targets = Array.isArray(body.slugs)
              ? body.slugs.filter((s) => typeof s === 'string' && s.startsWith(PREFIX) && !s.includes('/') && !s.includes('\\') && !s.includes('..'))
              : [];
            const state = await readState();
            const set = new Set(state.disabled);
            for (const slug of targets) {
              if (wanted) set.add(slug);
              else set.delete(slug);
            }
            await writeState({ disabled: [...set] });
            const byslug = new Map((await scanRoots()).map((entry) => [entry.slug, entry]));
            const failures = [];
            for (const slug of targets) {
              const entry = byslug.get(slug);
              if (entry === undefined || !(await exists(entry.file))) {
                failures.push(slug);
                continue;
              }
              try {
                await setFrontmatterFlag(entry.file, wanted);
              } catch {
                failures.push(slug);
              }
            }
            sendJson(res, 200, { ok: failures.length === 0, changed: targets.length - failures.length, failures, ...(await buildSnapshot(ctx)) });
            return;
          }

          if (route === '/sync' && req.method === 'POST') {
            sendJson(res, 200, { ok: true, ...(await syncFiles(ctx)), ...(await buildSnapshot(ctx)) });
            return;
          }

          sendJson(res, 404, { ok: false, error: `unknown route: ${route}` });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      },
    }), 'agency-skill-panel: api routes');
    return true;
  };

  if (!mountApi()) {
    // Retry until the Web carrier and Connection appear, then give up quietly:
    // without them the panel has nothing to talk to, and the client half will
    // surface its own error instead of a bare 404.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (mountApi() || tries > 100) clearInterval(timer);
    }, 100);
    ctx.effect(() => () => clearInterval(timer), 'agency-skill-panel: api mount retry');
  }
}
