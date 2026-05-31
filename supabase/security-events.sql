create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  actor_user_id text,
  target_user_id text,
  wallet_address text,
  tx_hash text,
  status text not null default 'success',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_actor_created_idx
on public.security_events (actor_user_id, created_at desc);

create index if not exists security_events_target_created_idx
on public.security_events (target_user_id, created_at desc);

create index if not exists security_events_event_created_idx
on public.security_events (event, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "Block direct security event reads" on public.security_events;
create policy "Block direct security event reads"
on public.security_events
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct security event writes" on public.security_events;
create policy "Block direct security event writes"
on public.security_events
for all
to anon, authenticated
using (false)
with check (false);
