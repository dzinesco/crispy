# Crispy — Project context for AI agents and new contributors

The marketing site for **crispygoat.com**. Replaces the previous Astro
deployment (whose source was lost/recovered). Lives in this repo
(`github.com/dzinesco/crispy`).

## People

- **Tyler (Dzinesco)** — owner. GitHub: `github.com/dzinesco`. Tech operator.

## Stack

- React 18 + Vite 5 SPA, styled with Tailwind 3.
- react-router-dom 6 (BrowserRouter).
- @tanstack/react-query 5 for client data fetching.
- `marked` for blog post markdown rendering.
- Express 4 + better-sqlite3 for the API (port 3102).
- JWT in httpOnly cookies for admin auth.
- Stripe Checkout (real keys required; no stub mode).
- GitHub Actions self-hosted runner on `crispygoat.com` for deploys.
- PM2 manages `crispy-api` on the box.

## Local dev

```bash
npm run install:all      # install root + server deps
npm run dev              # web on :5173, api on :3102, both with watch
```

Vite proxies `/api` → `http://127.0.0.1:3102` so cookies work cross-origin.

## Adding content

Use the API directly (`curl` examples in [README.md](./README.md)), or log in
at `/admin/login` and use the in-app editor. Admin tabs:

- **Posts** — blog content (markdown body)
- **Kits** — products for sale (Stripe Checkout)
- **Demos** — sample sites linked to a kit (`kit_slug` FK)
- **Applications** — `/apply` form submissions

## Build & deploy

```bash
npm run build            # outputs dist/
git push origin main     # runner on the box builds + scps + pm2 restart
```

## Conventions

- All slugs are URL-safe (`[a-z0-9-]+`). Server validates and 409s on collision.
- All `status` fields are `'draft' | 'published'`. Public reads filter to published.
- Markdown bodies render via `marked` on the client; server stores raw MD.
- Frontend uses bone/charcoal/gold Tailwind tokens — match existing palette for new components.
- No new dependencies without a good reason — keep the bundle small.

## Things to NOT do

- Don't add seed data — the user republishes manually from the old Astro site.
- Don't move Stripe to a stub mode — the contract is "real keys or 503".
- Don't re-add the old `moka` patterns (Express+Postgres) — this project uses SQLite.
- Don't change the deploy path on the box (`/home/tyler/crispy/`) without updating `docs/nginx-crispygoat.conf` and `DEPLOY.md` together.

## Files of note

- `vite.config.js` — `/api` proxy target.
- `server/src/index.js` — webhook route mounted BEFORE `express.json()` (Stripe requires raw body).
- `server/src/db.js` — runs migrations + seeds the first admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- `server/migrations/001_initial.sql` — schema. Add a new `00X_*.sql` for changes; never edit a landed migration.
- `.github/workflows/deploy.yml` — uses `appleboy/scp-action` and `appleboy/ssh-action` with `DEPLOY_SSH_KEY` secret.
- `docs/nginx-crispygoat.conf` — vhost to copy to `/etc/nginx/sites-available/crispygoat`.
