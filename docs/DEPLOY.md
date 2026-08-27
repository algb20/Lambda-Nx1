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
2. Apply migrations (versioned SQL in `db/migrations/`, currently `0000`–`0008`):

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

> ### Serverless + Supabase: use the pooler host, not the direct one
>
> This is the single most common way a correct-looking `DATABASE_URL` fails, and
> it cost days on the live deployment. Supabase gives two connection strings:
>
> | | Host | Port | Reachable from Vercel/Netlify functions |
> |---|---|---|---|
> | **Direct** | `db.<ref>.supabase.co` | 5432 | ❌ — IPv6-only |
> | **Pooler** (use this) | `…pooler.supabase.com` | 6543 | ✅ |
>
> The direct host resolves only over IPv6, which serverless platforms do not
> have. The URL is right, the password is right, and the host simply does not
> exist from where the code runs — so it fails with `ENOTFOUND` and every
> account feature goes down while every keyless gateway keeps working.
>
> Symptoms, and what they mean:
>
> | What you see | What it is |
> |---|---|
> | `/api/health` says `database ok` | Only that the variable is **set**. It is not a connection test. |
> | `/api/health?deep=1` says `database off` | The real answer. The detail names the cause and the fix. |
> | The sign-in form says "cannot reach its database" | The deployment asked, and got no answer. |
>
> **Always diagnose with `?deep=1`.** The shallow check reads the environment;
> only the deep one asks the database. A password containing `@ : / ? #` must be
> percent-encoded, which is the other frequent cause — it produces `28P01`
> (`password authentication failed`) rather than `ENOTFOUND`.
>
> ### The schema applies itself
>
> If the database is reachable and its tables are missing, the deployment
> creates them — at most once per process, on the first request that needs an
> account. There is nothing to paste and no secret to find.
>
> This is safe because of what the schema file can do: every statement is a
> guarded `CREATE` or an additive `ALTER`, the only `DROP` in it is
> `DROP NOT NULL`, and the single `UPDATE` writes only where a column is still
> `NULL`. `lib/db/apply-schema.test.ts` asserts all three, so a migration that
> ever introduced a destructive statement fails the suite instead of being
> applied to a production database unattended.
>
> Two other routes to the same place:
>
> - **A button.** `/setup` → *Create the database tables* → paste `ADMIN_SECRET`
>   → *Apply the schema*. Reports exactly which tables it created.
> - **By hand.** Paste `db/schema.sql` into the provider's SQL editor. One file,
>   safe to run more than once. Watch for a truncated paste — a run that stops
>   partway leaves the database incomplete and says nothing.
>
> `AUTO_SCHEMA=off` disables the automatic path, which is the right choice on a
> database shared with something else.

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
| `CRON_SECRET` | **for anything automatic** | Guards every scheduled job (`GET /api/cron/*`, `POST /api/radar/run`). Unset ⇒ the platform publishes nothing on its own and the Radar never sweeps. `openssl rand -base64 32`. |
| `ADMIN_SECRET` | for the admin surface | Unlocks the social dashboard, the private usage registry (`GET /api/admin/visitors`) and the manual publish run. Unset ⇒ those endpoints return 503 and no one can read them. |
| `SOCIAL_SECRET_KEY` | for social channels | 32-byte key that encrypts channel webhook credentials at rest (AES-256-GCM). Unset ⇒ a channel cannot be saved at all, because its credential would sit unencrypted. `openssl rand -hex 32`. |
| `PRICE_PRO_PI` / `PRICE_PRO_USD` | optional | Change the Pro price in one place. |
| `ENFORCE_TIERS` | optional | `true` turns on subscription gating. |

Never commit these. Rotate any key that is ever exposed.

### The private usage registry (admin-only)

The app records who reaches it, for the operator's eyes only — it is **never
shown anywhere in the product**. On open, a fire-and-forget beacon (`/api/visit`)
lets the server note, into the `visitors` table:

