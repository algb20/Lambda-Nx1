# Work plan — R328 (2026-10-08)

| | |
|---|---|
| **Request** | R328: «اعمل خطة لعملك وكل المطلوب والملفات والأهداف والطبقات وكل ما يلزم لتحقيقه، ثم ابدأ عملك دون توقف … واعمل بحثك وآخر تطورات مجالنا والمشاريع المشابهة … واحتفظ بكل ما لم نكمله من المفاتيح أو المتغيرات وغيرها» |
| **Governs** | Repository work only. The Master Blueprint governs the target; this plan schedules what CLAUDE.md lets Claude do now (§0, §2 rule 2, §9 lanes). |
| **Status words** | As CLAUDE.md §0. "Done" in this file means REPO-PRESENT + REPO-TESTED at most. |
| **Living lists** | Owner items: `PENDING_OWNER_ITEMS.md`. Gaps: `SOURCE_LICENSING_GAP_AUDIT_2026-10-05.md` §2, `COMPATIBILITY_GAP_LEDGER.md`. Requests: `docs/ledger/REQUESTS.md`. |

Format follows CLAUDE.md §8: SCOPE → REQUIREMENTS → DEPENDENCIES → CONTRACTS → IMPACT → IMPLEMENTATION → TESTS → ACCEPTANCE → STATUS.

## 1. Scope — the goal, in one paragraph

A real, lawful, multi-gateway intelligence platform (CLAUDE.md §1): one engine, many gateways (OSINT, CTI, finance/sanctions/corporate, geospatial/transport, news, markets, research), an AI analyst that sorts and never verifies, running as a Pi app and as a standalone site from one codebase. Every finding carries its source link, time, Admiralty rating, confidence and the credit its licence asks for. Every source runs only if its licence allows it, and only passively.

## 2. Layers — what exists, where it lives, what is open

| # | Layer | Files | State (evidence class) | Open |
|---|---|---|---|---|
| L1 | **Interface** (Next.js 15 shell, shadcn/ui, tabs, globe) | `app/`, `components/` | REPO-PRESENT, REPO-TESTED (`npm run test:ui` 13/13, R327) | Design preserved; no redesign (§2 rule 7) |
| L2 | **HTTP API** | `app/api/*` (35 route groups incl. `mcp`) | REPO-PRESENT, REPO-TESTED | Distributed rate limiting needs a durable store at deploy (PLAN P7) |
| L3 | **Isolation ports** | `lib/db`, `lib/auth`, `lib/payments`, `lib/storage`, `lib/queue`, `lib/mail`, `lib/ai` | REPO-PRESENT, REPO-TESTED | Provider values are owner environment items (§B of the pending list) |
| L4 | **Guardrail** (passive only, host allow-list, spacing) | `lib/engine/guardrail.ts`, `fetch-guard.ts`, `host-budget.ts` | REPO-TESTED | GL-05: licence policy enforced by test, not at runtime — **Blueprint change BC-2, owner approval (C8)** |
| L5 | **Coded sources** | `lib/engine/sources/*` (64 files) | REPO-TESTED; live probe R327: 193/199 runs ok | Keys in the environment (§A of the pending list) |
| L6 | **Catalogue** (feeds, quarantine, credits, provenance) | `lib/engine/catalog/*`, `feeds/*` (13 files) | REPO-TESTED; live audit R326 | Quarantined sources; 74 unreadable terms pages |
| L7 | **Licence & usage registry** | `lib/engine/licensing/*` (367 records), `npm run check:terms` | REPO-TESTED | GL-07 retention, GL-08 AI use (C2), GL-09 fallbacks |
| L8 | **Registries** (CKAN portals) | `lib/engine/registries/*` | REPO-TESTED | GL-11: US key, PT udata (C4) |
| L9 | **Analysis core** (entities, pivots, confidence, Admiralty, de-dup) | `lib/engine/analysis.ts`, `lib/analysis`, `lib/graph` | REPO-TESTED | Verification-ladder crosswalk waits for 30.27.8.S (R302) |
| L10 | **Gateways / modules** | `lib/modules/*` | REPO-TESTED | New gateways need a Master specification |
| L11 | **Export / share / publish** | `lib/export`, `lib/social`, `app/api/publish` | REPO-TESTED; credits in exports (R324) | **Publication paused** until 30.27.8.R closes (R294) |
| L12 | **Ops / cron / radar** | `lib/ops`, `lib/cron`, `lib/radar` | REPO-TESTED | `publish` stays UNSCHEDULED (test-enforced) |
| L13 | **Conformance** | `lib/conformance/*` | REPO-TESTED | Grows with each invariant |
| L14 | **Deployment** | `netlify.toml`, `next.config.mjs` | LIVE-OBSERVED 2026-10-04 | Production locked on `9c19303` (R306) |

