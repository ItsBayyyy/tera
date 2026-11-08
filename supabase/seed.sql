-- LOCAL DEVELOPMENT ONLY. `supabase db reset` runs this file; it is never applied to the cloud project.
-- Test accounts for the local stack and the Playwright e2e suite:
--   petugas@tera.test / petugas-lokal-123  (officer)
--   admin@tera.test   / admin-lokal-123    (admin)

do $$
declare
  officer_id uuid := '00000000-0000-4000-8000-000000000001';
  admin_id uuid := '00000000-0000-4000-8000-000000000002';
  first_banjar uuid := (select id from public.banjars where is_sample order by name limit 1);
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', officer_id, 'authenticated', 'authenticated',
     'petugas@tera.test', extensions.crypt('petugas-lokal-123', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Petugas Lokal"}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
     'admin@tera.test', extensions.crypt('admin-lokal-123', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Lokal"}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), officer_id, officer_id::text,
     jsonb_build_object('sub', officer_id::text, 'email', 'petugas@tera.test'), 'email', now(), now(), now()),
    (gen_random_uuid(), admin_id, admin_id::text,
     jsonb_build_object('sub', admin_id::text, 'email', 'admin@tera.test'), 'email', now(), now(), now());

  update public.profiles set role = 'admin' where user_id = admin_id;
  update public.profiles set default_banjar_id = first_banjar where user_id in (officer_id, admin_id);
end;
$$;
