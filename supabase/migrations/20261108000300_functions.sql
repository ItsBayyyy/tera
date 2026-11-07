-- Matching and reporting functions. All are SECURITY INVOKER so RLS still applies to callers.

-- Cosine similarity against every embedded photo in the banjar, best score per dog, top-k dogs.
-- An exact scan is used on purpose: banjar-sized galleries are small, and an approximate
-- HNSW scan combined with a banjar filter can silently drop the true match.
-- p_banjar_id = null searches every non-demo banjar (citizen reports often lack a banjar).
create function public.match_dogs(query extensions.halfvec(2152), p_banjar_id uuid, p_k int default 5)
returns table (
  dog_id uuid,
  best_score real,
  best_photo_path text,
  banjar_id uuid,
  nickname text,
  color text,
  sex public.dog_sex,
  ownership public.dog_ownership,
  last_vaccinated_at timestamptz,
  last_ai_status public.ai_status
)
language sql stable security invoker set search_path = '' as $$
  with scored as (
    select
      p.dog_id,
      p.storage_path,
      (1 - (p.embedding operator(extensions.<=>) query))::real as score
    from public.dog_photos p
    join public.dogs d on d.id = p.dog_id
    join public.banjars b on b.id = d.banjar_id
    where p.embedding is not null
      and case when p_banjar_id is null then not b.is_demo else d.banjar_id = p_banjar_id end
  ),
  best as (
    select distinct on (s.dog_id) s.dog_id, s.storage_path, s.score
    from scored s
    order by s.dog_id, s.score desc
  )
  select
    best.dog_id,
    best.score,
    best.storage_path,
    d.banjar_id,
    d.nickname,
    d.color,
    d.sex,
    d.ownership,
    lv.vaccinated_at,
    lv.ai_status
  from best
  join public.dogs d on d.id = best.dog_id
  left join lateral (
    select v.vaccinated_at, v.ai_status
    from public.vaccinations v
    where v.dog_id = best.dog_id
    order by v.vaccinated_at desc
    limit 1
  ) lv on true
  order by best.score desc
  limit greatest(least(p_k, 20), 1);
$$;

revoke execute on function public.match_dogs(extensions.halfvec, uuid, int) from public, anon;
grant execute on function public.match_dogs(extensions.halfvec, uuid, int) to authenticated, service_role;

-- Coverage per banjar for the admin dashboard. "Vaccinated" = a vaccination within the active period.
create function public.banjar_coverage()
returns table (
  banjar_id uuid,
  name text,
  village text,
  district text,
  regency text,
  is_sample boolean,
  dogs_registered bigint,
  dogs_vaccinated_active bigint,
  bite_reports bigint
)
language sql stable security invoker set search_path = '' as $$
  with period as (
    select coalesce(
      (select (value #>> '{}')::int from public.app_config where key = 'vaccine_valid_days'),
      365
    ) as days
  )
  select
    b.id,
    b.name,
    b.village,
    b.district,
    b.regency,
    b.is_sample,
    (select count(*) from public.dogs d where d.banjar_id = b.id),
    (select count(distinct v.dog_id)
       from public.vaccinations v
       join public.dogs d on d.id = v.dog_id
       where d.banjar_id = b.id
         and v.vaccinated_at >= now() - make_interval(days => (select days from period))),
    (select count(*) from public.bite_reports r where r.banjar_id = b.id)
  from public.banjars b
  where not b.is_demo
  order by b.name;
$$;

revoke execute on function public.banjar_coverage() from public, anon;
grant execute on function public.banjar_coverage() to authenticated, service_role;

-- Initial thresholds are provisional until scripts/eval.py recommends values from real data.
insert into public.app_config (key, value, note) values
  ('match_strong', '0.70', 'Sementara: belum dikalibrasi pada data nyata. Jalankan scripts/eval.py.'),
  ('match_unsure', '0.50', 'Sementara: belum dikalibrasi pada data nyata. Jalankan scripts/eval.py.'),
  ('vaccine_valid_days', '365', 'Periode vaksin aktif dalam hari.');

-- Sample banjars are placeholders (is_sample) so the app works before real banjar data is loaded.
insert into public.banjars (name, village, district, regency, is_sample, is_demo) values
  ('Banjar Contoh 1', null, 'Denpasar Barat', 'Kota Denpasar', true, false),
  ('Banjar Contoh 2', null, 'Kuta Utara', 'Badung', true, false),
  ('Banjar Contoh 3', null, 'Ubud', 'Gianyar', true, false),
  ('DEMO', null, null, null, false, true);
