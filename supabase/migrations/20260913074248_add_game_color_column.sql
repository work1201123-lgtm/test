/*
# Add color column to game price rules

1. Changes
- Adds `color` column to `app_price_rules` table.
- The color column stores a color name string (e.g. 'emerald', 'ocean', 'sunset', 'crimson', 'gold')
  that lets each game/price rule have a distinct visual color in the UI.
- Default value is 'ocean' (the existing blue accent) so current games keep their look.
2. Notes
- Non-destructive: only adds a new nullable column with a default.
- No RLS or policy changes needed — the table already has full CRUD policies.
*/

ALTER TABLE app_price_rules
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'ocean';
