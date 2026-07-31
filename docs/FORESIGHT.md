# Foresight, Calibration & Anti-Bias — how Lambda NX stays honest and improves itself

> This document answers a direct product question: how do we cover markets, wealth,
> crypto, equities, high-tech, labs, partnerships, policy shifts, AI and "what's
> coming" — **without lying, without bias, and without leaning on other people's
> analysis** — and how the platform **measures and improves its own accuracy over
> time**. It is binding design, aligned with `CLAUDE.md` §2–§3.

## 1. The hard line: we report and grade, we never fabricate the future

Lambda NX **does not predict** prices, events or outcomes. Inventing forecasts is
exactly the fantasy we removed (`CLAUDE.md` continuity-of-intent). What we do is real
and lawful:

1. **Report the present** from public data — the Markets gateway (crypto via CoinGecko,
   filings via SEC EDGAR, FX via the ECB/Frankfurter) states facts with source + time.
2. **Track *published* foresight** — when a bank, regulator, company, lab or analyst
   *publicly states* an outlook ("guidance", "target", "projection"), we record it as an
   **attributed claim** with who said it, when, and where — never as our own prediction.
3. **Grade and calibrate** — later, when reality is known, we score those published
   forecasts against what happened. This tells users *whose* foresight has been reliable
   — evidence, not opinion.
4. **Our own analysis** = graded reasoning over evidence (Admiralty code + confidence),
   always reversible to its sources. A conclusion is `possible`/`probable`/`confirmed`,
   never a crystal ball.

## 2. The calibration ledger (self-improvement mechanism) — planned, real

A durable record that closes the loop between a claim and its outcome, so the platform
learns its own strengths and blind spots.

| Field | Meaning |
|---|---|
| `claim` | the statement (ours, or an attributed third-party forecast) |
| `author` | us, or the named external source |
| `assertedAt` | when it was made (immutable) |
| `horizon` | when it should be judged |
| `resolvedAt` / `outcome` | what actually happened, recorded when known |
| `score` | correct / partial / wrong / unresolved |
| `sourceUrl`, `admiralty`, `confidence` | provenance & grade |

From this we compute **hit-rate by author, by topic, by confidence band** — a public,
honest scorecard including *our own* misses. This is the "know our positives, negatives,
errors, gaps, strengths" the charter demands.

**Shipped (#28):** `calibration_claims` (migration 0006) + `repo.calibration` +
`lib/modules/calibration` — `recordClaim` (deduped, attributed, with a horizon),
`resolveClaim` (outcome), and a pure `scoreboard` (weighted accuracy overall / by author /
by confidence; correct=1, partial=0.5, wrong=0). `forecastsFromHorizon` turns a target's
published forward-looking items into external claims to track. `POST/GET /api/calibration`
+ `/resolve`. **Next:** the Radar sweep auto-captures horizons and resolves due claims; a
public scoreboard UI.

## 3. Anti-bias protocol (enforced by method, not vibes)

- **Multi-source or it's unconfirmed.** No single source promotes a claim past
  `possible`. Confidence rises only with independent corroboration (already enforced in
  `lib/engine/analysis.ts`).
- **Primary over secondary.** Prefer the filing, the registry, the on-chain fact, the
  official statement — not someone's summary of it. We never inherit another analyst's
  conclusion; we re-derive from sources.
- **Both sides recorded.** Positive and negative evidence are both stored; a "clean"
  result is "no match found", never a clearance (already the rule in threat/finance).
- **The AI analyst sorts, it does not verify** (`lib/ai`, reference §9) — it can never
  be the sole basis for a confirmed claim.
- **Provenance always.** Every finding carries source link, timestamp, Admiralty rating
  and confidence, so any user can audit and disagree.

## 4. Source & gateway expansion roadmap (keyless-first, lawful)

Breadth is a core requirement. Each row is a passive, public source behind our
source-adapter port; none bypasses the guardrails.

| Domain | Candidate public sources | Capability |
|---|---|---|
| Crypto markets (shipped) | CoinGecko | `market` |
| Equities & disclosures (shipped) | SEC EDGAR full-text | `securities` |
| FX / currencies (shipped) | Frankfurter (ECB) | `fx` |
| Company fundamentals | SEC `data.sec.gov` company-facts (XBRL) | `securities` |
| Macro / economy | World Bank, IMF, OECD, FRED (public series) | `economy` |
| Commodities / energy | EIA open data | `economy` |
| Science & research | OpenAlex, Crossref, arXiv, PubMed | `research` |
| Patents / R&D signals | Google Patents / USPTO, EPO OPS | `research` |
| AI / tech trend signals | GitHub trends, Hugging Face, papers-with-code | `tech_trend` |
| Grants / public funding | NIH/NSF/EU CORDIS award data | `research` |
| Corporate registries | OpenCorporates, GLEIF (have), national registries | `sanctions` |
| Aviation / maritime (geo) | OpenSky, AIS public feeds | `geo` |
| Public sentiment | Wikipedia pageviews, Google Trends, GDELT | `sentiment` |

**Rule:** "secret labs / non-public" activity is covered **only** through its lawful
public footprint (patents, filings, grants, procurement, hiring, publications). We never
target private, non-public information — that is the passive-only guardrail (`CLAUDE.md`
§3), and it is absolute.

## 5. Continuous, automatic operation

The Radar (`lib/radar`, `POST /api/radar/run`) already runs due monitors, detects change
and ingests findings with de-dup. The self-improvement loop extends it: on each sweep it
(a) refreshes tracked subjects, (b) files new attributed forecasts into the ledger, and
(c) resolves any whose horizon has passed. Durable scheduling (pg_cron/pgmq) lands at
deploy (see the deferred ledger in `PLAN.md`).

## 6. Status

- **Shipped:** Markets & Economy gateway (crypto + filings + FX), multi-source, graded,
  passive, tested; AI analyst triages it.
- **Next real builds (tracked, not forgotten):** economy/research/tech-trend sources;
  the calibration-ledger schema + module; forecast-tracking in the Radar sweep.
