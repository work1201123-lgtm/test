/*
# Create multi-café gaming management schema

1. New tables
- cafes: one isolated workspace per café with name, selected theme, language, and timestamps.
- memberships: authenticated users linked to a café with owner, manager, or worker role.
- stations: gaming stations and their availability/maintenance state.
- price_rules: configurable station/game durations and prices.
- products: beverage and accessory inventory with box/unit pricing and stock.
- gaming_sessions: live and completed station sessions with timestamps and totals.
- transactions: completed sales from sessions or the calculator.
- transaction_items: line items for games and products.
- clients: customers and their outstanding balances.
- client_payments: payments against customer balances.
- reminders: personal reminders for café members.
- audit_logs: append-only operational history.

2. Security
- Every table has RLS enabled.
- All application data is scoped through café membership and never shared across cafés.
- Only café members can access their café data.
- Roles are stored in memberships and are not writable as ordinary row data.
- The bootstrap function creates a private café and owner membership for a newly signed-in user.

3. Important notes
- Authentication uses Supabase email/password sessions.
- Monetary values are stored as numeric amounts in DZD.
- The browser never supplies ownership fields; café membership is derived from the authenticated session.
*/

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text not null default 'midnight',
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null default 'worker' check (role in ('owner','manager','worker')),
  created_at timestamptz not null default now(),
  unique(cafe_id, user_id)
);

create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  category text not null default 'console',
  status text not null default 'available' check (status in ('available','in_use','paused','maintenance','offline')),
  created_at timestamptz not null default now()
);

create table if not exists public.price_rules (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  station_category text not null,
  label text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(12,2) not null check (price >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  category text not null default 'beverage',
  units_per_box integer not null default 1 check (units_per_box > 0),
  boxes_in_stock integer not null default 0 check (boxes_in_stock >= 0),
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.gaming_sessions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete restrict,
  client_id uuid,
  price_rule_id uuid references public.price_rules(id) on delete set null,
  status text not null default 'running' check (status in ('running','paused','finished')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  paused_seconds integer not null default 0,
  total numeric(12,2) not null default 0 check (total >= 0)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  client_id uuid,
  source text not null default 'calculator' check (source in ('session','calculator','sale')),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid numeric(12,2) not null default 0 check (paid >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  item_type text not null check (item_type in ('game','product')),
  label text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  phone text,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null,
  due_at timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cafes enable row level security;
alter table public.memberships enable row level security;
alter table public.stations enable row level security;
alter table public.price_rules enable row level security;
alter table public.products enable row level security;
alter table public.gaming_sessions enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.clients enable row level security;
alter table public.client_payments enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_cafe_member(target_cafe uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.memberships where cafe_id = target_cafe and user_id = auth.uid()); $$;
revoke execute on function public.is_cafe_member(uuid) from anon;
grant execute on function public.is_cafe_member(uuid) to authenticated;

create or replace function public.bootstrap_cafe(cafe_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare new_cafe uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select cafe_id into new_cafe from public.memberships where user_id = auth.uid() limit 1;
  if new_cafe is not null then return new_cafe; end if;
  insert into public.cafes(name) values (coalesce(nullif(trim(cafe_name), ''), 'My Gaming Café')) returning id into new_cafe;
  insert into public.memberships(cafe_id, user_id, role) values (new_cafe, auth.uid(), 'owner');
  insert into public.stations(cafe_id, name, category) values
    (new_cafe, 'PS1', 'console'), (new_cafe, 'PS2', 'console'), (new_cafe, 'PS3', 'console'),
    (new_cafe, 'PS4', 'console'), (new_cafe, 'PS5', 'console'), (new_cafe, 'Pool 1', 'pool');
  return new_cafe;
end; $$;
revoke execute on function public.bootstrap_cafe(text) from anon;
grant execute on function public.bootstrap_cafe(text) to authenticated;

create or replace function public.cafe_ids()
returns setof uuid language sql stable security definer set search_path = public
as $$ select cafe_id from public.memberships where user_id = auth.uid(); $$;
revoke execute on function public.cafe_ids() from anon;
grant execute on function public.cafe_ids() to authenticated;

create policy "members read cafes" on public.cafes for select to authenticated using (public.is_cafe_member(id));
create policy "members update cafes" on public.cafes for update to authenticated using (public.is_cafe_member(id)) with check (public.is_cafe_member(id));
create policy "members read memberships" on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_cafe_member(cafe_id));

create policy "members select stations" on public.stations for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert stations" on public.stations for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update stations" on public.stations for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));
create policy "members delete stations" on public.stations for delete to authenticated using (public.is_cafe_member(cafe_id));

create policy "members select prices" on public.price_rules for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert prices" on public.price_rules for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update prices" on public.price_rules for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));
create policy "members delete prices" on public.price_rules for delete to authenticated using (public.is_cafe_member(cafe_id));

create policy "members select products" on public.products for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert products" on public.products for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update products" on public.products for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));
create policy "members delete products" on public.products for delete to authenticated using (public.is_cafe_member(cafe_id));

create policy "members select sessions" on public.gaming_sessions for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert sessions" on public.gaming_sessions for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update sessions" on public.gaming_sessions for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));

create policy "members select transactions" on public.transactions for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert transactions" on public.transactions for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update transactions" on public.transactions for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));
create policy "members select items" on public.transaction_items for select to authenticated using (exists (select 1 from public.transactions t where t.id = transaction_id and public.is_cafe_member(t.cafe_id)));
create policy "members insert items" on public.transaction_items for insert to authenticated with check (exists (select 1 from public.transactions t where t.id = transaction_id and public.is_cafe_member(t.cafe_id)));

create policy "members select clients" on public.clients for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert clients" on public.clients for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members update clients" on public.clients for update to authenticated using (public.is_cafe_member(cafe_id)) with check (public.is_cafe_member(cafe_id));
create policy "members delete clients" on public.clients for delete to authenticated using (public.is_cafe_member(cafe_id));
create policy "members select payments" on public.client_payments for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert payments" on public.client_payments for insert to authenticated with check (public.is_cafe_member(cafe_id));
create policy "members select reminders" on public.reminders for select to authenticated using (public.is_cafe_member(cafe_id) and user_id = auth.uid());
create policy "members insert reminders" on public.reminders for insert to authenticated with check (public.is_cafe_member(cafe_id) and user_id = auth.uid());
create policy "members update reminders" on public.reminders for update to authenticated using (public.is_cafe_member(cafe_id) and user_id = auth.uid()) with check (public.is_cafe_member(cafe_id) and user_id = auth.uid());
create policy "members delete reminders" on public.reminders for delete to authenticated using (public.is_cafe_member(cafe_id) and user_id = auth.uid());
create policy "members select audit" on public.audit_logs for select to authenticated using (public.is_cafe_member(cafe_id));
create policy "members insert audit" on public.audit_logs for insert to authenticated with check (public.is_cafe_member(cafe_id));

create index if not exists stations_cafe_idx on public.stations(cafe_id);
create index if not exists products_cafe_idx on public.products(cafe_id);
create index if not exists sessions_cafe_status_idx on public.gaming_sessions(cafe_id, status);
create index if not exists transactions_cafe_created_idx on public.transactions(cafe_id, created_at desc);
create index if not exists audit_cafe_created_idx on public.audit_logs(cafe_id, created_at desc);
