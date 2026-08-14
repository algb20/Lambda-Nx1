# The field: 30 platforms, what they do, what they get wrong

A standing survey, not a one-off. Charter §2 rule 8 makes maintaining this an
obligation rather than a task somebody has to request.

Each row is read from the platform itself — repository, architecture document,
environment file, or the running product — never from a press page. Where a
figure is the platform's own claim rather than something observed, it says
*claims*.

---

## A. Open-source platforms we can read

| # | Platform | Repository | Licence | What to take | What it gets wrong |
|---|---|---|---|---|---|
| 1 | **World Monitor** | `koala73/worldmonitor` | **AGPL-3.0** | 4-tier cache; `seed-meta` staleness per key; health as OK/STALE/WARN/EMPTY | Counts upstream hosts as "sources"; no independence modelling; AGPL blocks reuse |
| 2 | **OpenCTI** | `OpenCTI-Platform/opencti` | Apache-2.0 | STIX 2.1 as the internal model; GraphQL API; connector pattern | Cyber-only; heavy to run; no geospatial layer |
| 3 | **MISP** | `MISP/MISP` | AGPL-3.0 | Sharing groups, taxonomies, correlation across events | Analyst-facing only; no public-facing product surface |
| 4 | **SpiderFoot** | `smicallef/spiderfoot` | MIT | 200+ modules over one target; module dependency graph | **Active scanning** — incompatible with our passive guarantee |
| 5 | **theHarvester** | `laramies/theHarvester` | GPL-2.0 | Breadth of passive enumeration per identifier | Single-purpose CLI; no persistence, grading or evidence trail |
| 6 | **Recon-ng** | `lanmaster53/recon-ng` | GPL-3.0 | Workspace model; a schema shared across modules | Framework, not a product; no verification layer |
| 7 | **IntelOwl** | `intelowlproject/IntelOwl` | AGPL-3.0 | Analyzer-per-observable; containerised isolation | Requires Docker orchestration; no map, no narrative |
| 8 | **Yeti** | `yeti-platform/yeti` | Apache-2.0 | Observable graph with automatic enrichment | Cyber-only; thin UI |
| 9 | **NASA Worldview** | `nasa-gibs/worldview` | NASA open source | GIBS tile access; time-slider over imagery layers | Imagery browser only — no events, no analysis |
| 10 | **NASA WorldWind** | `NASAWorldWind/*` | Apache-2.0 | Globe rendering primitives | Library, not a platform; largely dormant |
| 11 | **Global Threat Map** | open source | — | Live cyber-event map from open feeds | Cyber-only; no corroboration or grading |
| 12 | **OSIRIS** | open source | — | Multi-domain aggregation: aviation, maritime, seismic, fire, weather, space | Aggregation without verification |
| 13 | **OONI** | `ooni/*` | BSD-3 | Network-interference measurement, and a real methodology for it | Narrow domain; measurement latency |
| 14 | **CKAN** | `ckan/ckan` | AGPL-3.0 | The protocol most national open-data portals speak | A portal, not intelligence |
| 15 | **Grafana** | `grafana/grafana` | AGPL-3.0 | **Alerting**: contact points, notification policies, HMAC-signed webhooks | Metrics-shaped; not built for evidence or provenance |
| 16 | **Metabase** | `metabase/metabase` | AGPL-3.0 | Alert-to-webhook, scheduled results delivery | BI over a warehouse; no live-source layer |
| 17 | **Apache Superset** | `apache/superset` | Apache-2.0 | Chart/dashboard composition over SQL | Same limitation as Metabase |
| 18 | **MapLibre GL** | `maplibre/maplibre-gl-js` | BSD-3 | Vector-tile rendering, self-hostable | Renderer only |
| 19 | **deck.gl** | `visgl/deck.gl` | MIT | Layer model: Scatterplot, Arc, H3Hexagon, Heatmap | Renderer only |
| 20 | **PMTiles** | `protomaps/PMTiles` | BSD-3 | Single-file tile archive — basemaps with no tile server | Static data only |

## B. Products we can only observe

