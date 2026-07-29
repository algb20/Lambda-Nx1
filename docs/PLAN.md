# Living Plan — Lambda NX

The authoritative checklist is the task tool. This mirrors it for humans. Keep both in
sync; never skip a point or a test.

## Method (every task)

**Research → Plan → Build → Test (real) → Document → mark done.** Definition of Done is in
`CLAUDE.md` §6.

## Phases

### P0 — Foundation  *(done)*
- [x] Master task list created (17 tasks)
- [x] Charter + architecture + plan + radar + sources docs
- [x] Committed & pushed to branch

### P1 — Skeleton & isolation layers  *(in progress)*
- [x] Migrate real Next.js app into repo; delete all mock (`Math.random`) engine + false ML docs (build + typecheck pass)
- [x] Postgres schema (Drizzle migrations, `db/migrations/0000_init.sql`, 10 tables) + `lib/db` repository layer
- [x] Adapter layers: `lib/auth`, `lib/payments`, `lib/storage`, `lib/queue` (ports + real default impls + env registry)
- [ ] Clean fabricated status badges in `user-preferences` (task #17)
- [ ] Upgrade Next.js off 15.2.4 (CVE) — hardening

### P2 — Core engine  *(done)*
- [x] Source-adapter framework: `Source` port + registry + orchestrator with multi-source fallback
- [x] Analysis core: pivot graph, confidence grading, Admiralty code, evidence de-dup (`lib/engine/analysis.ts`)
- [x] Passive-only guardrail (allowlist + read-only + rate limit) — active probing impossible by construction
- [x] Test infra (vitest) + 17 engine tests pass; typecheck + build clean
- [ ] Our cache/archive of raw results (wired when Module 1 sources persist scans via lib/db, P3)

### P3 — Module 1: Domain / Infrastructure intel (keyless, real)  *(done)*
- [x] Sources: DoH DNS (Cloudflare+Google), RDAP, crt.sh, Wayback CDX, urlscan, Shodan InternetDB — all passive/keyless
- [x] `investigateDomain()` → sectioned DomainReport (sources + timestamps + Admiralty + confidence + pivot graph)
- [x] API route `POST /api/intelligence/domain` + real domain-investigator UI
- [x] 21 tests pass (+1 live, RUN_LIVE-gated); typecheck + build clean
- Note: live provider calls are egress-allowlisted in the build sandbox; they run at deploy time.

### P4 — Radar (continuous research & monitoring)
- [ ] Scheduled jobs; watch public tool/technique sources (internal) + user targets (product)
- [ ] Knowledge base with confidence-graded findings

### P5 — Pi + standalone
- [ ] Pi auth + Pi payments via adapters (Pi Browser)
- [ ] Standalone auth + standard payments via same adapters

### P6 — More modules
- [ ] Module 2: Email/Username footprint
- [ ] Module 3: Media/content verification
- [ ] Module 4: Monitoring & alerts

### P7 — Finalize
- [ ] E2E tests, security review, build, deploy, Pi App Studio zip (every point verified)

## Open decisions (defaults chosen; user may override)
- Hosting: **Netlify + Supabase** (least disruption to verified Pi domain). 
- Supabase project: create when P1 DB work starts (not before).
- First module: **Domain/Infrastructure** (strongest keyless base).
