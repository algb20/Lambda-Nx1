# Landscape & Ambition — what a serious intelligence platform covers, and our lawful path to it

> This document exists because the user rightly said: *don't wait for me to name the
> fields — research and expand proactively; much is hidden from ordinary people.* True.
> This is our own map of the whole space (the kind of ground Palantir, Recorded Future,
> Maltego, Bellingcat-style OSINT and financial-intelligence shops cover), and **how we
> realize each domain with public, lawful, passive sources**. It extends `docs/GATEWAYS.md`
> and `docs/FORESIGHT.md`; it never overrides the guardrails in `CLAUDE.md` §3.

## How to read this

- **Ambition** = the real-world question serious platforms answer.
- **Our lawful realization** = the public data + method we use — passive, attributed, graded.
- **The line** = what we will *not* do (private/non-public data, active probing, prediction).

The platform grows by *families over one engine*; every row below is "a set of passive
sources + a module + a UI mode", not a new app.

## 1. What heavyweight platforms actually do (and our honest version)

| Ambition (their pitch) | Our lawful realization | Status |
|---|---|---|
| Fuse many data domains into one entity graph | Our pivot graph + evidence model across every gateway | ✅ engine |
| "Who is this / what are they connected to" | Domain, identity, company (GLEIF), sanctions | ✅ |
| "Is this malicious?" | Threat gateway (abuse.ch feeds) | ✅ |
| "Follow the money" | Markets (crypto/equities/FX) + **Procurement (public awards)** | ✅ |
| "Who receives public money & contracts" | USAspending, World Bank (this build); TED/EU, UN next | ✅ / ⏭️ |
| Ownership & control networks | GLEIF + OpenCorporates + registries → beneficial-ownership graph | ⏭️ |
| Supply-chain & trade exposure | public customs/trade (UN Comtrade), bills of lading, shipping | ⏭️ |
| Real-estate & land / industrial assets | OSM land-use, open cadastres/registries, corporate property in filings | ⏭️ |
| Geospatial / movement | OpenSky (aviation), AIS (maritime), OSM/Overpass | ⏭️ (#23) |
| Tech & R&D frontier ("secret labs") | **public footprint only**: patents, grants, filings, hiring, papers | ⏭️ (#27) |
| Foresight / "what's next" | track & **grade published forecasts**, never invent our own | ⏭️ (#28) |
| Triage & summarize at scale | AI-analyst layer (sorts, never verifies) | ✅ |
| Continuous monitoring | Radar (change detection, alerts) | ✅ engine |

## 2. On "booking / purchase / order"

Two distinct things, both handled honestly:

1. **Commerce inside the product** — buying access, reports, monitoring, higher limits.
   This is the **payments + subscription layer** (`lib/payments`, Pi + standard), already
   built; tiering ships with #25. A user can *order/subscribe*; no feature is faked per tier.
2. **Purchasing/ordering as an intelligence *signal*** — public procurement, tenders,
   contract awards, government spending. That is the **Procurement gateway** (this build)
   and its roadmap (TED/EU tenders, UN Global Marketplace, national e-procurement).

We do **not** act as a broker executing third-party purchases/bookings on external
platforms — that is outside a passive-intelligence product and often outside ToS/law.

## 3. Real estate — global & industrial (planned, lawful)

The ambition: track property/land, industrial & logistics assets, ownership and value.
Our lawful realization uses public data only:

- **OpenStreetMap / Overpass** — buildings, land-use, industrial zones, ports, warehouses.
- **Open cadastres / land registries** where public (varies by country; some open, some paid).
- **Corporate real estate in disclosures** — property, plant & equipment in SEC/other filings.
- **Sanctions/ownership overlay** — tie assets to owners via GLEIF/OpenCorporates.

The line: no scraping of private listings behind ToS, no personal-address targeting of
private individuals. Public registries and public geospatial data only. Tracked as a
sub-family of the Geospatial gateway (#23) + Ownership networks.

## 4. Priority order (proposed; user may override)

1. **Ownership & beneficial-control networks** — highest analytical leverage; ties money,
   companies and sanctions into one graph. (GLEIF + OpenCorporates + registries.)
2. **Research / Tech-trend + Macro sources** (#27) — the "frontier & economy" breadth.
3. **Calibration ledger** (#28) — makes us self-correcting and trustworthy.
4. **Geospatial / Transport + Real-estate overlay** (#23) — movement & assets.
5. **Supply-chain / trade** — exposure and dependency mapping.

## 5. Non-negotiables (every row, forever)

Passive only · public + lawful sources · respect robots/ToS/rate limits · no
private-individual targeting · no prediction-fabrication · every finding carries source,
timestamp, Admiralty rating and confidence · multi-source before "confirmed" · the AI
sorts, it does not verify. These are enforced in code, not left to intentions.
