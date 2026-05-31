create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  device_fingerprint text not null,
  os_version text,
  device_model text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists users_telegram_id_key
on public.users (telegram_id)
where telegram_id is not null;

create unique index if not exists devices_user_id_key
on public.devices (user_id);

create unique index if not exists devices_fingerprint_key
on public.devices (device_fingerprint);

create table if not exists public.device_security_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  user_id text,
  device_fingerprint text,
  status text not null default 'success',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists device_security_logs_user_created_idx
on public.device_security_logs (user_id, created_at desc);

create index if not exists device_security_logs_event_created_idx
on public.device_security_logs (event, created_at desc);

alter table public.devices enable row level security;
alter table public.device_security_logs enable row level security;

drop policy if exists "Block direct device reads" on public.devices;
create policy "Block direct device reads"
on public.devices
for select
using (false);

drop policy if exists "Block direct device writes" on public.devices;
create policy "Block direct device writes"
on public.devices
for all
using (false)
with check (false);

drop policy if exists "Block direct device log reads" on public.device_security_logs;
create policy "Block direct device log reads"
on public.device_security_logs
for select
using (false);

drop policy if exists "Block direct device log writes" on public.device_security_logs;
create policy "Block direct device log writes"
on public.device_security_logs
for all
using (false)
with check (false);
