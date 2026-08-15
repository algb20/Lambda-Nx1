# What subscribers actually get — obtained by calling, not by reading

Prices are deliberately absent here; they are in `docs/MONETIZATION-FIELD.md`.
This document answers a different and harder question: **what does a paying user
actually receive, and does it work?**

Nothing below is taken from a marketing page. Every capability listed was
obtained from a machine surface the vendor operates — an OpenAPI contract, an
MCP server card, or a sandbox that returns the same response envelope
production does.

---

## The method, because it is reusable and most of it was not obvious

Reading a competitor's product had failed for months: their dashboards are
client-rendered, our fetch executes no JavaScript, and every attempt returned a
shell. Five surfaces changed that, in increasing order of usefulness:

1. **The 404 body.** Their error response carries a `hint` naming the OpenAPI
   spec and the API reference. Error responses are documentation.
2. **`/llms.txt`** — the product described for machines: architecture, counts,
   endpoints, auth, discovery URLs.
3. **`/pricing.md`** — tiers and limits, ending in a JSON block.
4. **`/.well-known/mcp/server-card.json`** — every tool a subscriber's key
   unlocks, with descriptions and input schemas.
5. **`/sandbox/*.json`** — deterministic sample responses that mirror *the exact
   production envelope*, with no auth and no quota.

The fifth is the one that matters most. It means the payload a paying subscriber
receives can be inspected without paying, because the vendor published it
deliberately so integrators could build against it.

**Attempted and refused:** the live API itself. `GET
api.worldmonitor.app/api/resilience/v1/get-resilience-score?countryCode=DE`
answers `401 {"error":"API key required"}`. No account was created and no key was
obtained anywhere, so nothing here describes behaviour behind a login.

---

## World Monitor — the full subscriber surface

### Scale of the API a key unlocks

**216 endpoints across 36 service groups**, counted from their OpenAPI bundle
(2.6 MB, `openapi: 3.1.0`):

| Service | Endpoints | Service | Endpoints |
|---|---|---|---|
| `/api/intelligence` | 31 | `/api/climate` | 6 |
| `/api/economic` | 30 | `/api/consumer-prices` | 6 |
| `/api/market` | 23 | `/api/trade` | 6 |
| `/api/supply-chain` | 22 | `/api/conflict` | 5 |
| `/api/aviation` | 11 | `/api/forecast` | 5 |
| `/api/infrastructure` | 11 | `/api/research` | 4 |
| `/api/company-monitoring` | 10 | `/api/resilience` | 4 |
| `/api/military` | 10 | `/api/scenario` | 3 |

Plus single-purpose services for maritime, sanctions, displacement, health,
cyber, radiation, seismology, wildfire, thermal, imagery, unrest, prediction
markets, webcams, batch and leads.

### The 63 MCP tools, which are the actual Pro product

A Pro key gives one credential over all of them. Grouped by what they do:

**Live measured domains (18)** — `get_market_data`, `get_conflict_events`,
`get_aviation_status`, `get_natural_disasters`, `get_cyber_threats`,
`get_health_signals`, `get_energy_intelligence`, `get_climate_data`,
`get_infrastructure_status`, `get_supply_chain_data`, `get_chokepoint_status`,
`get_radiation_data`, `get_maritime_activity`, `get_airspace`,
`get_displacement_data`, `get_sanctions_data`, `get_positive_events`,
`get_news_intelligence`.

**Economics, deep (10)** — `get_economic_data`, `get_country_macro`,
`get_eu_housing_cycle`, `get_eu_quarterly_gov_debt`,
`get_eu_industrial_production`, `get_consumer_prices`, `get_tariff_trends`,
`get_wto_trade_flows`, `get_food_stocks`, `get_mineral_production`.

**Composed indices and assessment (9)** — `get_country_risk` (CII),
`get_country_brief`, `get_world_brief`, `get_military_posture`,
`get_defense_industrial_base`, `get_china_decision_signals`,
`get_hotspot_escalation`, `get_commodity_geo`, `get_procurement_opportunities`.

**Detection and correlation — the genuinely hard ones (8)** —
`get_signal_convergence` (grid cells where protests, military activity, naval
movement and news converge), `get_focal_points` (entities where coverage and map
signals converge), `simulate_infrastructure_cascade` (what fails downstream when
a cable or chokepoint is cut), `get_temporal_anomalies` (event counts versus
day-of-week and seasonal baselines, z-scored), `get_military_surge`,
`get_population_exposure` (people inside an active hazard radius),
`get_test_site_seismicity` (proliferation-scored seismicity near known test
sites), `get_alert_digest`.

**Memory — an accumulating history (3)** — `search_intel_history` (semantic
search over past events, Pro), `get_intel_timeline`, `get_similar_events`
(historical precedents for a described situation).

