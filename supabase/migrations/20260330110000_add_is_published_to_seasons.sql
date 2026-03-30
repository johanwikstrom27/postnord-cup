alter table public.seasons
add column if not exists is_published boolean not null default true;

update public.seasons
set is_published = true
where is_published is distinct from true;
