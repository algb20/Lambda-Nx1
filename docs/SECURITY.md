# Security Posture — Lambda NX

This documents how Lambda NX protects itself and stays within the law/ethics
guardrails (charter §3). It is the reference for the pre-release security review
and for anyone auditing the deploy.

## 1. Passive-only, by construction (not by discipline)

The engine can never touch an investigation target. Enforced in
`lib/engine/guardrail.ts`:

- **Host allowlist.** A source may only contact provider hosts it pre-declares.
  A request to any other host throws `PassiveGuardrailError`. A target/subject
  host is never on any allowlist, so the engine cannot contact it — no port
  scans, no probing.
- **Read-only methods.** Only GET/HEAD/POST (POST covers provider *query* APIs);
  PUT/PATCH/DELETE are refused.
- **Rate limiting per source.** Each source declares a minimum interval; the
  guardrail throttles calls to protect upstream providers and respect ToS.

This is covered by engine tests (`lib/engine/engine.test.ts`).

## 2. Authentication & sessions

- **Our own signed sessions** (`lib/auth/session.ts`): HMAC-SHA256 over the
  payload with `SESSION_SECRET`. No vendor session backend. `secret()` **throws**
  when `SESSION_SECRET` is absent or < 16 chars — there is no insecure fallback
  key, so a misconfigured instance fails closed (sign-in unavailable) rather than
  signing with a guessable secret. The readiness probe flags this as a failed
  *required* check (`/api/health` → 503).
- **Passwords** (standalone mode): scrypt-hashed, never stored in plaintext
  (`/api/auth/register|login`).
- **Provider isolation:** auth/payments/storage/queue all sit behind ports
  (`lib/*`), selected by env. Swapping Pi ↔ standalone ↔ Stripe is configuration.

### Route authorization

| Class | Auth | Notes |
|---|---|---|
| `/api/auth/*` | public by nature | login/register/pi/logout/me |
| `/api/intelligence/*` (per-gateway) | **public (free tier)** | keyless passive investigations; charter allows free core access with limits |
| `/api/analyst`, `/api/payments`, `/api/monitors*`, `/api/alerts`, `/api/suggestions*`, `/api/calibration*`, `/api/ontology*` | **session-gated** | 401 when anonymous |
| `/api/radar/run` | **CRON_SECRET** | 503 without the secret; 403 on wrong `x-cron-secret` |
| `/api/health` | public | config booleans only, **no secrets**, `no-store` |

Verified end-to-end by `scripts/smoke.mjs` (analyst → 401, radar → 503).

## 3. Secrets handling

- All keys are environment variables (`SESSION_SECRET`, `PI_API_KEY`,
  `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CRON_SECRET`).
  None are committed; `.gitignore` excludes `.env*` except `.env.example`.
- The **release packager** (`scripts/package.mjs`) hard-fails if a secret file
  (`.env`, `*.pem`, `*.key`, …) or a secret-shaped string (Stripe live key,
  Anthropic key, a DSN with an embedded password) would ship.
- The readiness probe reports only *presence* (booleans) and provider names — a
  test asserts no secret value ever appears in its output
  (`lib/modules/health.test.ts`).

## 4. Transport & browser hardening

Portable security headers apply on every response, on every host, via
`next.config.mjs` `headers()` (so Netlify, Vercel and self-host are identical):

- `Content-Security-Policy` — `default-src 'self'`; images allow `data:`/`blob:`
  for our canvas globe; scripts/connect allow the Pi SDK/API only when in Pi
  Browser; `frame-ancestors 'none'`.
- `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (geolocation/mic/camera/payment all denied).

## 5. Data protection & privacy (charter §3)

- **Public + lawful only.** Only publicly available data, collected lawfully;
  `robots.txt`/ToS/rate limits respected via the guardrail.
- **No private-individual targeting / no mass surveillance.** Gateways operate on
  public signals (domains, infrastructure, filings, breaches yes/no, brand
  mentions), not people's private lives.
- **Breach exposure only.** HIBP-style yes/no — never redistribution of stolen
  credentials.
- **Data minimization / GDPR-aware.** Persistence stores what a task needs;
  deletion is supported through the repository layer.

## 6. Dependencies

- Next.js pinned to a patched 15.x (15.5.22) — the 15.2.4 CVE is resolved (#19).
- `npm run verify` (typecheck + tests + build) gates every change.

## 7. Known limitations (tracked, not hidden)

| Item | Status | Where it lands |
|---|---|---|
| **Distributed rate-limiting on public routes** | The per-source guardrail protects upstreams; there is no per-client (per-IP) limit on the free public intelligence routes yet. An in-memory limiter would not hold across serverless invocations, so it is intentionally **not** shipped as a fake safeguard. | At deploy, backed by the durable store (Postgres/pgmq) or the edge/CDN layer. |
| **CSP `unsafe-inline`/`unsafe-eval`** | Required by the current Next.js runtime and Pi SDK. | Tighten with nonces/hashes when the toolchain allows. |
| **Live DB-dependent flows** | Validated by DI unit tests; not yet run against a provisioned Postgres. | When Supabase is provisioned (deploy). |

## 8. Reporting a vulnerability

Email the maintainer (see the app's contact) with steps to reproduce. Do not
open a public issue for an unpatched vulnerability. We aim to acknowledge within
a few days and to fix on a severity-driven timeline.