**Forecasting (3)** — `get_forecast_predictions`, `generate_forecasts` (live),
`get_forecast_scorecard` (**calibration, Brier and log scores, by domain and by
generation origin**).

**Text and entity primitives (5)** — `classify_event`, `extract_entities`,
`get_news_clusters` (Jaccard clustering over the live digest),
`get_keyword_spikes` (trending terms, CVEs and APT/FIN group spikes versus
baseline), `describe_tool`.

**Odd but instructive (4)** — `search_flights` and
`search_flight_prices_by_date` (Google Flights, real prices),
`get_social_velocity` (Reddit geopolitical velocity), `get_company_intelligence`
(SEC EDGAR).

**`analyze_situation`** — the AI analyst itself.

### What the payload actually contains

This is the part that could only be learned by fetching, and it is the most
useful finding in the document.

`GetCountryRisk` returns a Composite Instability Index as a **decomposed**
object, not a number:

```
cii: { combinedScore, components: { ciiContribution, geoConvergence,
       militaryActivity, newsActivity }, advisoryProvenance: "live", computedAt }
```

`GetResilienceScore` goes further. Each domain contains dimensions, and every
dimension carries:

```
{ id, coverage, freshness: { lastObservedAtMs, staleness },
  imputationClass, imputedWeight }
```

**They publish which dimensions were imputed rather than measured, and with what
weight.** Alongside per-dimension coverage and staleness. A consumer can see
exactly how much of a 0–100 score is real observation and how much is filled in.

That is our own "never invent" discipline expressed numerically, and they ship it
in the response body. We assert the principle in prose and enforce it in code;
they *quantify* it per dimension and hand it to the caller. This is the single
strongest idea to take from the entire survey.

### Their sandbox is drift-guarded, exactly like our API catalogue

Their fixture index says: *"Generated by `scripts/generate-sandbox-fixtures.mjs`
from the OpenAPI examples — do not edit by hand. Drift-guarded by
`tests/sandbox-fixtures.test.mjs`."*

Independent confirmation that the pattern in `lib/api-catalog.test.ts` — generate
documentation from the contract, then assert it — is what a serious platform in
this field actually does.

---

## The rest of the field, and why this document is thin about them

The same five-surface sweep was run against thirteen more platforms: OpenCTI,
MISP, SpiderFoot, Censys, GreyNoise, VirusTotal, urlscan.io, AlienVault OTX,
Shodan, Maltego, Liveuamap, ACLED and Recorded Future.

**Result: one hit.** Censys publishes an `llms.txt`; it points at a pricing page
that contains no price. Nobody else publishes `llms.txt`, `openapi.json`,
`swagger.json` or an MCP server card at a discoverable path.

That is itself the finding, and it is worth more than a longer list would be:

- **World Monitor is not the weakest platform in this survey. It is the most
  open one**, and its openness is why it could be measured at this depth. The
  others are not more sophisticated for being opaque; they are simply harder to
  verify, and an unverifiable claim is worth less than a measured one.
- Their public docs sites (`docs.opencti.io`, `misp-project.org/openapi`) return
  full pages and remain readable — that route is open and **has not yet been
  mined**. It is the obvious next step and is recorded as debt in
  `docs/UNREACHED.md` rather than claimed here.
- Everything behind a login is still unknown, everywhere, including for World
  Monitor.

**What must not be inferred from this document:** that the other twelve have
less to offer. It says only that they were not measurable by this method on this
date.

---

## What this changes for us

Written as findings rather than tasks; the ordered plan lives in
`lib/plans/capabilities.ts`, where each entry names the route that must enforce
it.

1. **The field sells the decision layer, not the data.** Confirmed twice over:
   free access to all 56 layers and 500+ feeds, while the analyst, scenarios,
   digests, export and the API key are paid. Our tier table gates whole
   gateways, which is backwards and contradicts charter §1.
2. **Per-dimension provenance is the frontier.** Coverage, staleness,
   imputation class and imputed weight, per component of every composite score.
   We have the honesty; we do not yet have the arithmetic.
3. **An accumulating memory is a product, not a nice-to-have.** Three of their
   tools exist only because they keep history: semantic search over past events,
   a timeline, and historical precedents for a described situation. We persist
   evidence already and expose none of this.
4. **Correlation across domains is where the hard value is.** Signal
   convergence, focal points, cascade simulation, temporal anomalies against
   seasonal baselines. Our fusion layer is the right foundation and reaches none
   of these yet.
5. **Publishing for machines is cheap and compounding.** Their `llms.txt`,
   `pricing.md`, OpenAPI, MCP card and sandbox are why this document exists.
   Ours now ships the first two; the OpenAPI and the sandbox are the natural
   next two, and `lib/api-catalog.ts` already holds everything the OpenAPI needs.
