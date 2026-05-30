-- R7 complete Supabase setup.
-- Run this in a new Supabase project before using the app.
-- Existing projects can also run it safely because columns, indexes, and tables use if not exists where possible.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  telegram_id text,
  username text,
  balance numeric not null default 100,
  points numeric not null default 0,
  is_creator boolean not null default false,
  role text not null default 'user',
  referral_code text,
  referred_by text references public.users(id),
  referral_applied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users
add column if not exists telegram_id text,
add column if not exists username text,
add column if not exists balance numeric not null default 100,
add column if not exists points numeric not null default 0,
add column if not exists is_creator boolean not null default false,
add column if not exists role text not null default 'user',
add column if not exists referral_code text,
add column if not exists referred_by text references public.users(id),
add column if not exists referral_applied_at timestamptz,
add column if not exists created_at timestamptz not null default now();

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('user', 'creator', 'admin'));

create unique index if not exists users_referral_code_key
on public.users (referral_code)
where referral_code is not null;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text,
  category text default 'general',
  status text not null default 'active',
  yes_pool numeric not null default 0,
  no_pool numeric not null default 0,
  yes_votes integer not null default 0,
  no_votes integer not null default 0,
  volume numeric not null default 0,
  ends_at timestamptz not null default (now() + interval '24 hours'),
  created_by text references public.users(id),
  creator_reward_paid_at timestamptz,
  creator_reward_amount numeric default 0,
  created_at timestamptz not null default now()
);

alter table public.polls
add column if not exists question text,
add column if not exists description text,
add column if not exists category text default 'general',
add column if not exists status text not null default 'active',
add column if not exists yes_pool numeric not null default 0,
add column if not exists no_pool numeric not null default 0,
add column if not exists yes_votes integer not null default 0,
add column if not exists no_votes integer not null default 0,
add column if not exists volume numeric not null default 0,
add column if not exists ends_at timestamptz not null default (now() + interval '24 hours'),
add column if not exists created_by text references public.users(id),
add column if not exists creator_reward_paid_at timestamptz,
add column if not exists creator_reward_amount numeric default 0,
add column if not exists created_at timestamptz not null default now();

create index if not exists polls_created_by_created_at_idx
on public.polls (created_by, created_at);

create index if not exists polls_created_by_ends_at_status_idx
on public.polls (created_by, ends_at, status);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  poll_id uuid not null references public.polls(id) on delete cascade,
  direction text not null check (direction in ('yes', 'no')),
  amount numeric not null default 0,
  claimed_at timestamptz,
  payout_amount numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.votes
add column if not exists user_id text references public.users(id) on delete cascade,
add column if not exists poll_id uuid references public.polls(id) on delete cascade,
add column if not exists direction text,
add column if not exists amount numeric not null default 0,
add column if not exists claimed_at timestamptz,
add column if not exists payout_amount numeric default 0,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz;

create index if not exists votes_user_poll_claimed_idx
on public.votes (user_id, poll_id, claimed_at);

create unique index if not exists votes_user_poll_unique_idx
on public.votes (user_id, poll_id);

create table if not exists public.poll_history (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  yes_pool numeric not null default 0,
  no_pool numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists poll_history_poll_created_idx
on public.poll_history (poll_id, created_at);

create table if not exists public.user_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  balance_after numeric,
  poll_id uuid references public.polls(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists user_transactions_user_created_idx
on public.user_transactions (user_id, created_at desc);

alter table public.user_transactions
add column if not exists status text not null default 'confirmed';

alter table public.user_transactions
add column if not exists tx_hash text;

alter table public.user_transactions
add column if not exists updated_at timestamptz not null default now();

create index if not exists user_transactions_status_created_idx
on public.user_transactions (status, created_at desc);

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

update public.users
set role = 'creator'
where is_creator = true
and role = 'user';

update public.users
set referral_code = upper('R7' || substr(md5(id), 1, 8))
where referral_code is null;

alter table public.users enable row level security;
alter table public.votes enable row level security;
alter table public.polls enable row level security;
alter table public.poll_history enable row level security;
alter table public.user_transactions enable row level security;
alter table public.user_ton_wallets enable row level security;
alter table public.ton_deposits enable row level security;

drop policy if exists "Public can read polls" on public.polls;
create policy "Public can read polls"
on public.polls
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read poll history" on public.poll_history;
create policy "Public can read poll history"
on public.poll_history
for select
to anon, authenticated
using (true);

drop policy if exists "Block direct user reads" on public.users;
create policy "Block direct user reads"
on public.users
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct user writes" on public.users;
create policy "Block direct user writes"
on public.users
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Block direct vote reads" on public.votes;
create policy "Block direct vote reads"
on public.votes
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct vote writes" on public.votes;
create policy "Block direct vote writes"
on public.votes
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Block direct poll writes" on public.polls;
create policy "Block direct poll writes"
on public.polls
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Block direct poll history writes" on public.poll_history;
create policy "Block direct poll history writes"
on public.poll_history
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "Block direct transaction reads" on public.user_transactions;
create policy "Block direct transaction reads"
on public.user_transactions
for select
to anon, authenticated
using (false);

drop policy if exists "Block direct transaction writes" on public.user_transactions;
create policy "Block direct transaction writes"
on public.user_transactions
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

-- Make yourself admin after your Telegram user has opened the app once:
-- update public.users
-- set role = 'admin'
-- where id = 'YOUR_TELEGRAM_ID';