- **signed-in visitors** — one row each: their Pi username (or standalone email),
  the country the edge resolved, first/last seen and a visit count;
- **anonymous visitors** — aggregated per country only, with no per-guest
  identifier or cookie (charter §3: data minimization, no personal tracking).

**No IP address is ever stored** — the country comes from the host's edge geo
header (`x-vercel-ip-country`, Netlify `x-nf-geo`, Cloudflare `cf-ipcountry`, …),
read portably in `lib/geo/edge-geo.ts`, so this works unchanged on any host.

Read it with the secret:

```bash
curl -H "x-admin-secret: $ADMIN_SECRET" https://<your-app>/api/admin/visitors
curl -H "x-admin-secret: $ADMIN_SECRET" "https://<your-app>/api/admin/visitors?view=country"
```

The table is under the same RLS lockdown as every other table (RLS on, no
policies): only the app's service connection can touch it.

---

## 3. Deploy — Pi mode (charter default: Netlify)

> ### Know which site is production, before anything else
>
> This account has **many** Netlify sites pointed at this repository, and they
> are not equivalent. The distinction that matters is not the name — it is
> whether the site is **connected to GitHub**:
>
> - A **connected** site rebuilds itself when `main` moves. Merging is
>   deploying.
> - A site created by an API/zip/drag-and-drop deploy is **not** connected. It
>   serves whatever was last pushed to it by hand and *never* changes when you
>   merge — which reads, from the outside, exactly like a broken application.
>
> Two separate days were lost to this. First a cron expression the Vercel plan
> forbade, which failed every build (see `vercel.json.md`). Then the opposite
> shape: builds succeeding while the URL being tested was an unconnected site
> frozen on an old commit, with **no environment variables set at all** — no
> `DATABASE_URL`, no `SESSION_SECRET` — so nothing could persist and nobody
> could sign in. Both times the symptom was "I merged and nothing changed".
>
> **Before debugging the app, confirm the URL you are testing.** In the Netlify
> dashboard, the production deploy of a connected site shows the commit it was
> built from; if that commit is not the tip of `main`, the problem is the site,
> not the code. Prefer one connected production site and delete or ignore the
> rest — a spare site with stale code and empty configuration is not a backup,
> it is a trap.
>
> Environment variables are **per site**. Setting them on one site does nothing
> for another, and a site missing `SESSION_SECRET` cannot sign anybody in even
> though the code is perfect. Every deployment target needs the full set from
> §2.


The verified Pi domain already exists; `netlify.toml` wires the Next runtime.
Pi payments are served by the app's own route handler (`app/api/payments`) over
the `lib/payments` port — not by host-specific functions — so they behave the
same on Netlify, Vercel or self-host. Node comes from `.nvmrc`, and security
headers (CSP, HSTS, …) are defined portably in `next.config.mjs` so they apply
the same everywhere — see `docs/SECURITY.md`.

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
3. Pi payments are handled by `POST /api/payments` with
   `{ action: 'approve'|'complete'|'cancel', paymentId, txid? }`. It is
   session-gated (401 when anonymous) and runs on any host — there is no
   host-specific function to register.
4. For handoff/archival, `npm run package` produces a clean source zip
   (`dist/lambda-nx-<sha>.zip`) with a manifest (git sha, versions, file count).

---

## 4. The scheduler — everything the platform does on its own

All scheduled work comes through **one guarded door**: `GET /api/cron/<job>`.

It is a `GET` guarded by a bearer token because that is what hosted schedulers
send. The earlier design — `POST` with a bespoke header — could not be driven by
Vercel Cron at all, which meant the "automatic" publishing was automatic only
when a human remembered to trigger it by hand.

The cadences live in **`lib/ops/schedule.ts`**, which both hosts read. This
table describes them; it does not define them, so the two can no longer
disagree — and they did. Until 2026-08-22 `radar-monitors` was scheduled on
neither host, so the monitors users saved never swept on their own on Netlify at
all. A test now fails if a job exists with no cadence and no stated reason.

