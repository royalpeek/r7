alter table public.users
add column if not exists referral_code text,
add column if not exists referred_by text references public.users(id),
add column if not exists referral_applied_at timestamptz;

create unique index if not exists users_referral_code_key
on public.users (referral_code)
where referral_code is not null;

update public.users
set referral_code = upper('R7' || substr(md5(id), 1, 8))
where referral_code is null;
