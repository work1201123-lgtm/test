-- Seed PIN login for the NEW Supabase project (gmjutbmwoacgrozydwin).
-- Run once in SQL Editor. Plain '1111' matches the local seed;
-- the ghost-reset flow will hash it on first reset.

-- Settings row (plain PINs, like the local seed)
insert into public.app_settings (name, admin_pin, worker_pin, theme, language)
select 'Max Gaming', '1111', '2222', 'midnight', 'en'
where not exists (select 1 from public.app_settings);

-- Admin / worker / sub-admin rows (plain PINs, like the local seed)
insert into public.app_workers (name, role, pin, active)
select 'Admin', 'admin', '1111', true
where not exists (select 1 from public.app_workers where role = 'admin');

insert into public.app_workers (name, role, pin, active)
select 'Yacine', 'worker', '2222', true
where not exists (select 1 from public.app_workers where role = 'worker');

insert into public.app_workers (name, role, pin, active)
select 'Karim', 'sub_admin', '3333', true
where not exists (select 1 from public.app_workers where role = 'sub_admin');
