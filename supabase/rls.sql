-- Enable RLS on app tables.
alter table public.users enable row level security;
alter table public.votes enable row level security;
alter table public.polls enable row level security;
alter table public.poll_history enable row level security;

-- Polls are public market data. The app reads them from the browser and API.
drop policy if exists "Public can read polls" on public.polls;
create policy "Public can read polls"
on public.polls
for select
to anon, authenticated
using (true);

-- Pool history is public chart data.
drop policy if exists "Public can read poll history" on public.poll_history;
create policy "Public can read poll history"
on public.poll_history
for select
to anon, authenticated
using (true);

-- Users are private. The app reads creator/profile state through verified API routes.
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

-- Votes are private. The app reads/writes votes through verified API routes.
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

-- Poll creation and updates happen through verified server routes.
drop policy if exists "Block direct poll writes" on public.polls;
create policy "Block direct poll writes"
on public.polls
for all
to anon, authenticated
using (false)
with check (false);

-- Poll history writes should be server/database-owned.
drop policy if exists "Block direct poll history writes" on public.poll_history;
create policy "Block direct poll history writes"
on public.poll_history
for all
to anon, authenticated
using (false)
with check (false);
