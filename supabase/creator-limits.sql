alter table public.polls
add column if not exists created_by text references public.users(id);

create index if not exists polls_created_by_created_at_idx
on public.polls (created_by, created_at);
