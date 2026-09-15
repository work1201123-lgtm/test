/*
# Add Station Types Table

## Purpose
Allow the user to create custom station categories (e.g. "PlayStation", "Pool", "Arcade", "Bowling")
with their own color identity. Stations reference these types by name. This enables grouping in
the control panel and dynamic pricing categories.

## Changes
1. New table: `app_station_types`
   - `id` (uuid, primary key)
   - `name` (text, unique, not null) — e.g. "console", "pool", "arcade"
   - `label` (text, not null) — display name, e.g. "PlayStations", "Pool Tables"
   - `color` (text, default 'ocean') — color theme key for visual grouping
   - `sort_order` (int, default 0)
   - `created_at` (timestamptz, default now())

2. Seed default station types matching existing station data:
   - "console" -> "PlayStations" (emerald)
   - "pool" -> "Pool" (ocean)

3. RLS enabled with anon+authenticated full access (shared single-tenant app with PIN auth).

## Notes
- The `app_stations.type` column already stores the type name as free text.
- No changes to existing tables — this is purely additive.
- The PricesView already reads station types dynamically from the stations list,
  so adding new types there will automatically appear as pricing categories.
*/

CREATE TABLE IF NOT EXISTS public.app_station_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'ocean',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_station_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_station_types" ON public.app_station_types;
CREATE POLICY "anon_select_station_types" ON public.app_station_types FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_station_types" ON public.app_station_types;
CREATE POLICY "anon_insert_station_types" ON public.app_station_types FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_station_types" ON public.app_station_types;
CREATE POLICY "anon_update_station_types" ON public.app_station_types FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_station_types" ON public.app_station_types;
CREATE POLICY "anon_delete_station_types" ON public.app_station_types FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS app_station_types_sort_idx ON public.app_station_types(sort_order);

-- Seed default types matching existing data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_station_types) THEN
    INSERT INTO public.app_station_types (name, label, color, sort_order) VALUES
      ('console', 'PlayStations', 'emerald', 1),
      ('pool', 'Pool', 'ocean', 2);
  END IF;
END $$;
