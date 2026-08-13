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
- [x] Clean fabricated status badges in `user-preferences` (task #17)
- [x] Upgrade Next.js off 15.2.4 (CVE) — hardening (#19: 15.2.4 → 15.5.22)

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

### P4 — Radar (continuous research & monitoring)  *(both halves built)*
- [x] Change detection: domain fingerprint + precise diff (subdomains/IPs/nameservers/registrar)
- [x] Scheduler: `runDueMonitors` (dependency-injected) + real wiring `runRadarSweep` over repo+engine
- [x] Knowledge base: internal feed ingest with de-dup; product findings on change
- [x] Internal half now actually reads: the curated ⭐ watchlist sweep (#44, see P8)
- [x] Queue job `radar.run` registered (runs both halves via `runFullRadar`)
- [x] Monitor-management UI + API — shipped with #15 (monitors CRUD + alerts feed + manager UI)
- [ ] Durable scheduler (pg_cron/pgmq) — at deploy (P7)

### P5 — Pi + standalone  *(done)*
- [x] Our own signed sessions (HMAC) — independent of the App Studio backend
- [x] Pi auth wired: `/api/auth/pi` (verify Pi token → upsert user → session); pi-auth-context uses it
- [x] Pi payments wired: `/api/payments` via lib/payments (auth-gated)
- [x] Persistence: signed-in domain investigations archived to DB (investigation/entities/links/evidence)
- [x] Standalone auth backend: `/api/auth/register` + `/api/auth/login` (scrypt, first-party)
- [x] Standalone UI shell + standard payment gateway (Stripe) — task #20

### P6 — More modules
- [x] Module 2: Email/Username footprint (3 sources + multi-mode UI + tests)
- [x] Module 3: Media/content verification (local EXIF via exifr + GPS + AI hints + reverse links + UI)
- [x] Module 4: Monitoring & alerts — monitors CRUD API + alerts feed + radar-run (cron-guarded) + manager UI

### P7 — Finalize  *(in progress)*
- [x] Readiness probe: `lib/modules/health` (config-only, no secrets leaked) + `GET /api/health` (503 when a required check fails) + tests
- [x] Deploy config: `netlify.toml` (Next runtime + Pi functions + Node 22 + security headers/CSP)
- [x] Release packager: `scripts/package.mjs` (`npm run package`) — clean source zip + manifest, **hard-fails on any secret file/secret-shaped content**
- [x] E2E smoke test: `scripts/smoke.mjs` — boots the built server, verifies shell render + health shape/code + plans + auth-gating (analyst 401) + radar guard (503). Ran green against a live instance.
- [x] Deploy runbook: `docs/DEPLOY.md` (Supabase migrations, env matrix, Netlify Pi + standalone, Pi App Studio registration, post-deploy verify, rollback, provider swaps)
- [x] `npm run verify` = typecheck + test + build gate
- [x] Security review pass: secret scan (clean), guardrail audit, per-route authz audit (removed 2 dead stub routes, renamed misleading "Swarm"→"Monitor"), portable security headers in `next.config.mjs` (CSP/HSTS/XFO/… verified on live responses), full posture in `docs/SECURITY.md`
- [ ] Live deploy to Netlify + Supabase provisioning (needs user infra/credentials)
- [ ] Distributed rate-limiting on public routes (needs durable store at deploy; per-source guardrail already protects upstreams — see SECURITY.md §7)

### P8 — More gateways (multi-gateway vision; see docs/GATEWAYS.md)
- [x] Threat Intelligence (CTI): Feodo/URLhaus/ThreatFox + module + API + UI mode + tests
- [x] Financial / Sanctions / Corporate: OpenSanctions/GLEIF/mempool + module + API + UI + tests (migration 0003 adds company/person entity types)
- [x] AI-analyst layer (#24): `lib/ai` (Claude provider behind a swappable port) + `lib/modules/analyst` + auth-gated `POST /api/analyst` + "Analyze with AI" panel over every report + tests. Sorts, never verifies; degrades gracefully with no key.
- [x] Markets & Economy (#26): CoinGecko (crypto) + SEC EDGAR (filings) + Frankfurter/ECB (FX) → `lib/modules/markets` + `POST /api/intelligence/markets` + Markets UI mode + tests. Reports the market as it is; never predicts. See `docs/FORESIGHT.md`.
- [x] Procurement & Public Contracts (#29): USAspending.gov + World Bank projects → `lib/modules/procurement` + `POST /api/intelligence/procurement` + Contracts UI mode + tests. "Who receives public money/contracts" from official published records. See `docs/LANDSCAPE.md`.
- [x] Ownership & control networks (#30): GLEIF Level-2 relationships → `lib/modules/ownership` (resolves name→LEI, maps parents/ultimate/subsidiaries into a graded control graph) + `POST /api/intelligence/ownership` + Ownership UI mode (control map) + tests.
- [x] News & Signals (#31): GDELT (topic coverage) + Wikipedia "In the news" (top events) + USGS earthquakes (live, geolocated, A/1 confirmed — plots at exact epicentre on the globe via `pointsFromEvidence`) → `lib/modules/news` + `POST /api/intelligence/news` (empty = top events) + live auto-refreshing News UI mode + tests. Signals, not reprint; links to origin; graded honestly. See `docs/NEWS.md`.
- [x] Markets Board (#32): live multi-class overview — top crypto (CoinGecko), commodities/raw materials + stock indices (Stooq), key FX (ECB) → `lib/modules/markets-board` + `POST /api/intelligence/board` + live auto-refreshing "Board" UI mode (grouped, colored change) + tests. Quotes as published, never predicted; AI analyst can triage it.
- [x] Nexus — unified investigation (#33, flagship innovation): one query → classify selector → fan out across every relevant gateway in parallel → fused graded dossier + pivot graph. Speed layer: per-task timeout, short-TTL cache (instant repeats), per-section latency surfaced. `lib/modules/nexus` + `POST /api/intelligence/nexus` + default "Unified" UI mode + tests. See `docs/INNOVATIONS.md`.
- [x] i18n foundation (#34): `lib/i18n` provider (locale + RTL + dictionaries, en+ar), header language switcher, wired into header/feed/ideas. English fallback; any language addable by dropping in a dictionary. Full-string coverage tracked as follow-up.
- [x] Target Tracking (#36, flagship): radar-per-target separating identity (static) / timeline (live past→now) / horizon (published forward-looking) / signature (our correlation). Streamed over an always-open SSE door (no polling): `lib/stream/sse` + `lib/modules/target` + `GET /api/track` + live "Track" UI (EventSource, auto-reconnect) + tests. No fabricated predictions. See `docs/TRACKING.md`. Next: deltas + event-driven push + Radar ingestion + calibration.
- [x] Suggestions engine (#35, innovation): community feedback loop — submit ideas (any language) → AI-triage (kind/impact/effort/sentiment/summary/tags) → auto-cluster near-duplicates → rank clusters by impact × influence × demand. Schema (migration 0004) + `repo.suggestions` + `lib/ai/suggestions` (Claude + heuristic fallback) + `lib/modules/suggestions` (pure rank/cluster, DI) + `POST/GET /api/suggestions` + vote + "Ideas" UI tab + tests. Influence weighting + tier gating land with #25.
- [x] Geospatial / Transport (#23): Nominatim/OpenStreetMap (geocode place + reverse-geocode coords) + OpenSky (live public flight state by ICAO24) → `lib/modules/geo` + `POST /api/intelligence/geo` + "Geo" UI mode + tests. Passive/public only; no private-individual tracking. Next: maritime (AIS), Overpass features, real-estate overlay.
- [x] Research & Tech-trend + Macro/Economy (#27): Research gateway = OpenAlex + Crossref (papers) + arXiv (preprint frontier, keyless Atom API, dependency-free XML reader) + GitHub (tech-trend repos) + Hacker News (keyless Algolia; industry/community discussion signal) → `lib/modules/research` + `POST /api/intelligence/research` + "Research" UI mode. Macro/economy = World Bank indicators (GDP/population/inflation) folded into the Markets gateway (self-filtering `economy` source). Tests. Remaining (own follow-up): patents (USPTO/EPO), pointing the automated Radar at the ⭐ feeds.
- [x] Calibration ledger (#28): `calibration_claims` (migration 0006) + `repo.calibration` + `lib/modules/calibration` — record attributed claims (ours/external) with a horizon, resolve them by outcome, and compute an honest weighted scoreboard (accuracy overall, by author, by confidence band — including our own misses). `forecastsFromHorizon` feeds it from the target tracker. `POST/GET /api/calibration` + `/resolve`. DI + tests.
  - Auto-capture wired: the **target tracker** best-effort records its published horizon items as tracked claims (when DB configured); `dueForReview` + `GET /api/calibration/due` surface claims whose horizon passed for scoring — we never fabricate an outcome. Next: a public scoreboard UI + scheduled resolution reminders.
- [x] Technology Radar (#36): `docs/TECH_RADAR.md` — adopt/trial/assess/hold rings with a per-item decision for Lambda NX, a prioritized source library, and the weekly review cadence. North Star = Palantir Ontology *thinking*.
- [x] Reference / knowledge-base gateway (#43): `wikidata` source (capability `reference`) resolves a name → QID → typed facts (parent org, founder, CEO, country, HQ, coordinates), batch-resolving referenced entities' labels. New ontology predicates `located_in`/`founded_by`/`led_by`; wired into the **Nexus** entity plan so every entity investigation now enriches the ontology with real structured relations (and a precise globe pin from P625). Now a **first-class gateway**: `lib/modules/reference` + `POST /api/intelligence/reference` + "Facts" UI mode (facts + relations + globe). The Nexus dossier also plots all geolocated evidence on the globe. Tests cover source extraction, ontology mapping and the module. Keyless, graded B/2.
- [x] Ontology layer (#37, foundation): `lib/engine/ontology.ts` — a controlled relation vocabulary (predicates) + `buildOntology` that maps evidence into typed subject→predicate→object edges, merges the same entity across gateways into ONE node, dedupes edges with accumulated provenance, and grades each by corroboration. Wired into the Nexus dossier (`ontology`) + an Ontology UI card + tests.
- [x] Ontology persistence & query (#39): `lib/modules/ontology-store.ts` — persist an ontology to `entities/entity_links` (predicate = relation), load it back as a traversable graph, and pure `neighbors`/`subgraph` (BFS) queries. `GET /api/ontology` (auth + db-gated) reads a saved investigation's graph and traverses from a node. DI + tests.
- [x] Global knowledge graph / memory (#40): global `ontology_nodes`/`ontology_edges` (migration 0005) deduped by (type,value)/(from,to,predicate), accumulating mentions + evidence + last-seen. `repo.ontology` + `lib/modules/ontology-global` (`mergeOntology`/`globalNeighbors`, DI). Nexus best-effort merges each run into the shared graph (when DB configured); `GET /api/ontology/global?type=&value=` reads an entity's accumulated neighborhood. Tests prove dedup + accumulation. The platform now *remembers* — foundation for self-improvement.
- [x] Automated Radar over the ⭐ feeds (#44, closes the last piece of #27/#36): new `watch`
  capability + `lib/engine/feedxml` (our own dependency-free RSS/Atom reader, now also
  backing the arXiv research source) + four watch sources — **CISA KEV** (exploited in the
  wild, A/1 confirmed), **CISA advisories** (A/2), **Hugging Face daily papers** and
  **arXiv cs.CR/cs.AI/cs.LG/cs.DC** (C/3, labelled `[preprint]`). Curated watchlist with a
  written rationale per feed (`lib/radar/watchlist.ts`, integrity-tested against the
  registered sources), an idempotent DI sweep (`lib/radar/watch.ts`) that de-duplicates by
  item identity and reports per-feed failures instead of aborting, `runFullRadar` +
  `POST /api/radar/run?half=monitors|watch` (separate cadences), auth-gated
  `GET /api/radar/findings`, and a knowledge-base panel in the Radar tab. Migration `0008`
  adds Admiralty rating + feed provenance to `radar_findings`. 24 offline tests + a
  RUN_LIVE end-to-end sweep. Feeds deliberately *not* automated (lab blogs, standards
  corpora, Semantic Scholar/PwC/OpenReview) are named with reasons in `docs/RADAR.md`.
- [x] Subscription tiers free/paid (#25) — plans + gating, with one-place price control
- Note: guardrail now allows provider POST (allowlist remains the passive guarantee).


## Wave 2 — the surfaces the product is judged on

- [x] **World atlas + globe/map toggle (#54).** Our own country-outline dataset,
  generated by `scripts/build-world-atlas.mjs` from Natural Earth (public domain):
  Ramer–Douglas–Peucker at 0.28°, antimeridian-split, ~1 km precision — 177
  countries in 68 KB, committed, so the map draws offline with no map SDK and no
  tile server. `lib/geo/projection.ts` holds both projections as pure functions
  and `components/world-surface.tsx` renders through them, so the 3D globe and
  the flat equirectangular map are one renderer with a different transform.
  Equirectangular over Mercator deliberately: latitude stays linear, so no region
  is inflated to several times its true size. Also closes a quiet data loss —
  country centroids were a hand-typed table of ~65 countries, so signals from the
  other ~110 vanished; they are now derived from the outlines themselves, with an
  interior-point fallback for concave shapes.
- [x] **The globe as a live operations surface (#55).** New `world_events`
  capability (NASA EONET hazards, USGS M2.5+ seismic) joined with the news
  gateway in `lib/modules/world-events.ts` → `GET /api/world`. Severity is derived
  **only** from a real measurement (magnitude, burnt area, tsunami flag);
  everything else scores zero and does not pulse. Events with no coordinate are
  listed beside the map rather than dropped or plotted at a guess. Click any
  point for its source, timestamp and Admiralty rating; filter by category;
  refreshes only while the tab is visible.
- [x] **Pi Network username sign-in (#56).** A Pi username is never *registered* —
  a public username is not proof of identity. It is **claimed**: a Pi-SDK-verified
  user sets a passphrase, and the server reads the username from the verified
  session, never from the request body. Sign-in takes one field that accepts
  either an email or a Pi username, and every failure returns one identical
  message so the endpoint cannot enumerate which Pi users have accounts here.
  Migration `0011`.
- [x] **Social publishing dashboard (#57).** `/admin/social` — link channels and
  control auto-publishing. Only platforms we can actually deliver to are offered
  (Discord, Slack, generic webhooks, Telegram Bot API); the ones needing an
  approved OAuth app are named and explained rather than shown as dead buttons.
  Three independent switches per channel (enabled / auto-publish / kind filter),
  auto-publish off by default, unlisted posts never broadcast, real test sends,
  and per-channel delivery counts and last error. `safeWebhookUrl` refuses
  non-public https targets (SSRF), and a Telegram token is AES-256-GCM encrypted
  under `SOCIAL_SECRET_KEY` — with no key the route refuses to store it rather
  than falling back to plaintext. Migration `0012`, RLS-locked.
- [x] **Trending board (#58).** Three lanes from three kinds of source —
  attention (real view counts), events (measured and located), and a new
  **blockchain radar**: chain tip, mempool depth and next-block fee from
  mempool.space, market structure from CoinGecko global, plus the day's real
  movers. Congestion is derived from the next-block fee on a log scale. Each lane
  loads independently and hides itself if its feed is down.
- [x] **Floating idea button (#59).** On every product screen, posting into the
  same `/api/suggestions` pipeline as the Ideas panel — a second door onto the
  existing room, not a parallel one.
- [x] **Green app icon.** The λ in emerald on the world surface's navy, fixed in
  both colour schemes, plus the icon/manifest declarations that were missing
  entirely (every page load was taking a favicon 404).

## Launch readiness (#70)

The audit before launch found four gaps. All four are closed.

- [x] **Anyone can create an account.** The app ships in Pi mode, where becoming
  a user required the Pi SDK handshake — which completes *only* inside the Pi
  Browser. In an ordinary browser the product worked (gateways are open, charter
  §1) but no path to an account existed anywhere in the interface: registration
  was an API route and a gate that mode never renders. **That, and not lack of
  interest, is why the `users` table was empty.** The form now lives in
  Preferences → Account in both modes, blocking nothing, and moved to
  `components/auth-form.tsx` so the gate and the panel share one implementation
  rather than two that drift — and the one that drifts is a security control.
- [x] **Account deletion (GDPR art. 17).** `DELETE /api/account`, immediate, no
  soft delete. Rows that *are* the person cascade; rows merely *authored by*
  them (posts, suggestions, country counters) detach with `set null`, so a
  deletion neither retracts what others are reading nor leaves a name on it. The
  avatar leaves object storage first, since storage has no foreign keys and the
  row about to be deleted is its only handle.
- [x] **Privacy and terms** (`/privacy`, `/terms`), written from the code: one
  cookie, no IP stored, no third-party analytics, passive-only collection, EU
  storage, self-service erasure — and the honest limit that a finding is a lead
  with an evidence trail, not a verdict.
- [x] **Rate limit on the open API**, as middleware rather than the same guard
  copied into twenty routes, so a gateway added later is covered the day it is
  written. It protects the *providers'* goodwill — NASA, USGS, Wikipedia, CISA
  rate-limit Lambda, not the visitor, so one looping client empties the map for
  everyone. Cron, auth, the visit beacon and the health check are exempt for
  stated reasons, and `middleware.test.ts` re-parses the matcher so a pattern
  that stops covering a route fails the build instead of the provider
  relationship. Its known ceiling is stated in the module: in-memory, therefore
  per instance.

## Deferred ledger (intentional — nothing forgotten)

Everything marked "done" is real and tested for its layer. These are the pieces
deliberately deferred to their correct phase (dependency ordering) or to deploy.

| Item | Why deferred | Where it lands |
|---|---|---|
| Live network calls to sources | build sandbox egress allowlist | at deploy (or allowlist hosts) |
| Live DB run of DB-dependent flows | no Supabase project provisioned yet | when DB provisioned / deploy |
| Identity (username/email) persistence | only domain persists today | follow-up |
| Durable radar scheduler (pg_cron/pgmq) | needs live DB/cron; POST /api/radar/run is ready | deploy (#16) |
| Object-store storage provider | filesystem is the dev default | deploy |
| Standalone UI shell + Stripe payments | DONE — email/password login gate (NEXT_PUBLIC_AUTH_MODE=standalone) + Stripe provider | ✅ #20 |
| OAuth standalone provider | email/password shipped | future |
| Next.js upgrade (CVE) | DONE — 15.2.4 → 15.5.22 (latest 15.x, patched); typecheck+build+tests green | ✅ #19 |
| Deploy readiness (#16) | DONE — /api/health probe, netlify.toml, `npm run package` (secret-guarded zip), `scripts/smoke.mjs` E2E, docs/DEPLOY.md runbook, security review + docs/SECURITY.md, portable headers | ✅ #16 |
| Live cloud provisioning | needs the user's Netlify + Supabase + Pi Portal accounts/credentials (not code) | handoff — follow docs/DEPLOY.md |

## Open decisions (defaults chosen; user may override)
- Hosting: **Netlify + Supabase** (least disruption to verified Pi domain).
- First module shipped: **Domain/Infrastructure**; then **Email/Username**.
