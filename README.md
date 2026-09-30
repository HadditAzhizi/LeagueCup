# ⚽ LeagueCup

Sistem manajemen kompetisi sepak bola — **Liga** (round-robin) dan **Cup** (knockout).

- **Frontend**: Next.js 16 (App Router) — `frontend/` — port 3000
- **Backend**: Node.js + Express REST API — `backend/` — port 4000
- **Penyimpanan**: Supabase (Postgres) bila dikonfigurasi, selain itu file JSON `backend/data/db.json`

## Menjalankan

```bash
npm run install:all   # install dependensi root, backend, frontend
npm run dev           # jalankan API + web sekaligus
```

Buka http://localhost:3000.

Atau terpisah: `npm run dev --prefix backend` dan `npm run dev --prefix frontend`.

> Frontend memakai `--webpack` karena di Windows dengan Smart App Control / Application
> Control, binary native SWC diblokir sehingga Turbopack tidak bisa jalan.

### Memakai Supabase

1. Buat project di https://supabase.com, buka **SQL Editor**, jalankan isi `supabase/schema.sql`.
2. Isi `backend/.env` (lihat `backend/.env.example`):
   `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. (Opsional) salin data lama: `npm run migrate --prefix backend`.
4. Restart backend. Cek: `http://localhost:4000/api/health` → `"storage": "Supabase (...)"`.

Tanpa `.env` backend otomatis kembali memakai file JSON.

### Share ke publik (tetap jalan di lokal) via ngrok

```bash
ngrok config add-authtoken <TOKEN>   # sekali saja
npm run build                        # build frontend production
npm start                            # jalankan API + web (production)
npm run share                        # ngrok http 3000 → dapat URL publik
```

Alternatif tanpa halaman peringatan ngrok (gratis, tanpa akun): `npm run share:cf`
(butuh `cloudflared`, URL `*.trycloudflare.com` berganti tiap dijalankan).

Hanya port 3000 yang perlu dibuka: Next.js meneruskan `/api/*` ke backend (port 4000).
Siapa pun yang punya URL bisa mengubah/menghapus data — bagikan dengan hati-hati.

### Konfigurasi
| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` (backend) | `4000` | Port API |
| `DATA_DIR` (backend) | `backend/data` | Lokasi `db.json` |
| `CORS_ORIGIN` (backend) | semua | Origin yang diizinkan |
| `API_ORIGIN` (frontend) | `http://localhost:4000` | Tujuan proxy `/api` |
| `NEXT_PUBLIC_API_URL` (frontend) | kosong (same-origin) | Opsional: panggil API langsung |

## Fitur

**Liga**
- Jadwal otomatis metode round-robin (1 atau 2 putaran kandang–tandang); jumlah tim ganjil → satu tim libur tiap pekan
- Poin menang/seri/kalah bisa diatur
- Input / hapus skor per pekan, klasemen otomatis (poin → selisih gol → gol → menang) + 5 laga terakhir

**Cup**
- Bagan gugur otomatis, jumlah tim bebas (bye disebar merata bila bukan pangkat 2)
- Undian acak opsional
- Skor imbang → adu penalti; pemenang otomatis maju ke babak berikutnya
- Mengubah hasil babak awal mereset laga lanjutan yang terdampak
- Menampilkan juara

Keduanya bisa diubah nama/musim dan dihapus.

## REST API

| Method | Endpoint | Body |
|---|---|---|
| GET | `/api/leagues` | — |
| POST | `/api/leagues` | `{ name, season, teams: string[], doubleRoundRobin, shuffleTeams, settings: { pointsWin, pointsDraw, pointsLoss } }` |
| GET | `/api/leagues/:id` | — (termasuk `standings`) |
| PUT | `/api/leagues/:id` | `{ name?, season? }` |
| DELETE | `/api/leagues/:id` | — |
| PUT | `/api/leagues/:id/matches/:matchId` | `{ homeScore, awayScore }` (`null` = hapus hasil) |
| GET | `/api/cups` | — |
| POST | `/api/cups` | `{ name, season, teams: string[], shuffleTeams }` |
| GET | `/api/cups/:id` | — (termasuk `championId`) |
| PUT | `/api/cups/:id` | `{ name?, season? }` |
| DELETE | `/api/cups/:id` | — |
| PUT | `/api/cups/:id/matches/:matchId` | `{ homeScore, awayScore, homePens?, awayPens? }` |
