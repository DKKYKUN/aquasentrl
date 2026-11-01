-- Jalankan SEKALI di Supabase → SQL Editor. Aman dijalankan ulang.
-- Menyimpan pengaturan Aqua Sentinel (ambang batas pH/TDS/suhu, interval) dari halaman Pengaturan.
-- Web memakai anon key (src/lib/aqua/config.ts), jadi anon diberi izin baca & tulis HANYA pada tabel ini.

create table if not exists public.app_settings (
  id text primary key default 'default',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings read" on public.app_settings;
drop policy if exists "app_settings insert" on public.app_settings;
drop policy if exists "app_settings update" on public.app_settings;

create policy "app_settings read"   on public.app_settings for select to anon, authenticated using (true);
create policy "app_settings insert" on public.app_settings for insert to anon, authenticated with check (id = 'default');
create policy "app_settings update" on public.app_settings for update to anon, authenticated using (id = 'default') with check (id = 'default');
-- Tidak ada policy delete: baris tidak bisa dihapus dari browser.
