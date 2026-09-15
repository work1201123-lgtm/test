-- Reminder links: every reminder points at its place (product / station / client).
-- Run this in the Supabase SQL editor when you go online. Localhost needs
-- nothing — src/lib/db.ts backfills the same three columns automatically.

alter table public.app_reminders
  add column if not exists link_kind text not null default 'none'
    check (link_kind in ('none', 'product', 'station', 'client')),
  add column if not exists link_id uuid,
  add column if not exists link_label text;

-- Remove the old phantom demo reminder if it ever got synced online.
delete from public.app_reminders
where message = 'Restock Coca-Cola before the weekend rush';
