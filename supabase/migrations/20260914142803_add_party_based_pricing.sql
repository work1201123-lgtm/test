/*
# Add party-based pricing support

## Changes
1. Add `party_count` column to `app_session_items` (integer, default 0).
   - Used to track how many parties/sessions were consumed for party-mode games.
2. Drop and recreate the CHECK constraint on `app_price_rules.game_mode`
   to allow the new value 'party' alongside 'standard' and 'football'.

## Important notes
- No existing data is modified or lost.
- `party_count` defaults to 0 so all existing rows remain valid.
- Party-based pricing ignores time and matches — billing is `price * party_count`.
*/
ALTER TABLE app_session_items
  ADD COLUMN IF NOT EXISTS party_count integer NOT NULL DEFAULT 0;

ALTER TABLE app_price_rules DROP CONSTRAINT IF EXISTS app_price_rules_game_mode_check;
ALTER TABLE app_price_rules
  ADD CONSTRAINT app_price_rules_game_mode_check
  CHECK (game_mode IN ('standard', 'football', 'party'));
