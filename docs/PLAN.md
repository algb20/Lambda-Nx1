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

### P2 — Core engine
- [ ] Source-adapter framework + multi-source fallback + our cache/archive
- [ ] Analysis core: entities, pivot graph, confidence, Admiralty code, evidence model
- [ ] Passive-only + legal guardrail policy module (enforced in code)

### P3 — Module 1: Domain / Infrastructure intel (keyless, real)
- [ ] Sources: DoH DNS, RDAP/WHOIS, crt.sh, HTTP tech fingerprint, Wayback CDX, IP geo + Shodan InternetDB, urlscan
- [ ] Report (sources + timestamps + Admiralty + confidence) + real tests

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
