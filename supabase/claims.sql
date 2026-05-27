alter table public.votes
add column if not exists claimed_at timestamptz,
add column if not exists payout_amount numeric default 0;

alter table public.polls
add column if not exists creator_reward_paid_at timestamptz,
add column if not exists creator_reward_amount numeric default 0;

create index if not exists votes_user_poll_claimed_idx
on public.votes (user_id, poll_id, claimed_at);
