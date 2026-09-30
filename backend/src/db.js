import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

/**
 * Storage backend. Uses Supabase when SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are set, otherwise a local JSON file.
 *
 * Both expose the same shape: { leagues: [...], cups: [...] }, where each
 * league/cup is stored whole (one JSON file entry or one JSONB row).
 */

const TABLES = ['leagues', 'cups'];

// ---------- JSON file ----------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function fileStore() {
  let cache = null;

  return {
    name: `file JSON (${DB_FILE})`,
    async load() {
      if (cache) return cache;
      try {
        cache = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        cache = {};
      }
      for (const t of TABLES) cache[t] ??= [];
      return cache;
    },
    async save(_before, after) {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${DB_FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(after, null, 2));
      await fs.rename(tmp, DB_FILE);
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
    throw new Error(`Supabase: ${error.message}${hint}`);
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

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const store = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? supabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : fileStore();

export const storageName = store.name;

export async function read() {
  return store.load();
}

// Serialize writes so concurrent requests can't interleave and lose data.
let queue = Promise.resolve();

/**
 * Run `fn(data)` exclusively on a copy, then save. If `fn` throws, nothing
 * is changed. Returns whatever `fn` returns.
 */
export function write(fn) {
  const run = queue.then(async () => {
    const before = await store.load();
    const draft = structuredClone(before);
    const result = await fn(draft);
    await store.save(before, draft);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}
