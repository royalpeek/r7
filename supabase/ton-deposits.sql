create table if not exists public.ton_deposits (
  id uuid primary key default gen_random_uuid(),
  tx_hash text not null unique,
  tx_lt text,
  user_id text not null references public.users(id) on delete cascade,
  amount numeric not null,
  asset text not null default 'Testnet TON',
  memo text not null,
  deposit_address text,
  source_address text,
  raw jsonb,
  status text not null default 'processing',
  credited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ton_deposits_user_created_idx
on public.ton_deposits (user_id, created_at desc);

create index if not exists ton_deposits_status_created_idx
on public.ton_deposits (status, created_at desc);

alter table public.ton_deposits
add column if not exists deposit_address text;

alter table public.ton_deposits enable row level security;

drop policy if exists "Block direct TON deposit reads" on public.ton_deposits;
create policy "Block direct TON deposit reads"
on public.ton_deposits
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct TON deposit writes" on public.ton_deposits;
create policy "Block direct TON deposit writes"
on public.ton_deposits
for all
to anon, authenticated
using (false)
with check (false);
