create table if not exists public.user_ton_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  network text not null default 'testnet',
  address text not null,
  raw_address text,
  public_key text not null,
  mnemonic_encrypted text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists user_ton_wallets_user_network_key
on public.user_ton_wallets (user_id, network);

create unique index if not exists user_ton_wallets_address_key
on public.user_ton_wallets (address);

alter table public.ton_deposits
add column if not exists deposit_address text;

alter table public.user_ton_wallets enable row level security;

create table if not exists public.wallet_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  actor_user_id text references public.users(id) on delete set null,
  target_user_id text references public.users(id) on delete set null,
  wallet_address text,
  tx_hash text,
  status text not null default 'success',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_audit_logs_target_created_idx
on public.wallet_audit_logs (target_user_id, created_at desc);

create index if not exists wallet_audit_logs_event_created_idx
on public.wallet_audit_logs (event, created_at desc);

alter table public.wallet_audit_logs enable row level security;

drop policy if exists "Block direct wallet audit reads" on public.wallet_audit_logs;
create policy "Block direct wallet audit reads"
on public.wallet_audit_logs
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct wallet audit writes" on public.wallet_audit_logs;
create policy "Block direct wallet audit writes"
on public.wallet_audit_logs
for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, window_start)
);

alter table public.api_rate_limits enable row level security;

drop policy if exists "Block direct rate limit reads" on public.api_rate_limits;
create policy "Block direct rate limit reads"
on public.api_rate_limits
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct rate limit writes" on public.api_rate_limits;
create policy "Block direct rate limit writes"
on public.api_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Block direct TON wallet reads" on public.user_ton_wallets;
create policy "Block direct TON wallet reads"
on public.user_ton_wallets
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct TON wallet writes" on public.user_ton_wallets;
create policy "Block direct TON wallet writes"
on public.user_ton_wallets
for all
to anon, authenticated
using (false)
with check (false);
