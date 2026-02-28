alter table public.seasons
  add column if not exists notifications_paused boolean not null default false;

comment on column public.seasons.notifications_paused is
  'Global kill-switch for push notifications. true = no push notifications are sent.';
