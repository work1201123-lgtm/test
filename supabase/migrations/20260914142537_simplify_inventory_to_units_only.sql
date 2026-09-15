/*
# Simplify inventory to units-only tracking

## Changes
1. Set `units_per_box = 1` for all existing products so the box concept is effectively removed.
   - `total_units` already stores the correct unit count, so no change needed there.
   - `purchase_price` currently stores the per-box price; we multiply by the old `units_per_box` to get the per-unit purchase price.
2. This migration is idempotent — running it again has no effect since units_per_box is already 1.

## Important notes
- No columns are dropped or renamed — existing data and queries stay intact.
- The frontend now treats `purchase_price` as "price per unit" and `total_units` as "number of individual items".
- Sales/revenue calculations are unchanged: they use `selling_price * qty` and `total_units` decrement.
*/

-- Convert per-box purchase price to per-unit, then set units_per_box = 1
UPDATE app_products
SET purchase_price = purchase_price * GREATEST(units_per_box, 1),
    units_per_box = 1
WHERE units_per_box != 1;
