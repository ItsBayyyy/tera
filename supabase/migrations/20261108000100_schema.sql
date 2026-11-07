-- KenalAsu core schema.
-- Embedding dimension 2152 comes from the real MiewID msv3 output (efficientnetv2_rw_m, use_fc=false).
-- pgvector caps HNSW on `vector` at 2000 dims, so embeddings are stored as `halfvec`.

create extension if not exists vector with schema extensions;

create type public.user_role as enum ('officer', 'admin');
create type public.dog_sex as enum ('male', 'female', 'unknown');
create type public.dog_ownership as enum ('owned', 'stray', 'unknown');
create type public.ai_status as enum ('verified', 'pending', 'manual');
create type public.match_source as enum ('officer', 'citizen', 'demo');
create type public.match_zone as enum ('strong', 'unsure', 'none');
create type public.report_status as enum ('new', 'in_progress', 'closed');
create type public.duplicate_status as enum ('open', 'dismissed', 'merged');

create table public.banjars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  village text,
  district text,
  regency text,
  is_sample boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index banjars_single_demo on public.banjars (is_demo) where is_demo;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'officer',
  default_banjar_id uuid references public.banjars (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  banjar_id uuid not null references public.banjars (id),
  nickname text,
  color text not null,
  sex public.dog_sex not null default 'unknown',
  ownership public.dog_ownership not null default 'unknown',
  owner_name text,
  owner_phone text,
  demo_seed boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
comment on column public.dogs.owner_name is 'Personal data (optional). Never exposed to citizens.';
comment on column public.dogs.owner_phone is 'Personal data (optional). Never exposed to citizens.';
comment on column public.dogs.demo_seed is 'Rows created by scripts/seed_demo.py; kept when demo data is reset.';
create index dogs_banjar_idx on public.dogs (banjar_id);

create table public.dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  storage_path text not null,
  quality_score real,
  embedding extensions.halfvec(2152),
  model_version text,
  created_at timestamptz not null default now()
);
create index dog_photos_dog_idx on public.dog_photos (dog_id);
create index dog_photos_embedding_hnsw on public.dog_photos
  using hnsw (embedding extensions.halfvec_cosine_ops);
create index dog_photos_pending_idx on public.dog_photos (created_at) where embedding is null;

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  vaccinated_at timestamptz not null default now(),
  officer_id uuid references auth.users (id) on delete set null default auth.uid(),
  batch text,
  ai_status public.ai_status not null,
  created_at timestamptz not null default now()
);
create index vaccinations_dog_idx on public.vaccinations (dog_id, vaccinated_at desc);

create table public.match_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  source public.match_source not null,
  zone public.match_zone not null,
  banjar_id uuid references public.banjars (id) on delete set null,
  top_candidates jsonb not null default '[]'::jsonb,
  chosen_dog_id uuid references public.dogs (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.bite_reports (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique,
  bitten_at timestamptz,
  body_part text,
  banjar_id uuid references public.banjars (id) on delete set null,
  lat numeric(6, 3),
  lon numeric(6, 3),
  photo_path text,
  matched_dog_id uuid references public.dogs (id) on delete set null,
  match_score real,
  match_log_id uuid references public.match_logs (id) on delete set null,
  confirmed_dog_id uuid references public.dogs (id) on delete set null,
  contact_phone text,
  contact_consent boolean not null default false,
  status public.report_status not null default 'new',
  officer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bite_reports_phone_needs_consent check (contact_phone is null or contact_consent)
);
comment on column public.bite_reports.matched_dog_id is 'Top AI candidate, unconfirmed. Officers set confirmed_dog_id.';
comment on column public.bite_reports.contact_phone is 'Personal data, stored only with explicit consent.';
create index bite_reports_status_idx on public.bite_reports (status, created_at desc);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  phone text,
  address text,
  lat numeric(8, 5),
  lon numeric(8, 5),
  handles_bites boolean not null default true,
  readiness_note text,
  updated_at timestamptz not null default now()
);

create table public.app_config (
  key text primary key,
  value jsonb not null,
  note text,
  updated_at timestamptz not null default now()
);

create table public.duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  candidate_dog_id uuid not null references public.dogs (id) on delete cascade,
  score real not null,
  status public.duplicate_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dog_id, candidate_dog_id)
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bite_reports_touch before update on public.bite_reports
  for each row execute function public.touch_updated_at();
create trigger facilities_touch before update on public.facilities
  for each row execute function public.touch_updated_at();
create trigger app_config_touch before update on public.app_config
  for each row execute function public.touch_updated_at();

-- Officers are created by an admin in Supabase Auth; every new user gets an officer profile.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