| Job | Does | Netlify (default) | Vercel (capped) |
|---|---|---|---|
| `GET /api/cron/publish` | turns the strongest of today's graded findings into real posts on the front page | every 20 min | daily 06:00 |
| `GET /api/cron/radar-monitors` | runs the product monitors that are due | every 20 min | via `radar` |
| `GET /api/cron/radar-watch` | reads the internal ⭐ watchlist (`docs/RADAR.md`) | hourly | via `radar` |
| `GET /api/cron/radar` | both Radar halves; one half failing does not abort the other | — | daily 07:30 |
| `GET /api/cron/sources` | re-asks the quarantined sources whether they answer again, and reads what they return before believing them | daily 00:00 | — |

**Why the two columns differ, and why that is not a bug to fix.** Vercel's plan
allows **two cron jobs, each at most once a day**; exceeding it fails the whole
deployment while the site keeps serving the old code, which cost a previous
session most of a day to diagnose. So Netlify is the scheduler and Vercel is a
degraded fallback whose cost is written down beside it in `VERCEL_FALLBACK`: the
front page renews daily instead of three times an hour, and a saved monitor can
be most of a day behind. A deployment that needs the real cadence runs on
Netlify, or on a Vercel plan without the cap.

**Why `sources` is daily, and bounded.** It re-probes the quarantine — the
sources withheld because they were *observed* broken. Coverage that only heals
when somebody remembers is coverage that decays: eight days after the list was
written, six of its fifty-one entries were back and nothing in the platform
knew. It runs under a 45-second budget inside a 60-second function, because a
run the runtime kills reports nothing at all, and the list rotates by the day so
what today's budget did not reach leads tomorrow's run. A source is released
only when the document it returns *parses, holds items, and carries a recent
one* — two of that day's eight answered `200` and deserved no release, one of
them with reporting 1,492 days old.

