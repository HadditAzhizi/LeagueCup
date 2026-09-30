-- LeagueCup schema. Jalankan sekali di Supabase → SQL Editor.
-- Setiap liga/cup disimpan utuh sebagai satu baris JSONB.

create table if not exists public.leagues (
  id uuid primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cups (
  id uuid primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS aktif tanpa policy: hanya backend (service role key) yang bisa
-- membaca/menulis. Anon key dari browser tidak punya akses.
alter table public.leagues enable row level security;
alter table public.cups enable row level security;
