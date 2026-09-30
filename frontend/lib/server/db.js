import { createClient } from '@supabase/supabase-js';

/**
 * Storage backend. Uses Supabase when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set; otherwise, for local development
 * only, a JSON file at data/db.json.
 *
 * Both expose the same shape: { leagues: [...], cups: [...] }, where each
 * league/cup is stored whole (one JSON file entry or one JSONB row).
 */

const TABLES = ['leagues', 'cups'];

/** Storage problems (misconfiguration, Supabase down) are shown to the user as-is. */
class StorageError extends Error {
  status = 503;
  expose = true;
}

// ---------- JSON file (local dev) ----------

function fileStore() {
  let cache = null;
  const paths = async () => {
    const path = await import('node:path');
    const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    return { dir, file: path.join(dir, 'db.json') };
  };

  return {
    name: 'file JSON (data/db.json)',
    async load() {
      if (cache) return cache;
      const fs = await import('node:fs/promises');
      const { file } = await paths();
      try {
        cache = JSON.parse(await fs.readFile(file, 'utf8'));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        cache = {};
      }
      for (const t of TABLES) cache[t] ??= [];
      return cache;
    },
    async save(_before, after) {
      const fs = await import('node:fs/promises');
      const { dir, file } = await paths();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(`${file}.tmp`, JSON.stringify(after, null, 2));
      await fs.rename(`${file}.tmp`, file);
      cache = after;
    },
  };
}

// ---------- Supabase ----------

function supabaseStore(url, key) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const check = (error, table) => {
    if (!error) return;
    const hint = error.code === '42P01' || error.code === 'PGRST205'
      ? ` — tabel "${table}" belum ada, jalankan supabase/schema.sql`
      : '';
    throw new StorageError(`Supabase: ${error.message}${hint}`);
  };

  return {
    name: `Supabase (${new URL(url).host})`,
    // Always read fresh so edits made in the Supabase dashboard show up.
    async load() {
      const data = {};
      await Promise.all(
        TABLES.map(async (t) => {
          const { data: rows, error } = await sb.from(t).select('data').order('created_at');
          check(error, t);
          data[t] = rows.map((r) => r.data);
        }),
      );
      return data;
    },
    // Only send rows that were added, changed or removed.
    async save(before, after) {
      for (const t of TABLES) {
        const old = new Map(before[t].map((x) => [x.id, JSON.stringify(x)]));
        const changed = after[t].filter((x) => old.get(x.id) !== JSON.stringify(x));
        const keep = new Set(after[t].map((x) => x.id));
        const removed = [...old.keys()].filter((id) => !keep.has(id));

        if (changed.length) {
          const rows = changed.map((x) => ({
            id: x.id,
            data: x,
            created_at: x.createdAt,
            updated_at: x.updatedAt ?? new Date().toISOString(),
          }));
          const { error } = await sb.from(t).upsert(rows);
          check(error, t);
        }
        if (removed.length) {
          const { error } = await sb.from(t).delete().in('id', removed);
          check(error, t);
        }
      }
    },
  };
}

// Env vars are read lazily: on Cloudflare they're only available per request.
let store = null;
function getStore() {
  if (store) return store;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    store = supabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  } else if (globalThis.navigator?.userAgent === 'Cloudflare-Workers') {
    throw new StorageError('Supabase belum dikonfigurasi: set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Cloudflare (Settings → Variables and Secrets)');
  } else {
    store = fileStore();
  }
  return store;
}

export function storageName() {
  return getStore().name;
}

export async function read() {
  return getStore().load();
}

// Serialize writes so concurrent requests can't interleave and lose data.
let queue = Promise.resolve();

/**
 * Run `fn(data)` exclusively on a copy, then save. If `fn` throws, nothing
 * is changed. Returns whatever `fn` returns.
 */
export function write(fn) {
  const run = queue.then(async () => {
    const s = getStore();
    const before = await s.load();
    const draft = structuredClone(before);
    const result = await fn(draft);
    await s.save(before, draft);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}
