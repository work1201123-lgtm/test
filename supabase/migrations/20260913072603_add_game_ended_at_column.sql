/*
# Add game_ended_at column to app_session_items

1. Modified Tables
- `app_session_items`: adds `game_ended_at` (timestamptz, nullable).
  When a new game is added to a session, the previous game's `game_ended_at`
  is set to the current timestamp, freezing its timer and visually marking
  it as a past game. A null value means the game is still actively running.

2. Security
- No changes to existing RLS policies. The new column is covered by the
  existing update policy on app_session_items.

3. Important notes
- Existing rows keep their current behavior (game_ended_at defaults to null,
  meaning "still running").
- No data is deleted or rewritten.
*/

ALTER TABLE app_session_items
  ADD COLUMN IF NOT EXISTS game_ended_at timestamptz;
