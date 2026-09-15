/*
# Add game match tracking and football pricing

1. New columns on `app_price_rules`
- `game_mode`: standard games or football-style match pricing.
- `match_price`: price charged for one football match.
- `prolongation_price`: price charged for one prolongation.
- `notification_minutes`: warning interval after the configured duration.

2. New columns on `app_session_items`
- `price_rule_id`: the selected game pricing rule.
- `match_count`: number of matches recorded for this game block.
- `prolongation_count`: number of prolongations recorded for this game block.
- `match_price`: snapshot of the match price used by the running session.
- `prolongation_price`: snapshot of the prolongation price used by the running session.
- `duration_minutes`: configured duration for the selected game.
- `notification_minutes`: configured warning interval for the selected game.
- `game_started_at`: start time for this game block.
- `notification_sent_at`: last warning time sent for this game block.

3. Security
- Existing RLS policies remain in place; no new tables or access paths are introduced.

4. Important notes
- Existing price rules and session items keep their current behavior through safe defaults.
- Existing rows are not deleted or rewritten.
*/

ALTER TABLE app_price_rules
  ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'standard' CHECK (game_mode IN ('standard', 'football')),
  ADD COLUMN IF NOT EXISTS match_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (match_price >= 0),
  ADD COLUMN IF NOT EXISTS prolongation_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (prolongation_price >= 0),
  ADD COLUMN IF NOT EXISTS notification_minutes integer NOT NULL DEFAULT 5 CHECK (notification_minutes > 0);

ALTER TABLE app_session_items
  ADD COLUMN IF NOT EXISTS price_rule_id uuid REFERENCES app_price_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_count integer NOT NULL DEFAULT 0 CHECK (match_count >= 0),
  ADD COLUMN IF NOT EXISTS prolongation_count integer NOT NULL DEFAULT 0 CHECK (prolongation_count >= 0),
  ADD COLUMN IF NOT EXISTS match_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (match_price >= 0),
  ADD COLUMN IF NOT EXISTS prolongation_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (prolongation_price >= 0),
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  ADD COLUMN IF NOT EXISTS notification_minutes integer NOT NULL DEFAULT 5 CHECK (notification_minutes > 0),
  ADD COLUMN IF NOT EXISTS game_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS session_items_price_rule_idx ON app_session_items(price_rule_id);