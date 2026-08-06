# Deploy Runbook — Lambda NX

This is the operational, step-by-step guide to shipping Lambda NX. It covers the
charter default (**Netlify + Supabase**, Pi mode) and the **standalone** variant
(off-Pi, Stripe). Every provider sits behind an isolation layer (charter §4), so
switching host or database is configuration here — never an app rewrite.

> **Golden rule:** never put a real secret in the repo, in `netlify.toml`, or in
> a commit. All keys are environment variables set in the host dashboard. The
> release packager (`npm run package`) hard-fails if a secret would ship.

---

## 0. Pre-flight (local, before any deploy)

Run the full gate. All three must be green:

```bash
npm run verify        # = typecheck + test + build
```

Optionally produce a clean source bundle (no node_modules/.next/secrets):

```bash
npm run package       # → dist/lambda-nx-<sha>.zip + dist/MANIFEST.json
```

---

## 1. Provision the database (Supabase — swappable for any Postgres)

1. Create a Supabase project (or any Postgres 15+). Copy the connection string.
2. Apply migrations (versioned SQL in `db/migrations/`, currently `0000`–`0007`):

   ```bash
   DATABASE_URL="postgresql://…"  npm run db:migrate
   ```

3. (Deploy-time, optional) enable the durable scheduler: `pg_cron` + `pgmq` for
   the Radar sweep. Until then the sweep runs via the guarded HTTP endpoint
   (`POST /api/radar/run`, see §4).

The app runs **without** a database — keyless investigations still work — but
persistence-backed features (archive, monitors, ontology memory, calibration,
subscription tiers) need `DATABASE_URL`. The readiness probe (§6) tells you which
mode you're in.

---

## 2. Environment variables

Set these in the host dashboard (Netlify: *Site settings → Environment*). See
`.env.example` for the annotated list. Minimum to boot healthily:

| Variable | Required? | Notes |
|---|---|---|
| `SESSION_SECRET` | **yes** | `openssl rand -base64 32`. Our signed sessions. |
| `DATABASE_URL` | recommended | Postgres DSN. Omit to run keyless-only. |
| `AUTH_PROVIDER` | — | `pi` (default) or `standalone`. |
| `PAYMENT_PROVIDER` | — | `pi` (default) or `standard` (Stripe). |
| `NEXT_PUBLIC_AUTH_MODE` | — | Client shell: `pi` (default) or `standalone`. |
| `PI_API_KEY` | Pi mode | Pi Developer Portal. Needed for Pi auth verify + payments. |
| `STRIPE_SECRET_KEY` | standalone paid | Stripe dashboard. Needed for standard payments. |
| `ANTHROPIC_API_KEY` | optional | Enables the AI analyst. Absent = graceful notice. |
| `CRON_SECRET` | scheduler | Shared secret for `POST /api/radar/run`. |
| `PRICE_PRO_PI` / `PRICE_PRO_USD` | optional | Change the Pro price in one place. |
| `ENFORCE_TIERS` | optional | `true` turns on subscription gating. |

Never commit these. Rotate any key that is ever exposed.

---

## 3. Deploy — Pi mode (charter default: Netlify)

The Pi payment functions (`netlify/functions/pi-approve|complete|cancel.js`) and
the verified Pi domain already exist; `netlify.toml` wires the Next runtime,
functions dir, and Node 22. Security headers (CSP, HSTS, …) are defined portably
in `next.config.mjs` so they apply the same on every host — see `docs/SECURITY.md`.

1. Connect the repo to Netlify (branch `claude/bittorent-network-app-c8j9pv` or
   your release branch).
2. Netlify auto-detects `netlify.toml`. Confirm the Next.js plugin is installed
   (`@netlify/plugin-nextjs` — declared in the toml).
3. Set the environment variables from §2 (Pi mode: `PI_API_KEY`, `SESSION_SECRET`,
   `DATABASE_URL`, `CRON_SECRET`).
4. Deploy. Keep the Pi domain verification assets in `public/`
   (`piapp-link-verification.txt`, `validation-key.txt`) — they ship as static
   files and prove domain ownership to the Pi Developer Portal.

### Pi App Studio registration

Pi apps are **hosted web apps** — Pi Browser loads them from your deployed URL
(there is no binary/app bundle to upload). To register:

1. In the Pi Developer Portal, create/point the app at the deployed URL.
2. Ensure the verification files above resolve at
   `https://<your-domain>/piapp-link-verification.txt` and
   `/validation-key.txt` (they do, from `public/`).
3. Configure the Pi payment callbacks to the Netlify functions:
   `/.netlify/functions/pi-approve`, `/pi-complete`, `/pi-cancel`.
4. For handoff/archival, `npm run package` produces a clean source zip
   (`dist/lambda-nx-<sha>.zip`) with a manifest (git sha, versions, file count).

