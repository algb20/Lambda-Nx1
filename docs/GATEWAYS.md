# Gateways — one engine, many families

Lambda NX is a multi-gateway intelligence platform. Every "gateway" is a family of
capabilities built on the **same** engine (`lib/engine`: guardrail + registry +
orchestrator + analysis core). Adding a gateway = adding passive, lawful sources under new
capabilities + a module + a UI mode. Nothing bypasses the passive-only / legal guardrails.

This design is future-proof: the platform grows by *families*, not rewrites.

## Families

### ✅ Shipped — OSINT & analysis (core)
| Module | Capabilities | Sources (keyless) |
|---|---|---|
| Domain / Infrastructure | dns, whois, subdomains, tech, archive, ip_reputation | DoH, RDAP, crt.sh, urlscan, Wayback, Shodan InternetDB |
| Email / Username | username_presence, email_breach | 11-platform check, XposedOrNot, Gravatar |
| Media verification | (local) | exifr EXIF/GPS, reverse-image links |
| Monitoring / Radar | change detection | reuses Domain family |
| Threat (CTI) | is this IP/domain/URL/hash malicious? | Feodo Tracker, URLhaus, ThreatFox (abuse.ch) |
| Financial / Sanctions / Corporate | is this entity/wallet safe to deal with? | OpenSanctions, GLEIF, mempool.space |
| Markets & Economy | what is this asset/company/currency doing now? | CoinGecko, SEC EDGAR, Frankfurter (ECB) |
| Markets Board (live) | top prices across classes at a glance | CoinGecko (crypto), Stooq (commodities + indices), ECB (FX) |
| Procurement & Public Contracts | who receives public money / contracts? | USAspending.gov, World Bank projects |
| Ownership & control networks | who owns / controls this entity? | GLEIF Level-2 (parents, ultimate parents, subsidiaries) |
| News & Signals | what are the top world events / topic coverage? | GDELT, Wikipedia "In the news", USGS earthquakes (live, geolocated), ReliefWeb/UN OCHA (humanitarian) (see docs/NEWS.md) |
| Geospatial / Transport | where is this? | Nominatim/OpenStreetMap (places), OpenSky (live flights) |
| Research & Tech-trend | what's the frontier on X? | OpenAlex, Crossref (papers), arXiv (preprints), GitHub (tools), Hacker News (industry signal) |
| Macro / Economy | a country's key indicators | World Bank (GDP, population, inflation) — via Markets |
| AI-analyst layer | triage + summarize + suggest next pivot | Claude (Anthropic API) over our own evidence |

### ⏭️ Planned families (all lawful, free-source-first)
| Gateway | What it answers | Candidate free sources | Tier |
|---|---|---|---|
| **Geospatial / Transport** | where/when did this happen? | OpenStreetMap/Overpass, OpenSky (flights), AIS/marine | free + paid |
| **Research & Tech-trend** | what's advancing in science/AI/patents? | OpenAlex, Crossref, arXiv, GitHub/HF trends, USPTO | free + paid |
| **Macro / Economy** | indicators, commodities, funding | World Bank, IMF, OECD, FRED, EIA | free + paid |
| **Calibration ledger** | whose published foresight proved right? | our own record of attributed claims vs outcomes | **paid** |
| **Real estate / assets** | land, industrial & logistics assets | OSM/Overpass, open cadastres, filings | free + paid |
| **Supply-chain / trade** | trade exposure & dependencies | UN Comtrade, public shipping/customs | **paid** |

See `docs/FORESIGHT.md` (anti-bias + calibration) and `docs/LANDSCAPE.md` (the full
ambition map — Palantir-class domains and our lawful public-source realization of each).

Each planned gateway follows the shipped pattern: `lib/engine/sources/*`, a
`lib/modules/*` orchestrator returning a documented report, an API route, and a UI mode —
reusing the existing design.

## Guardrails for every family
Passive only · public + lawful sources · respect robots/ToS/rate limits · no
private-individual targeting · findings carry source + timestamp + Admiralty + confidence.
The AI-analyst **sorts evidence, it does not verify on its own** (reference §9).

## Monetization study (future) — free vs paid

Gated via the payments layer (Pi + standard). No feature is faked for any tier.

| | Free | Pro (paid) |
|---|---|---|
| Core OSINT (domain/username/email/media) | ✅ with daily limit | ✅ higher limits |
| Threat + Geospatial gateways | limited | ✅ full |
| Financial / Sanctions gateway | — | ✅ |
| AI-analyst layer | — | ✅ |
| Monitoring (radar) | 1 monitor | many + shorter intervals |
| Saved investigations / export | basic | full history + export |
| Keyed premium sources (opt-in) | — | ✅ |

**Design note:** tiering is a cross-cutting check (`user.plan` + a `requireTier` guard) over
the *same* features — never a separate app. To be implemented when subscriptions ship;
the payments layer already exists.
