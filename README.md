# Crispy

The marketing site + productized-kits storefront for **crispygoat.com**.
React + Vite frontend, tiny Express + SQLite API for blog posts, kits, and
Stripe checkout. Designed to replace the current Astro deployment.

## Stack

- **React 18 + Vite 5** — SPA, static build → `dist/`
- **Tailwind 3** — utility CSS, charcoal/bone/gold palette
- **react-router-dom 6** — client routing
- **@tanstack/react-query 5** — data fetching
- **Express 4 + better-sqlite3** — API + embedded DB (single file at `server/data/crispy.db`)
- **JWT in httpOnly cookie** — admin auth
- **Stripe Checkout** — kit purchases
- **GitHub Actions self-hosted runner** on the box → `pm2 restart crispy-api`

## Local dev

```bash
# one-time
npm run install:all           # installs root + server deps
cp .env.example .env
cp server/.env.example server/.env
# edit server/.env: set JWT_SECRET and ADMIN_PASSWORD

# daily
npm run dev                   # web on :5173, api on :3102
```

Open http://localhost:5173. Vite proxies `/api` to the Express server, so
cookies and origins Just Work.

## Build & preview

```bash
npm run build                 # outputs dist/
npm run preview               # serves dist/ on :4173
```

## Project layout

```
.
├── .github/workflows/deploy.yml   # CI/CD
├── docs/nginx-crispygoat.conf     # nginx vhost (copy to /etc/nginx/sites-available/)
├── index.html
├── src/                           # React app
└── server/                        # Express API
```

## API quick reference

All endpoints live under `/api`. Public reads filter to `status = 'published'`.
Admin routes require `Cookie: token=…` (set by `/api/auth/login`).

### Auth

```bash
# Log in (saves cookie)
curl -c jar -X POST http://localhost:3102/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@crispygoat.com","password":"..."}'

# Who am I
curl -b jar http://localhost:3102/api/auth/me

# Log out
curl -b jar -X POST http://localhost:3102/api/auth/logout
```

### Blog posts

```bash
# List published posts
curl http://localhost:3102/api/posts

# Read one
curl http://localhost:3102/api/posts/shipped-farm-stand-kit

# Create (admin)
curl -b jar -X POST http://localhost:3102/api/posts \
  -H 'content-type: application/json' \
  -d '{
    "slug":"shipped-farm-stand-kit",
    "title":"Shipped: Farm Stand Kit",
    "excerpt":"$49 Stripe-checkout kit, live now.",
    "body_md":"## What it is\n\nA template for produce stands…",
    "status":"published",
    "published_at":"2026-09-15T15:00:00Z"
  }'

# Update (admin)
curl -b jar -X PUT http://localhost:3102/api/posts/shipped-farm-stand-kit \
  -H 'content-type: application/json' \
  -d '{"status":"draft"}'

# Delete (admin)
curl -b jar -X DELETE http://localhost:3102/api/posts/shipped-farm-stand-kit
```

### Kits (products for sale)

```bash
# List published kits
curl http://localhost:3102/api/kits

# Read one
curl http://localhost:3102/api/kits/farm-stand

# Create (admin)
curl -b jar -X POST http://localhost:3102/api/kits \
  -H 'content-type: application/json' \
  -d '{
    "slug":"farm-stand",
    "title":"Farm Stand Site Kit",
    "tagline":"$49 — buy and ship today",
    "description_md":"A complete template for produce stands.",
    "price_cents":4900,
    "stripe_price_id":"price_1ABCxyz",
    "features_json":"[\"Stripe checkout\",\"Mobile-first\",\"Ready to deploy\"]",
    "demo_slug":"farm-stand",
    "status":"published"
  }'

# Update (admin) — any field
curl -b jar -X PUT http://localhost:3102/api/kits/farm-stand \
  -H 'content-type: application/json' \
  -d '{"price_cents":5900,"status":"published"}'

# Delete (admin)
curl -b jar -X DELETE http://localhost:3102/api/kits/farm-stand
```

`features_json` is a JSON array of strings — paste a literal JSON string,
the server stores it verbatim.

### Demos (sample sites linked to kits)

```bash
# Read one (public — only if linked kit is published)
curl http://localhost:3102/api/demos/farm-stand

# Create (admin)
curl -b jar -X POST http://localhost:3102/api/demos \
  -H 'content-type: application/json' \
  -d '{
    "slug":"farm-stand",
    "title":"High Mesa Farm Stand",
    "html":"<div class=\"hero\"><h1>High Mesa Farm Stand</h1></div>",
    "kit_slug":"farm-stand",
    "status":"published"
  }'
```

### Applications (from `/apply` form)

```bash
# Public submission
curl -X POST http://localhost:3102/api/applications \
  -H 'content-type: application/json' \
  -d '{"name":"Jane","email":"jane@example.com","brief":"Need a 6-page site."}'

# List (admin)
curl -b jar http://localhost:3102/api/applications
```

### Stripe

```bash
# Start checkout for a kit
curl -X POST http://localhost:3102/api/stripe/checkout \
  -H 'content-type: application/json' \
  -d '{"kit_slug":"farm-stand"}'
# → { "url": "https://checkout.stripe.com/..." }

# Webhook (called by Stripe, not by clients)
# Returns 503 {error: 'stripe_not_configured'} until STRIPE_SECRET_KEY
# and STRIPE_WEBHOOK_SECRET are set on the box.
```

## Deploy

See [DEPLOY.md](./DEPLOY.md) for the one-time box setup. After that, push to
`main` on GitHub and the self-hosted runner builds, scps, and restarts.

## License

UNLICENSED — proprietary to Crispy Goat.