Authentication — either header, both compared in constant time:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/publish
curl -H "x-cron-secret: $CRON_SECRET"        https://<domain>/api/cron/publish
```

Without `CRON_SECRET` every job answers **503**, so an unconfigured deployment
publishes nothing rather than exposing an open trigger. `GET /api/health` names
this in the `cron_secret` check.

Every job is idempotent: the publisher skips anything already published (each
candidate carries a stable identity) and the Radar fingerprints its findings.
Running a job twice costs time, never duplicates.

### The three ways the same job runs

They are deliberately independent, because each fails in a different way and no
single one of them is reliable on every host.

**1. Netlify Scheduled Functions — the primary.** This is the host the project
actually deploys to. `netlify/functions/scheduled-jobs.mts` fires **every 20
minutes** and calls `/api/cron/publish` over HTTP, with `radar-watch` added on
the tick that lands near the top of the hour. Nothing to configure beyond
`CRON_SECRET`; the function reads the site's own address from `URL`.

**2. Vercel Cron — the fallback host, and its cadence is plan-limited.**
`vercel.json` declares `publish` at 06:00 and `radar` at 07:30 UTC. Those are
*daily* because Vercel's Hobby plan permits at most two cron jobs and each at
most once a day — a more frequent expression does not get throttled, it **fails
the whole build** (`vercel-config.test.ts` asserts both limits so it cannot be
committed again). Once a day is not "current", which is exactly why freshness
does not depend on this path. On a Pro plan the two expressions can be raised to
`*/20 * * * *` freely; nothing else changes.

**3. Self-drive — no scheduler at all.** `lib/modules/self-drive.ts` starts a
publish run in the background when somebody *reads* the feed and the newest
automatic post is older than 20 minutes, with a 10-minute floor between runs, a
single-flight guard, and failures counted rather than retried. This is what
keeps a laptop, a self-hosted box and Pi App Studio current, none of which have a
scheduler to configure. Where a scheduler *is* running it fires first, the posts
are already fresh, and this never triggers.

**On Supabase/pg_cron or any external cron**, call the same URLs with either
header.

`POST /api/radar/run` still exists and takes the same credential, for anyone
already scheduling it. `POST /api/publish/run` (guarded by `ADMIN_SECRET`) is the
operator's manual handle, and `?dry=1` reports what it *would* publish without
writing anything — the safe way to check the thresholds.

Schedule the two Radar halves separately: monitors follow each user's chosen
interval, while the watchlist is a once-a-day read of publishers who post at most
a few items a day. Running the watch half more often re-reads feeds and stores
nothing (it is de-duplicated), so it wastes provider goodwill for no gain.

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
and redeploy — **variables are read at build time, so adding one does not apply
until the next deploy.** This is the single most common cause of "I set it and
nothing changed".

`vercel.json` in the repo root carries two things so the platform behaves without
dashboard clicking:

- **`crons`** — the two daily schedules from §4 (the Hobby plan's ceiling). They
  fire only on the production deployment, and only if `CRON_SECRET` is set.
  Freshness between them comes from self-drive, not from here.
- **`functions`** — a 60-second ceiling for the routes that fan out to several
  public providers. Vercel's default (10 s) kills those mid-request and returns
  an HTML error page where the client expects JSON, which is precisely how the
  world map ends up empty.

The **Content Security Policy** widens for `vercel.live` only when the build runs
on Vercel (`lib/security/csp.mjs`), so the Vercel toolbar loads without console
violations while a Netlify or self-hosted deploy keeps the tighter policy.

Two things make the build host-agnostic, and both are deliberate:

- **`.nvmrc`** pins Node 22. Netlify, Vercel and local `nvm` all read it, so the
  version lives in one place instead of a per-host copy that drifts.
- **No `--legacy-peer-deps` anywhere.** The dependency tree resolves under npm's
  strict peer rules on its own. Hosts that run a plain `npm install` (Vercel does)
  therefore succeed without vendor-specific flags. Keep it that way: reaching for
  the flag hides the next genuine peer conflict rather than fixing it — as it did
  for `vaul@0.9.9`, which never supported React 19 and only looked fine because
  the flag was masking it.

Nothing else is host-specific: Pi payments run through `app/api/payments` on
Vercel exactly as on Netlify.

---

## 6. Post-deploy verification

**Start here: `npm run check:deploys`.** It asks every deployment in
`lib/ops/deployments.ts` for `/api/health`, ranks what it finds worst-first, and
exits non-zero if anything is blocking, stale or unreachable. One command
instead of one `curl` per site.

```
  gregarious-haupia   degraded    d45a8c7  2026-08-27T03:27:10.449Z
  zippy-gecko         unhealthy   d45a8c7  2026-08-27T03:00:37.842Z
  melodious-tiramisu  unhealthy   d45a8c7  2026-08-27T02:59:09.440Z

  ✖ zippy-gecko         session_secret is degraded — SESSION_SECRET not set
  ✖ melodious-tiramisu  session_secret is degraded — SESSION_SECRET not set
  · gregarious-haupia   pi_api_key is degraded — PI_API_KEY not set
