// Salin data dari data/db.json ke Supabase. Aman dijalankan ulang (upsert).
// Pakai (dari folder frontend): npm run migrate
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di frontend/.env.local terlebih dahulu.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'db.json')
  : path.join(__dirname, '..', 'data', 'db.json');

const data = JSON.parse(await fs.readFile(file, 'utf8'));
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const table of ['leagues', 'cups']) {
  const items = data[table] ?? [];
  if (!items.length) {
    console.log(`${table}: kosong, dilewati`);
    continue;
  }
  const rows = items.map((x) => ({ id: x.id, data: x, created_at: x.createdAt, updated_at: x.updatedAt ?? x.createdAt }));
  const { error } = await sb.from(table).upsert(rows);
  if (error) {
    console.error(`${table}: gagal — ${error.message}`);
    process.exit(1);
  }
  console.log(`${table}: ${rows.length} data disalin (${items.map((x) => x.name).join(', ')})`);
}
console.log('Selesai.');
