-- Add long-term app roles.
-- user: normal voter
-- creator: trusted user who can create polls
-- admin: app owner with full admin permissions

alter table public.users
add column if not exists role text not null default 'user';

alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('user', 'creator', 'admin'));

-- Keep existing creators working after the new role column is added.
update public.users
set role = 'creator'
where is_creator = true
and role = 'user';

-- After running this file, set your own account as admin manually:
-- update public.users
-- set role = 'admin'
-- where id = 'YOUR_TELEGRAM_ID';
