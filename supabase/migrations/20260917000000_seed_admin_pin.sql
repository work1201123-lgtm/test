-- First-run setup needs EMPTY pins: the app asks the owner to choose PINs
-- on first open and saves them. Do NOT seed 1111/2222 here.
-- Run once in SQL Editor on a fresh project (safe to re-run: only
-- backfills missing columns, never overwrites existing PINs).

alter table public.app_settings
  add column if not exists ghost_word_hash text;

alter table public.app_reminders
  add column if not exists link_kind text,
  add column if not exists link_id uuid,
  add column if not exists link_label text;

-- Backfill link columns on old rows (keeps existing reminders working).
-- If link_kind was created NOT NULL DEFAULT 'none' by an earlier migration,
-- this update is a harmless no-op.
update public.app_reminders set link_kind = 'none' where link_kind is null;