| # | Platform | Scale it claims | What to take | What it gets wrong |
|---|---|---|---|---|
| 21 | **SitDeck** | *claims* 198+ providers, 65 layers, 61 widgets | Widget composition over one data core; disciplines (GEOINT/FININT/CYBINT) as the organising axis | Its own terms describe it as informational/entertainment — not for critical use |
| 22 | **Dataminr** | *claims* ~1M public sources | Event detection; multimodal fusion; noise suppression | Opaque scoring — a confidence you cannot audit is a confidence you must simply trust |
| 23 | **Crisis24** | *claims* 200,000+ sources | Human verification layered on automated detection | Slow and expensive; enterprise-only |
| 24 | **Liveuamap** | — | Conflict events pinned to a map with source links | Single-source pins; no corroboration or confidence |
| 25 | **Flightradar24** | — | Aviation depth; playback | Aviation only; commercial terms restrict reuse |
| 26 | **ADS-B Exchange** | — | **Unfiltered** feed — no blocked-aircraft list | Aviation only; community coverage is uneven |
| 27 | **MarineTraffic** | — | AIS coverage and port calls | Maritime only; restrictive licensing |
| 28 | **Windy / Ventusky** | — | Multi-model weather visualisation; model comparison | Weather only; no event layer |
| 29 | **Zoom Earth** | — | Storm tracking over live satellite imagery | Weather only |
| 30 | **NetBlocks** | — | Internet-shutdown detection as a public signal | Narrow; reporting cadence is manual |
| 31 | **Cloudflare Radar** | — | Traffic anomalies and outage detection at network scale | One network's view, presented as the internet's |
| 32 | **GDELT** | ~100k outlets | The largest open news index there is | A corpus, not a product — and every outlet in it shares one index |

---

## The seven failures this field has in common

These are the specification. Each is something a platform of this shape
produces, and each is a decision we take differently.

1. **Volume reported as coverage.** Every headline number counts inputs. None
   counts *independent* origins, so syndication reads as consensus.
   → Independence groups; corroboration counted by origin.

2. **Answering treated as working.** A provider returning 200 with an empty
   body shows green. We had this bug and fixed it.
   → `ok` / `empty` / `failed` with counts, and an empty map that says why.

3. **Licences as documentation.** ACLED restricts redistribution; OpenSky needs
   an agreement for commercial REST use.
   → A registry that refuses to register a source we may not use.

4. **No blind-spot rendering.** Everyone draws what they found; nobody draws
   where they cannot see, so a dark region reads as a quiet one.
   → `coverageReport()`, thinnest first.

5. **Detection time presented as event time.** Late discovery in a thin region
   looks like a fast-moving situation.
   → A missing timestamp stays missing; never defaulted to now.

6. **AI that judges instead of explains.** Confidence becomes a property of the
   prose.
   → Confidence computed from rules that can be recomputed and argued with.

7. **Contradiction hidden.** Where sources disagree, one is silently chosen.
   → Disagreement surfaced as a finding in its own right.

## Capabilities to match, and where each idea came from

| Capability | Best in field | Status here |
|---|---|---|
| Map layers | SitDeck (65), World Monitor (25) | **2** — the gap |
| Alerting: webhook + HMAC | Grafana | Planned; HMAC signing is the detail worth copying |
| Push notifications | World Monitor (VAPID Web Push) | Planned |
| Live streaming | World Monitor (WebSocket AIS relay) | Planned — SSE first; WebSocket only where the client must talk back |
| Tiered cache | World Monitor (4 tiers) | 1 tier; needed when source volume grows |
| Scheduled briefs | World Monitor, SitDeck | Publishing pipeline exists — our auto-publish is the differentiator |
| Desktop / PWA | World Monitor | Manifest present; installability to verify |
| Export | Few do it well | **Ahead** — PDF, CSV, JSON, BibTeX, citations, sealed dossiers |
| Evidence trail | Nobody | **Ahead** — every finding carries source, time, Admiralty and confidence |

Sources:
- [World Monitor](https://github.com/koala73/worldmonitor) · [architecture](https://github.com/koala73/worldmonitor/blob/main/ARCHITECTURE.md) · [environment](https://github.com/koala73/worldmonitor/blob/main/.env.example)
- [OpenCTI](https://github.com/opencti-platform/opencti) · [SpiderFoot](https://github.com/smicallef/spiderfoot) · [awesome-osint](https://github.com/jivoi/awesome-osint)
- [NASA Worldview](https://github.com/nasa-gibs/worldview) · [NASA GIBS](https://github.com/nasa-gibs)
- [SitDeck](https://sitdeck.com/) · [Dataminr](https://www.dataminr.com/ai-platform/) · [Crisis24](https://www.crisis24.com/intelligence) · [Liveuamap](https://liveuamap.com/)
- [ADS-B Exchange](https://www.adsbexchange.com/) · [Flightradar24](https://www.flightradar24.com/)
- [GDELT documentation](https://docs.gdeltproject.org/)
- [Grafana webhook notifier](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/webhook-notifier/) · [Metabase webhooks](https://www.metabase.com/docs/latest/configuring-metabase/webhooks)