Target layers (Intelligence Core, World Model, Forecast layer, Policy Engine, Source Control Plane) are Master matters: they are coded only from a closed implementation package (CLAUDE.md §9, Implementation lane). Phase 30 is NOT COMPLETE; Phase 31 is BLOCKED.

## 3. Requirements and boundaries that apply to every step

- Passive, public, lawful only; no private-individual targeting (CLAUDE.md §3).
- No secret in any file (owner S2). Keys are named in `PENDING_OWNER_ITEMS.md` §A and `.env.example`, never valued.
- Licence rules R317: absence of restriction is not verification; restricted terms withhold; unclear sources keep running under review.
- A refusal (403, bot challenge) is the operator's terms. It is recorded, never bypassed.
- Repairs use a **verified official replacement** only. A new source is an adoption decision: reported as DISCOVERED, not added (§2 rule 2).
- No Production change, no live database write, no PR, no push to another branch without the owner.

## 4. Order of work

Each wave is one maintenance batch: REPRODUCE → ROOT CAUSE → PATCH → TEST → REGRESSION TEST → VERIFY → REPORT, then commit and push.

| Wave | Batch | Work | Lane | Acceptance (repository) |
|---|---|---|---|---|
| **W1** | 20 | This plan; ledger R328 | Audit | File present, ledger entry |
| **W2** | 20 | `cdc_outbreaks`: frozen COVID feed → CDC's own current outbreak feed (verified on CDC's syndication catalogue) | Maintenance | Test on a real sample; quarantine entry removed; registry URL updated |
| **W3** | 20 | Field research 2026: latest developments in the field and comparable platforms, read from their own artefacts | Audit (research) | `docs/RESEARCH/FIELD_2026-10-08.md`, findings labelled DISCOVERED |
| **W4** | 20 | Re-probe every quarantined source; release only on evidence | Maintenance | Quarantine test passes; each change dated |
| **W5** | 21 | The 74 unreadable terms pages: find the provider's own readable copy (PDF, alternate host, API docs) | Audit | `check:terms` counts improve; no status upgraded without a quote |
| **W6** | 22 | GL-09 fallbacks: for each critical capability, a candidate from a different independence group, licence read | Audit (research) | Candidates DISCOVERED in the gap audit; none adopted |
| **W7** | 23 | 30.27.8.S preparation: cross-contract consistency inventory from the repository side | Audit | Inconsistencies recorded, not resolved by choosing (§7) |
| **W8** | ongoing | Re-run `check:terms` and the live feed audit; repair what moved | Maintenance | One batch per run |

Waves after W8 wait on owner decisions (§5) or on a closed Master package.

## 5. What only the owner can unblock

Kept in full in `PENDING_OWNER_ITEMS.md`, and that file is updated in every batch:
- **§A keys:** `OPENALEX_API_KEY`, `NASA_API_KEY`, `EIA_API_KEY`, `OPENAQ_API_KEY`, `ENTSO_E_TOKEN`, `COPERNICUS_TOKEN`, `EPO_OPS_KEY`, `GOOGLE_FACTCHECK_KEY`, `SAM_GOV_API_KEY`, `USGS_M2M_TOKEN`, `USPTO_ODP_KEY`, `WORLDBANK_API_KEY`, `COMPANIES_HOUSE_API_KEY` (after C5), the api.data.gov key; `RELIEFWEB_APPNAME` and `GFW_API_TOKEN` are pointless under their licences.
- **§B platform variables:** core secrets, providers, Pi, Stripe, mail, AI analyst, translation, `ENGINE_CONTACT`.
- **§C decisions C1–C9**, **§D permissions D1–D8**, **§E live writes E1–E2**, **§G repository action G1** (merge to `main`, closes Dependabot #15).

## 6. Status

| Wave | Status |
|---|---|
| W1–W4 | Done (batch 20) |
| W5 | Done (batch 21): 12 records decided; ~20 still unreadable, listed |
| W6 | Done (batch 22): candidates DISCOVERED; owner C11 |
| W7 | Done (batch 23): invariant matrix refreshed; invariant 14 fixed and tested |
| W8 | Ongoing |
