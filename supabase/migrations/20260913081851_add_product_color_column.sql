/*
# Add color column to app_products

1. Changes
- Adds `color` column to `app_products` table.
- Stores a color name (e.g. 'ocean', 'emerald', 'sunset', 'crimson', 'gold')
  so each product category (drink, snack, accessory) can have a distinct visual color.
- Default 'ocean' keeps existing products consistent with the current blue accent.
2. Notes
- Non-destructive: only adds a new column with a default.
- No RLS or policy changes needed — the table already has full CRUD policies.
*/

ALTER TABLE app_products
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'ocean';
