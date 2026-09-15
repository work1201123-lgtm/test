/*
# Add app_session_items table

Stores individual games (and drinks/snacks) added to a running session.
Each row tracks: the session it belongs to, the item type (game/product),
label, quantity, unit price, and whether it's a prolongation.
This enables the control panel to show a live list of games per seat
with match and prolongation counters.
*/

CREATE TABLE IF NOT EXISTS app_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES app_sessions(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'game' CHECK (item_type IN ('game','product')),
  label text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  is_prolongation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_session_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_session_items" ON app_session_items FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_session_items" ON app_session_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_session_items" ON app_session_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_session_items" ON app_session_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS session_items_session_idx ON app_session_items(session_id);
