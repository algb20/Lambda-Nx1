# Build plan — R338 (2026-10-09)

| | |
|---|---|
| **Request** | R338 «اكمل كل الباقي … وأيضًا الصفحات الأخرى وليس الرئيسية فقط، وأيضًا التصميم … لأن التصميم والترتيب الحالي غير مقبول» |
| **Owner decisions in force** | D1–D8 adopted as proposed (R338). Design-preservation rule superseded by the reference design (R338). C12 no retry; C14 conditional GET (R335). Keys and environment values supplied by the owner at the end. |
| **Still in force** | Production locked (R306); publication paused (R294); passive and lawful only (§3); no secret in any file (S2); every number on screen is real or computed, and says what it is. |
| **Status words** | As CLAUDE.md §0. A unit is "done" here at REPO-PRESENT + REPO-TESTED. |

## Track D — design, applied to every page

The reference is the owner's two images (2026-10-09). Their content is a **layout**, not data: no figure in them is copied. Each slot is filled from a real source, or shows an explicit "no data yet" state that names what is missing.

| Unit | Scope | Real data behind it |
|---|---|---|
| **D-1** | Design tokens (deep navy, blue primary, severity colours) and a new shell: grouped sidebar, header (search, UTC clock, alerts, theme, account), category strip, mobile bar | — |
| **D-2** | Home dashboard (described below) | `/api/world`, `/api/brief`, `/api/intelligence/board`, `/api/diagnose`, `/api/alerts`, `/api/monitors`, World Bank series, `/api/analyst` |
| **D-3** | Every other page re-laid in the new shell: Global Intelligence (gateways), Situations & Alerts, Monitoring & Watchlist, Maps & Geospatial, Data & Analytics (markets), Research (feed), Risks (country risk), Knowledge Base, Settings, plus pricing, terms and privacy | existing modules |
| **D-4** | Welcome / first-run screen and phone layout from the second image | — |
| **D-5** | Browser walkthrough (desktop and 360 px phone, light and dark); `test:ui`; screenshots in the batch record | — |

**What the Home dashboard contains:**
- KPI row: active situations, critical alerts, watchlist items, risks.
- Layered map: Physical, Human, Economic, Technology, Natural, Digital, Space and Intelligence layers, mapped to existing world layers.
- Latest intelligence feed.
- Key global indicators.
- Top watchlist.
- Global risks.
- Intelligence health: coverage, source health, freshness.
- Global time.
- Global overview.
- Key trends.
- Active situations.
- AI assistant.

**Slots with no source yet** are shown as named gaps, never as invented numbers:
- "Opportunities";
- "Decisions";
- "Forecast & Scenarios" beyond the calibration ledger;
- "Workspace".

Each becomes real when its Track M unit lands.

**Percentages.** Percentages appear only for measured rates, such as share of sources healthy or forecast accuracy. A confidence or support score is never written as a percentage (S invariant 14; batch 23).

## Track M — Master subsystems, from the decided contracts

Order follows the dependency roots of `PHASE30_CLOSURE_AUDIT` §D. Each unit gets a task sheet in Build Package §53 form before code (`docs/reconciliation/tasks/`).

| Unit | Contract (decided) | Builds |
|---|---|---|
| **M-1** | D2, D3; Build §9 | Additive canonical layer, alongside the 24 application tables (D3). Canonical object envelope, provenance, quality, uncertainty and time semantics. Versioned migration; nothing existing altered. |
| **M-2** | D5, D8; Build §19–§20 | Evidence pipeline L0–L7 as gates, on the M-1 envelope. Freshness as an attribute; empty is an observation, never "no event". |
| **M-3** | D6; Build §22, §25 | Situations (stories → situation objects), alerts as monitoring outputs. Feeds the Situations & Alerts page. |
| **M-4** | Build §8 (Phase 29) | Live freshness classes and source synchronisation over the existing sweeps, with late and out-of-order handling. |
| **M-5** | Build §7 (Phase 28) | Technology intelligence: entity, lifecycle, research and patent signals from licence-cleared sources. |
| **M-6** | D6; Build §41 | Forecast and scenario layer: calibrated, point-in-time, never canonical truth, with the calibration ledger as evaluation. |
| **M-7** | Build §10–§15 | API, job, event and error contracts over the canonical layer. Version placement as recorded (D1 RECONSTRUCTED). |

## Order of work

D-1 → D-2 → D-3 → D-4 → D-5, then M-1 → M-7.

Each unit is one commit batch with tests, recorded in `MAINTENANCE_BATCH_NN.md` or a task sheet, pushed to `claude/bittorent-network-app-c8j9pv`.

## Status

| Unit | Status |
|---|---|
| D-1 | REPO-PRESENT + REPO-TESTED (batch 29) |
| D-2 | REPO-PRESENT + REPO-TESTED (batch 29) |
| D-3 | In progress — every section renders in the new frame; thin pages and duplicated inner headings remain |
| Others | Planned |