---

## 4. The Radar scheduler

`POST /api/radar/run` runs one radar pass. It is **disabled (503) unless
`CRON_SECRET` is set**, and requires the header `x-cron-secret: <CRON_SECRET>`.

A pass has two halves, and the endpoint can run either alone:

| Call | Runs | Suggested cadence |
|---|---|---|
| `POST /api/radar/run?half=monitors` | product monitors that are due | every 15–60 min |
| `POST /api/radar/run?half=watch` | the internal ⭐ watchlist (`docs/RADAR.md`) | daily |
| `POST /api/radar/run` | both, independently — one half failing does not abort the other (failures come back under `errors`) | — |

Schedule them separately: monitors follow each user's chosen interval, while the
watchlist is a once-a-day read of publishers who post at most a few items a day.
Running the watch half more often just re-reads feeds and stores nothing (it is
de-duplicated), so it wastes provider goodwill for no gain.

- **Supabase/pg_cron (durable, preferred at scale):** schedule a job that POSTs
  to the endpoint with the header.
- **Netlify Scheduled Functions / external cron:** same call on a cron cadence.

Egress note: the watch half needs outbound HTTPS to `www.cisa.gov`,
`huggingface.co` and `export.arxiv.org`. If the host network is allowlisted,
add them, or the sweep reports those feeds as failed (and stores nothing —
never fabricated data).

---

## 5. Deploy — standalone mode (off-Pi)

Same codebase, one switch. Set:

```
AUTH_PROVIDER=standalone
PAYMENT_PROVIDER=standard
NEXT_PUBLIC_AUTH_MODE=standalone
STRIPE_SECRET_KEY=sk_live_…
```

The app then shows the email/password login gate (`components/standalone-auth`)
and routes payments through the Stripe provider. Deployable to Netlify, Vercel,
or self-host — the runtime is standard Next.js 15.

### Deploy — Vercel

Import the repo; Vercel auto-detects Next.js, so build/output settings need no
changes. Set the same env vars from §2 (Project Settings → Environment Variables)
and redeploy — variables are read at build time, so adding one does not apply
until the next deploy.

Two things make the build host-agnostic, and both are deliberate:

- **`.nvmrc`** pins Node 22. Netlify, Vercel and local `nvm` all read it, so the
  version lives in one place instead of a per-host copy that drifts.
- **No `--legacy-peer-deps` anywhere.** The dependency tree resolves under npm's
  strict peer rules on its own. Hosts that run a plain `npm install` (Vercel does)
  therefore succeed without vendor-specific flags. Keep it that way: reaching for
  the flag hides the next genuine peer conflict rather than fixing it — as it did
  for `vaul@0.9.9`, which never supported React 19 and only looked fine because
  the flag was masking it.

Note the Pi payment endpoints are Netlify Functions (`netlify/functions/*`). On
Vercel they must be ported to route handlers under `app/api/` — straightforward,
since they sit behind `lib/payments` — or you keep Pi mode on Netlify and use
Vercel for standalone mode.

---

## 6. Post-deploy verification

1. **Readiness probe** — the honest configuration report (no secrets leaked):

   ```bash
   curl -s https://<your-domain>/api/health | jq
   ```

   `status: "healthy"` = all required + optional checks pass; `"degraded"` = an
   optional provider is off (e.g. no AI key); `"unhealthy"` (HTTP 503) = a
   required check failed (fix `SESSION_SECRET`).

2. **End-to-end smoke test** — probes a live instance (no DB/egress needed):

   ```bash
   node scripts/smoke.mjs https://<your-domain>
   ```

   Verifies: home shell renders, `/api/health` shape + status code, `/api/plans`
   reachable, `/api/analyst` rejects anonymous (401), `/api/radar/run` is guarded.

---

## 7. Rollback

Netlify keeps immutable deploys — roll back to the previous deploy in the
dashboard (instant). Database migrations are forward-only; if a migration must be
undone, write a new down-migration rather than editing history. Because every
provider is behind an isolation layer, reverting the app never strands data.

---

## 8. Swapping providers (no rewrite — charter §4)

| Swap | How |
|---|---|
| Database (Supabase ↔ any Postgres) | change `DATABASE_URL` |
| Host (Netlify ↔ Vercel ↔ self-host) | Next.js 15 standard build; move env + functions |
| Auth (Pi ↔ standalone) | `AUTH_PROVIDER` + `NEXT_PUBLIC_AUTH_MODE` |
| Payments (Pi ↔ Stripe) | `PAYMENT_PROVIDER` |
| AI analyst (Claude ↔ disabled) | `AI_PROVIDER` |
| Storage (filesystem ↔ object store) | `STORAGE_PROVIDER` |
| Queue (memory ↔ pgmq) | `QUEUE_PROVIDER` |
