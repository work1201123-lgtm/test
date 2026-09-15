/*
# Add worker tracking columns to app_workers

1. Modified Tables
- `app_workers`: adds three new columns:
  - `last_login_at` (timestamptz, nullable): timestamp of the worker's most recent PIN login.
  - `ip_address` (text, nullable): the IP address the worker connected from during their last login.
  - `is_online` (boolean, default false): whether the worker is currently logged in. Set to true on login, false on logout.

2. Security
- No changes to existing RLS policies. The new columns are covered by the existing open CRUD policy on app_workers.

3. Important notes
- Existing rows keep their current behavior (is_online defaults to false, last_login_at and ip_address default to null).
- No data is deleted or rewritten.
*/

ALTER TABLE app_workers
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
