-- Isi sandi langsung di SQL Editor sebelum menjalankan; jangan bagikan berkas berisi sandi.
do $$
declare initial_password text := 'ISI_SANDI_ANDA_DI_SINI';
begin
  if initial_password = 'ISI_SANDI_ANDA_DI_SINI' or length(initial_password) < 6 then
    raise exception 'Isi sandi admin pertama di SQL Editor (minimal 6 karakter).';
  end if;
  insert into public.admins (username, password_hash)
  values ('DKKY', extensions.crypt(initial_password, extensions.gen_salt('bf')))
  on conflict (username) do update set password_hash = excluded.password_hash;
  -- Cabut sesi lama akun ini saat sandinya diganti.
  delete from public.admin_sessions where admin_id = (select id from public.admins where username = 'DKKY');
end $$;