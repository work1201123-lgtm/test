# Deploy checklist — Cloudflare Pages

Source → env → build → Cloudflare config → deploy → live verify.

## 1. Supabase (new project `gmjutbmwoacgrozydwin`, SQL Editor, run once)

- [ ] `supabase/migrations/20260915000000_add_owner_phone_recovery.sql`
- [ ] `supabase/migrations/20260916000000_reminder_links.sql`

## 2. Local build must pass

```bash
npm run build
```

- [ ] Exits 0 (`✓ built in …`). Ignore the Browserslist "caniuse-lite outdated" warning.
- [ ] `dist/index.html`, `dist/_redirects`, `dist/_headers` all exist.
- [ ] Bundle references the prod project:
  `Select-String -Path dist/assets/*.js -Pattern "gmjutbmwoacgrozydwin"` returns a match.

## 3. Cloudflare Pages settings (Settings → Builds)

- Build command: `npm run build`
- Output directory: `dist`
- Root directory: (project root)
- Env vars:
  - `VITE_SUPABASE_URL=https://gmjutbmwoacgrozydwin.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<same as .env.production>`

## 4. Deploy

Push to GitHub (Pages auto-builds), or:

```bash
wrangler pages deploy dist --project-name=max-gaming-cafe
```

## 5. Verify live (hard refresh, Ctrl+Shift+R)

- [ ] Newest build loads (no old cached JS).
- [ ] Network calls go to `gmjutbmwoacgrozydwin.supabase.co`.
- [ ] Bell is empty on fresh data (no phantom reminder).
- [ ] Reminder links jump to Storage / Control / Clients.
- [ ] Ghost recovery works (Admin Settings → set word → logout → Forgot PIN?).
- [ ] No `unsafe-eval` added; headers intact (`_headers`).
