alter table public.users
alter column balance set default 0;

alter table public.ton_deposits
alter column asset set default 'Test TON';
