-- Add per-worker PIN column
ALTER TABLE app_workers ADD COLUMN IF NOT EXISTS pin text DEFAULT '';

-- Expand role to include sub_admin
ALTER TABLE app_workers DROP CONSTRAINT IF EXISTS app_workers_role_check;
ALTER TABLE app_workers ADD CONSTRAINT app_workers_role_check CHECK (role IN ('admin', 'sub_admin', 'worker'));

-- Add theme/icon/logo to settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'emerald';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS icon text DEFAULT 'gamepad';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_url text;

-- Migrate existing pins from settings to workers
UPDATE app_workers SET pin = s.admin_pin
FROM app_settings s
WHERE app_workers.role = 'admin' AND (app_workers.pin IS NULL OR app_workers.pin = '');

UPDATE app_workers SET pin = s.worker_pin
FROM app_settings s
WHERE app_workers.role = 'worker' AND (app_workers.pin IS NULL OR app_workers.pin = '');