-- Row Level Security. Staff (officer/admin) work on operational data; anon has no table access.
-- Citizen reports and the demo mode go through server route handlers using the service role.

create function public.current_app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = auth.uid());
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;

revoke execute on function public.current_app_role() from anon;
revoke execute on function public.is_staff() from anon;
revoke execute on function public.is_admin() from anon;

alter table public.banjars enable row level security;
alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.dog_photos enable row level security;
alter table public.vaccinations enable row level security;
alter table public.match_logs enable row level security;
alter table public.bite_reports enable row level security;
alter table public.facilities enable row level security;
alter table public.app_config enable row level security;
alter table public.duplicate_flags enable row level security;

revoke all on all tables in schema public from anon;

-- banjars
create policy banjars_staff_read on public.banjars for select to authenticated using (public.is_staff());
create policy banjars_admin_write on public.banjars for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: everyone reads their own row; admins read and manage all.
create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and role = public.current_app_role());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- dogs, photos, vaccinations: staff read/write, admins delete.
create policy dogs_staff_read on public.dogs for select to authenticated using (public.is_staff());
create policy dogs_staff_insert on public.dogs for insert to authenticated with check (public.is_staff());
create policy dogs_staff_update on public.dogs for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy dogs_admin_delete on public.dogs for delete to authenticated using (public.is_admin());

create policy dog_photos_staff_read on public.dog_photos for select to authenticated using (public.is_staff());
create policy dog_photos_staff_insert on public.dog_photos for insert to authenticated with check (public.is_staff());
create policy dog_photos_staff_update on public.dog_photos for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy dog_photos_admin_delete on public.dog_photos for delete to authenticated using (public.is_admin());

create policy vaccinations_staff_read on public.vaccinations for select to authenticated using (public.is_staff());
create policy vaccinations_staff_insert on public.vaccinations for insert to authenticated
  with check (public.is_staff() and officer_id = auth.uid());
create policy vaccinations_staff_update on public.vaccinations for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- match logs are append-only audit records.
create policy match_logs_staff_read on public.match_logs for select to authenticated using (public.is_staff());
create policy match_logs_staff_insert on public.match_logs for insert to authenticated
  with check (public.is_staff() and actor_id = auth.uid());
create policy match_logs_staff_choose on public.match_logs for update to authenticated
  using (public.is_staff() and actor_id = auth.uid()) with check (public.is_staff() and actor_id = auth.uid());

-- bite reports: inserted by the server (service role), handled by staff.
create policy bite_reports_staff_read on public.bite_reports for select to authenticated using (public.is_staff());
create policy bite_reports_staff_update on public.bite_reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy facilities_staff_read on public.facilities for select to authenticated using (public.is_staff());
create policy facilities_admin_write on public.facilities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy app_config_staff_read on public.app_config for select to authenticated using (public.is_staff());
create policy app_config_admin_update on public.app_config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy duplicate_flags_staff_read on public.duplicate_flags for select to authenticated using (public.is_staff());
create policy duplicate_flags_staff_update on public.duplicate_flags for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Private storage buckets; files are served to staff through signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dog-photos', 'dog-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy storage_staff_read on storage.objects for select to authenticated
  using (bucket_id in ('dog-photos', 'report-photos') and public.is_staff());
create policy storage_staff_upload_dogs on storage.objects for insert to authenticated
  with check (bucket_id = 'dog-photos' and public.is_staff());

-- Officers watch the case queue live.
alter publication supabase_realtime add table public.bite_reports;
