/*
# Add app_daily_archives table

Stores finalized daily summaries that are automatically archived at midnight.
Each row captures: the date, total revenue, gaming revenue, beverage revenue,
payment totals, session count, transaction count, outstanding amounts, and
the raw JSON of all transactions for that day for full traceability.
*/

CREATE TABLE IF NOT EXISTS app_daily_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_date date NOT NULL UNIQUE,
  total_revenue numeric DEFAULT 0,
  gaming_revenue numeric DEFAULT 0,
  beverage_revenue numeric DEFAULT 0,
  payments_total numeric DEFAULT 0,
  sessions_count int DEFAULT 0,
  transactions_count int DEFAULT 0,
  outstanding_amount numeric DEFAULT 0,
  transactions_json jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_daily_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_archives" ON app_daily_archives FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_archives" ON app_daily_archives FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_archives" ON app_daily_archives FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_archives" ON app_daily_archives FOR DELETE
  TO anon, authenticated USING (true);
