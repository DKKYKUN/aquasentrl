-- Jalankan SEKALI di Supabase → SQL Editor. Aman dijalankan ulang.
-- Login admin Aqua Sentinel. Sandi disimpan ter-hash (bcrypt), tabel TIDAK bisa dibaca langsung dari browser;
-- Sesi berlaku tanpa batas waktu sampai logout atau akun dihapus.
-- Jalankan di proyek khusus LOGIN, bukan proyek pengaturan. Akun yang ada tetap dipertahankan.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;
alter table public.admins enable row level security;

create table if not exists public.admin_sessions (
  token text primary key,
  admin_id uuid not null references public.admins(id) on delete cascade,
  expires_at timestamptz not null default 'infinity'::timestamptz
);
revoke all on public.admin_sessions from anon, authenticated;
grant all on public.admin_sessions to service_role;
alter table public.admin_sessions enable row level security;
alter table public.admin_sessions alter column expires_at set default 'infinity'::timestamptz;
update public.admin_sessions set expires_at = 'infinity'::timestamptz;

create or replace function public.admin_login(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare a public.admins; t text;
begin
  select * into a from public.admins where lower(username) = lower(trim(p_username));
  if a.id is null or a.password_hash <> crypt(p_password, a.password_hash) then
    return json_build_object('ok', false, 'message', 'Username atau sandi salah.');
  end if;
  delete from public.admin_sessions where expires_at < now();
  t := encode(gen_random_bytes(32), 'hex');
  insert into public.admin_sessions(token, admin_id, expires_at) values (t, a.id, 'infinity'::timestamptz);
  return json_build_object('ok', true, 'token', t, 'username', a.username);
end $$;

create or replace function public.admin_check(p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare u text;
begin
  select a.username into u from public.admin_sessions s join public.admins a on a.id = s.admin_id
  where s.token = p_token and s.expires_at > now();
  if u is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'username', u);
end $$;

create or replace function public.admin_add(p_token text, p_username text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.admin_sessions where token = p_token and expires_at > now()) then
    return json_build_object('ok', false, 'message', 'Sesi habis, silakan login ulang.');
  end if;
  if length(trim(p_username)) < 3 or length(p_password) < 6 then
    return json_build_object('ok', false, 'message', 'Username minimal 3 huruf dan sandi minimal 6 karakter.');
  end if;
  if exists (select 1 from public.admins where lower(username) = lower(trim(p_username))) then
    return json_build_object('ok', false, 'message', 'Username sudah dipakai.');
  end if;
  insert into public.admins(username, password_hash) values (trim(p_username), crypt(p_password, gen_salt('bf')));
  return json_build_object('ok', true, 'message', 'Admin baru ditambahkan.');
end $$;

create or replace function public.admin_list(p_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_sessions where token = p_token and expires_at > now()) then
    return json_build_object('ok', false, 'admins', '[]'::json);
  end if;
  return json_build_object('ok', true, 'admins',
    coalesce((select json_agg(json_build_object('username', username, 'created_at', created_at) order by created_at) from public.admins), '[]'::json));
end $$;

create or replace function public.admin_logout(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.admin_sessions where token = p_token;
$$;

create or replace function public.admin_delete(p_token text, p_username text)
returns json language plpgsql security definer set search_path = public as $$
declare caller_id uuid; target_id uuid;
begin
  -- Serialize admin deletions to avoid concurrent removals.
  lock table public.admins in share row exclusive mode;
  select admin_id into caller_id from public.admin_sessions
    where token = p_token and expires_at > now();
  if caller_id is null then
    return json_build_object('ok', false, 'message', 'Sesi tidak valid, silakan login ulang.');
  end if;
  select id into target_id from public.admins where lower(username) = lower(trim(p_username));
  if target_id is null then
    return json_build_object('ok', false, 'message', 'Admin tidak ditemukan.');
  end if;
  if target_id = caller_id then
    return json_build_object('ok', false, 'message', 'Akun yang sedang dipakai tidak dapat dihapus.');
  end if;
  delete from public.admins where id = target_id;
  return json_build_object('ok', true, 'message', 'Admin dihapus.');
end $$;

revoke all on function public.admin_login(text, text), public.admin_check(text), public.admin_add(text, text, text),
  public.admin_list(text), public.admin_logout(text), public.admin_delete(text, text) from public;
grant execute on function public.admin_login(text, text), public.admin_check(text), public.admin_add(text, text, text),
  public.admin_list(text), public.admin_logout(text), public.admin_delete(text, text) to anon, authenticated;
