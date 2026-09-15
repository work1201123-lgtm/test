/*
# PIN-based café management schema

Replaces email-based auth with PIN access (admin=1111, worker=2222).
Creates new tables with app_ prefix for the self-app single-café model.

1. New tables:
- app_settings: café config, admin_pin, worker_pin, theme, language
- app_workers: worker profiles (name, role, active) for action tracking
- app_stations: gaming stations (name, type, status, sort_order)
- app_price_rules: pricing per station type and duration
- app_products: inventory with total_units tracking
- app_sessions: gaming sessions with worker tracking
- app_transactions: sales records (session, calculator, sale)
- app_transaction_items: line items for transactions
- app_clients: customers with balance tracking
- app_client_payments: payment records
- app_reminders: personal reminders with due date/time
- app_audit_logs: audit trail with worker, old_value, new_value

2. Security:
- All tables use TO anon, authenticated (no Supabase Auth, single-tenant)
- RLS enabled on all tables with USING (true) for shared single-café data

3. Seed data:
- Default settings (admin_pin=1111, worker_pin=2222, theme=midnight, language=en)
- Default stations (PS1-PS5, Pool 1)
- Default admin worker profile
*/

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Max Gaming',
  admin_pin text NOT NULL DEFAULT '1111',
  worker_pin text NOT NULL DEFAULT '2222',
  theme text NOT NULL DEFAULT 'midnight',
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('admin', 'worker')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'console',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'paused', 'maintenance', 'offline')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_type text NOT NULL,
  label text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'beverage',
  units_per_box integer NOT NULL DEFAULT 1 CHECK (units_per_box > 0),
  total_units integer NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  purchase_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  selling_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.app_stations(id) ON DELETE CASCADE,
  station_name text NOT NULL,
  worker_name text,
  price_rule_id uuid REFERENCES public.app_price_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'finished')),
  started_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz,
  ended_at timestamptz,
  paused_seconds integer NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'calculator' CHECK (source IN ('session', 'calculator', 'sale')),
  worker_name text,
  client_id uuid,
  client_name text,
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.app_transactions(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('game', 'product')),
  label text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.app_clients(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  worker_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  due_at timestamptz NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text,
  action text NOT NULL,
  entity text,
  old_value jsonb,
  new_value jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_settings" ON public.app_settings;
CREATE POLICY "anon_all_settings" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_workers" ON public.app_workers;
CREATE POLICY "anon_all_workers" ON public.app_workers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_stations" ON public.app_stations;
CREATE POLICY "anon_all_stations" ON public.app_stations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_price_rules" ON public.app_price_rules;
CREATE POLICY "anon_all_price_rules" ON public.app_price_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_products" ON public.app_products;
CREATE POLICY "anon_all_products" ON public.app_products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_sessions" ON public.app_sessions;
CREATE POLICY "anon_all_sessions" ON public.app_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_transactions" ON public.app_transactions;
CREATE POLICY "anon_all_transactions" ON public.app_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_transaction_items" ON public.app_transaction_items;
CREATE POLICY "anon_all_transaction_items" ON public.app_transaction_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_clients" ON public.app_clients;
CREATE POLICY "anon_all_clients" ON public.app_clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_client_payments" ON public.app_client_payments;
CREATE POLICY "anon_all_client_payments" ON public.app_client_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_reminders" ON public.app_reminders;
CREATE POLICY "anon_all_reminders" ON public.app_reminders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_audit_logs" ON public.app_audit_logs;
CREATE POLICY "anon_all_audit_logs" ON public.app_audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS app_stations_sort_idx ON public.app_stations(sort_order);
CREATE INDEX IF NOT EXISTS app_sessions_status_idx ON public.app_sessions(status);
CREATE INDEX IF NOT EXISTS app_transactions_created_idx ON public.app_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS app_audit_created_idx ON public.app_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS app_items_tx_idx ON public.app_transaction_items(transaction_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_settings) THEN
    INSERT INTO public.app_settings (name, admin_pin, worker_pin, theme, language)
    VALUES ('Max Gaming', '1111', '2222', 'midnight', 'en');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_stations) THEN
    INSERT INTO public.app_stations (name, type, status, sort_order) VALUES
      ('PS1', 'console', 'available', 1),
      ('PS2', 'console', 'available', 2),
      ('PS3', 'console', 'available', 3),
      ('PS4', 'console', 'available', 4),
      ('PS5', 'console', 'available', 5),
      ('Pool 1', 'pool', 'available', 6);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_workers WHERE role = 'admin') THEN
    INSERT INTO public.app_workers (name, role, active) VALUES ('Admin', 'admin', true);
  END IF;
END $$;
