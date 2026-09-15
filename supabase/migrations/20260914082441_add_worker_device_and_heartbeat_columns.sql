/*
# Add device, browser, and heartbeat columns to app_workers

1. Modified Tables
- `app_workers`: adds four new columns:
  - `device_type` (text, nullable): the type of device the worker is using (e.g. "Desktop", "Mobile", "Tablet").
  - `browser` (text, nullable): the browser name and version the worker is using (e.g. "Chrome 129").
  - `last_heartbeat_at` (timestamptz, nullable): timestamp of the worker's most recent heartbeat ping, used to determine real-time online status.
  - `session_started_at` (timestamptz, nullable): timestamp when the worker's current session began (i.e. login time), used to calculate session duration.

2. Security
- No changes to existing RLS policies. The new columns are covered by the existing open CRUD policy on app_workers.

3. Important notes
- Existing rows keep their current behavior (new columns default to null).
- No data is deleted or rewritten.
- The `is_online` boolean is still set on login/logout, but real-time online status should be determined by checking if `last_heartbeat_at` is within the last 60 seconds.
*/

ALTER TABLE app_workers
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_started_at timestamptz;