```

That is a real run. The first line is the configured deployment; the other two
are earlier Netlify projects still building this repository with nothing set,
kept in the list precisely so they stay visible until they are deleted — a
public deployment nobody intends to run still serves the product to anyone who
finds the URL and still spends build minutes on every push.

**The morning this was written the picture was worse and entirely invisible:**
all three deployments unhealthy, `SESSION_SECRET` unset on every one so nobody
could sign in, `DATABASE_URL` unset so there was no database at all,
`CRON_SECRET` unset so every scheduled job answered 503 — and one site serving
a twelve-day-old build. Every fact was already in `/api/health`; reading it was
a thing a person had to remember, which is the same failure this repository has
now fixed three times in other places.

`NX_DEPLOYMENTS` (comma-separated origins) points it at a fork or a self-host.
It is given no credential and passes none — `/api/health` reports only *whether*
a setting is configured — so its output is safe to paste anywhere.

**Then, once the variables are set and the site redeployed: `npm run verify:live`.**

```bash
CRON_SECRET=… ADMIN_SECRET=… npm run verify:live -- https://your-site
```

`check:deploys` answers *is each setting configured*. This answers *does each
setting work*, which is a different question and the one that costs days. A
`CRON_SECRET` that is set but mistyped answers 403 forever while every
configuration report says the check passes; a `DATABASE_URL` can be present,
correct in every character, and still point at a host serverless functions
cannot resolve. So this asks each subsystem to do its job:

| Subsystem | Asked | Distinguishes |
|---|---|---|
| sign-in | `/api/health` required checks | configured vs not |
| database | `/api/health?deep=1` | unset · unreachable · reachable-but-incomplete · working |
| scheduler | `GET /api/cron/sources` with the bearer | 503 (unset on host) vs 403 (set, and different from yours) |
| admin | `GET /api/admin/visitors` | same two |

The database verdict reads the body, not the status code — `?deep=1` answers
`200` whether or not the database is reachable, so judging it on the status
would call a dead database healthy. It separates *no DATABASE_URL* from *wrong
DATABASE_URL* (the first version of it did not, and sent the reader to debug a
connection that was never attempted), and it refuses to call a reachable
database with missing tables working, which is what a truncated schema paste
looks like from outside.

Secrets come from your shell, go only to the origin you name, over HTTPS, and
are never printed: a verdict says *the deployment rejected the credential this
shell holds*, never what either value was.

Then, per deployment:

1. **Readiness probe** — the honest configuration report (no secrets leaked):

   ```bash
   curl -s https://<your-domain>/api/health | jq
   ```

   `status: "healthy"` = all required + optional checks pass; `"degraded"` = an
   optional provider is off (e.g. no AI key); `"unhealthy"` (HTTP 503) = a
   required check failed (fix `SESSION_SECRET`).

   It also reports which commit is serving the page, under `build` — so "is the
   live link the latest work?" is answerable without a hosting dashboard.

2. **Is it actually wired to the database?** — `?deep=1` stops asking the
   environment and asks Postgres:

   ```bash
   curl -s "https://<your-domain>/api/health?deep=1" | jq .database
   ```

   ```json
   {
     "reachable": true,
     "latencyMs": 34,
     "serverVersion": "PostgreSQL 15.8",
     "appliedMigrations": 14,
     "expectedMigrations": 14,
     "missingTables": [],
     "error": null
   }
   ```

   This is the check that matters, because a set `DATABASE_URL` is **not** a
   working connection. Read it as:

   | Symptom | Meaning | Fix |
   |---|---|---|
   | `reachable: false` | wrong credentials, paused project, or the pooler refused | check the connection string in the host dashboard; use the **session pooler** DSN for a serverless host |
   | `missingTables` non-empty | connected, but the schema was never migrated | `DATABASE_URL=… npm run db:migrate` |
   | `appliedMigrations < expectedMigrations` | the deployment ships migrations the database has not applied | same — migrate |
   | all clean | genuinely wired | — |

   Kept opt-in so an uptime monitor hitting `/api/health` every thirty seconds
   does not open a database connection each time. Never leaks a credential: the
   connection string is absent from the output and driver errors are scrubbed
   before they are returned.

3. **End-to-end smoke test** — probes a live instance (no DB/egress needed):

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
| Host (Netlify ↔ Vercel ↔ self-host) | Next.js 15 standard build; move env vars — no host-specific functions remain |
| Auth (Pi ↔ standalone) | `AUTH_PROVIDER` + `NEXT_PUBLIC_AUTH_MODE` |
| Payments (Pi ↔ Stripe) | `PAYMENT_PROVIDER` |
| AI analyst (Claude ↔ disabled) | `AI_PROVIDER` |
| Storage (filesystem ↔ object store) | `STORAGE_PROVIDER` |
| Queue (memory ↔ pgmq) | `QUEUE_PROVIDER` |
