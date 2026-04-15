create extension if not exists pgcrypto;

create table if not exists public.other_competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  location text,
  starts_on date,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'live', 'locked')),
  card_image_url text,
  header_image_url text,
  rules_content text not null default '',
  config jsonb not null default jsonb_build_object(
    'version', 1,
    'players', jsonb_build_array(),
    'teams', jsonb_build_array(),
    'rounds', jsonb_build_array(),
    'results', jsonb_build_object(),
    'finalPlacementOverrides', jsonb_build_object(),
    'settings', jsonb_build_object()
  ),
  published_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists other_competitions_status_starts_on_idx
  on public.other_competitions (status, starts_on);

create or replace function public.set_other_competitions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.status in ('published', 'live', 'locked')
    and old.status is distinct from new.status
    and new.published_at is null then
    new.published_at = now();
  end if;

  if new.status = 'locked' and old.status is distinct from 'locked' then
    new.locked_at = now();
  end if;

  if new.status is distinct from 'locked' then
    new.locked_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_other_competitions_updated_at on public.other_competitions;

create trigger trg_other_competitions_updated_at
before update on public.other_competitions
for each row
execute function public.set_other_competitions_updated_at();
