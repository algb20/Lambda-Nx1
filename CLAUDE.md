# Lambda NX — Project Charter & Working Rules

> This file is the durable contract for the project. It is read at the start of
> every session. Follow it exactly. It is the single source of truth for *how* we
> build, independent of any one conversation.

## 1. What this project is

Lambda NX is a **real, legal, open-source-intelligence (OSINT) & intelligence-analysis
platform**. It runs as a Pi Network app (Pi auth + Pi payments) **and** as a fully
independent standalone web app/site (standard auth + standard payments) from the same
codebase.

It is an *analysis* product, not a data dump: its value is in **pivoting, verification,
confidence grading and documentation** — applying real intelligence-analysis method,
not wrapping tools.

The reference domain knowledge lives in `docs/OSINT_REFERENCE.md` (the full 13-chapter,
20-discipline reference). Read it before building any module.

## 2. Governing rules (never violated)

1. **No temporary solutions.** Every point is built *finally*. A module is "done" only
   when it: works for real, is tested with real tests, handles errors and edge cases,
   is documented, and contains **no `TODO`/mock/`Math.random()` placeholders**. See §6.
2. **Comprehensive research, always.** Do not rely only on what the user provides. For
   every area, research the best/newest/strongest option, including things not yet
   noticed. The Radar (`docs/RADAR.md`) automates this continuously.
3. **Our own technology.** We build our own engine, algorithms, storage and analysis —
   not a thin wrapper over someone else's product. Inspire from the best, then build
   stronger in our own way.
4. **Safe portability (no lock-in).** Every external provider sits behind an interface
   we own, so we can swap **database (Supabase↔any Postgres), hosting (Netlify↔Vercel↔
   self-host), and Pi-vs-standalone auth/payments** with a provider switch only — never
   an app rewrite. See `docs/ARCHITECTURE.md`.
5. **Living task list.** The master checklist is tracked in the task tool and mirrored in
   `docs/PLAN.md`. Update it on every step. Never skip a point or a test.

## 3. Hard legal & ethical guardrails (enforced in code)

These are non-negotiable and match the reference's law/ethics chapters.

- **Passive only.** OSINT never touches the target. The engine must never send a packet
  to a target host (no port scans, no nmap, no active probing). Sources are read-only
  public endpoints. This is enforced centrally (see task P2 guardrail module).
- **Public + lawful only.** Only publicly available data, collected lawfully. Availability
  is not permission. Respect `robots.txt`, terms of service, and rate limits.
- **No private-individual targeting / no mass personal surveillance / no stalking.** The
  product monitors *public signals* (domains, infrastructure, breaches, brand mentions)
  on demand — not people's private lives.
- **Data minimization & GDPR-aware.** Store only what a task needs; document purpose;
  support deletion.
- **No breach-data hoarding.** Breach *exposure* checks only (HIBP-style yes/no), never
  redistribution of stolen credentials.

If a request would cross these lines, stop and raise it with the user.

## 4. Architecture (summary — full detail in docs/ARCHITECTURE.md)

- **Frontend:** Next.js 15 + React 19 + Tailwind + shadcn/ui (from the existing app).
- **Data:** Postgres via **Drizzle ORM**, schema as **versioned migrations in the repo**.
- **Isolation layers (mandatory):** `lib/db`, `lib/auth`, `lib/payments`, `lib/storage`,
  `lib/queue`, and the OSINT `lib/engine` source-adapter layer. App code calls these
  interfaces only — never a vendor SDK directly.
- **Engine:** our own source-adapter framework with multi-source redundancy/fallback,
  our own cache/archive, and the analysis core (entities, pivots, confidence, Admiralty
  code, evidence model).
- **Hosting default:** Netlify (keeps the already-verified Pi domain + existing Pi payment
  functions) + Supabase (Postgres/auth/storage/cron/queue). Swappable per rule #4.

## 5. Git & workflow

- Develop on branch `claude/bittorent-network-app-c8j9pv`. Create locally if missing.
- Commit in clear, self-contained units with descriptive messages. Push to that branch
  when a unit is complete. Never push to another branch without explicit permission.
- Never commit secrets. All keys (`PI_API_KEY`, DB URLs, etc.) are environment variables.

## 6. Definition of Done (per module)

- [ ] Real implementation — no mock data, no `Math.random()`, no stubbed returns.
- [ ] Behind the correct isolation layer (no direct vendor calls in app code).
- [ ] Passive-only + legal guardrails respected.
- [ ] Error handling + rate limiting + multi-source fallback.
- [ ] Real tests (unit + integration against live keyless endpoints) pass.
- [ ] Findings carry source link, timestamp, Admiralty rating, confidence grade.
- [ ] Documented (what it does, sources used, limits).
- [ ] Task marked complete in the living list.
