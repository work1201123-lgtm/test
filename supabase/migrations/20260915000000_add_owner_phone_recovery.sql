-- Ghost recovery: one owner-only secret word that unlocks the admin PIN reset.
-- Only the fingerprint (hash) is ever stored — the word itself is never
-- saved anywhere, never shown in Admin Panel, never written to logs.
-- Run this in the Supabase SQL editor of the NEW project
-- (https://gmjutbmwoacgrozydwin.supabase.co).

alter table public.app_settings
  add column if not exists ghost_word_hash text;
