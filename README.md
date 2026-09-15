# Max Gaming Café — Management Web App

Gaming café management: stations, sessions, game pricing (standard / football / party modes),
beverages & stock, clients & debts, daily summary, reminders with links, audit logs,
3 languages (EN / FR / AR + RTL), 14 animated themes, PIN login + ghost-word recovery.

## Stack

- Vite 6 + React 18 + TypeScript + Tailwind CSS + lucide-react
- Data: Supabase (production) with offline localStorage fallback (localhost)

## Quick start

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

Default PINs (localhost seed): Admin `1111` · Worker `2222` · Sub-admin `3333`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Environment variables

Production (committed, used by Cloudflare build):

- `.env.production` → `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  (Supabase project `gmjutbmwoacgrozydwin`)

Local override (git-ignored, localhost only — never used by build/hosting):

- `.env.local` → empty values = localStorage seed mode (Admin 1111)

Copy `.env.example` to `.env.local` and fill it in if you want localhost
to talk to Supabase instead of the local seed.

## Supabase setup (run once in SQL Editor)

1. `supabase/migrations/20260915000000_add_owner_phone_recovery.sql` — adds `ghost_word_hash`
2. `supabase/migrations/20260916000000_reminder_links.sql` — adds `link_kind/link_id/link_label`

Full schema history lives in `supabase/migrations/`.

## Host on Cloudflare Pages

Build settings (Pages → project → Settings → Builds):

- Build command: `npm run build`
- Output directory: `dist`
- Root directory: (project root)
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same as `.env.production`)

Or from CLI: `wrangler pages deploy dist --project-name=max-gaming-cafe`

SPA fallback: `public/_redirects` (`/* /index.html 200`).
Security headers: `public/_headers` (nosniff / DENY / no-referrer, no `unsafe-eval`).

See [DEPLOY.md](./DEPLOY.md) for the full checklist.

## License

All rights reserved — see [LICENSE](./LICENSE).
