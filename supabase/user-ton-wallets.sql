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
