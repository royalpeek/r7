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

alter table public.user_transactions enable row level security;

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
