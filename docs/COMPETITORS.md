# The field, and where we actually stand

Written from the platforms themselves — their repositories, architecture
documents and environment files — not from their marketing. Every number below
is either read out of a public artefact or measured in our own tree, and where
we are behind, it says so.

## The platforms

| Platform | Open? | Scale it claims | What it is genuinely good at |
|---|---|---|---|
| **World Monitor** | Yes, AGPL-3.0 | 536+ upstream hosts, 500+ feeds, 25 layers | Breadth, and a caching architecture built for it |
| **SitDeck** | No | 198+ providers, 65 map layers, 61 widgets | Operator dashboard, widget composition, AI analyst |
| **Dataminr** | No | ~1M public sources | Event detection speed; multimodal signal fusion |
| **Crisis24** | No | 200,000+ sources | Human verification on top of automated detection |
| **GDELT** | Data | Global news index | A corpus, not a product — best used as a source |

### The licence question, answered before it costs us

World Monitor is **AGPL-3.0-only**. That is the strictest common copyleft: it
reaches network use, so building a commercial hosted product on its code would
oblige us to publish our own source under the same terms. It is therefore a
**reference, never a dependency**. Nothing in this repository is derived from
its code, and the ideas we took — a tiered cache, per-source health with
staleness bounds — are architectural patterns, which are not copyrightable and
are in any case standard practice.

## World Monitor v2.10.0 — a teardown of the running product, 2026-08-15

Everything above this section was read from repositories and marketing pages.
This section is different: it is the first time this project has **seen a
competitor's product actually running**, which `docs/UNREACHED.md` §3 recorded
as a standing gap — their dashboards are client-rendered and our fetch method
executes no JavaScript, so until now we had only ever read their shell.

What follows is observed, screen by screen. Where a number appears it is one
their interface displayed, not one we inferred.

### What they have that we do not

**A layer system, and it is the backbone of the product.** Roughly forty
toggleable map layers behind a search box — not categories of *our* events, but
distinct datasets: submarine cables, pipelines, military bases, nuclear sites,
spaceports, data centres, gamma-radiation sensors, GPS jamming, strategic
waterways, critical minerals, storage facilities, fuel shortages, shipping
movement, trade routes, flight delays, protests, UCDP conflict events,
displacement flows, climate anomalies, disease outbreaks, sanctions, a
day/night terminator, live webcams. Toggling several composes a picture — cables
under conflict zones, jamming over a theatre.

**Reference geodata as a first-class asset.** Cables, bases, pipelines and
chokepoints are *static* datasets rendered as context. This is the half of the
product we have none of: everything we draw is an event, so our map has no
permanent world beneath it.

**Panels with composed indices**, each showing its working:

- *Country instability (CII)* — Afghanistan 62, Iraq 60, Lebanon 52, Israel 50,
  each with an `I:0 S:53 C:0 U:0` component breakdown.
- *Strategic posture* — named theatres (South China Sea, Iran, Taiwan, Baltic,
  Black Sea) each carrying a state: `escalating` / `stable` / `normal`.
- *Threat timeline* — a daily severity histogram, Info/Low/Medium/High/Critical,
  with "Worsening — 2 active days, 8 critical/high".
- *Cascading infrastructure impact* — 1,453 links across cables, pipelines,
  ports and chokepoints, so a cut is traceable to what it reaches.
- *Live intelligence* with GDELT-style `VOLUME 133` and `TONE −2.2` sparklines
  per theme (military activity, cyber, nuclear).
- *Global risk gauge* — 73 "elevated", trend stable, labelled `18/35 sources`.
- A **DEFCON-style global posture indicator** in the header, at 51%.

**Data families we carry nothing from:** prediction markets (Polymarket, with
size and close date), energy inventories (US crude, US and EU gas storage),
commodities (coal, lithium, uranium, soy, corn, wheat), equity indices.

**Product surface:** live TV from nine broadcasters, 23 live webcams by region,
an embeddable widget, a desktop app, Discord, and public Docs / Blog / Status /
Tools / Crises / Chokepoints / Countries pages.

**One thing they do that we should copy outright:** their AI summary carries
**numbered citations** back to the specific sources, with "Story details (8)"
and "Sources (8)" expandable. That is exactly our evidence discipline expressed
in an interface, and ours does not do it.

### Where they are weaker, observed rather than assumed

- **Eight regional intelligence panels all read "No items in the last hour"** in
  the same session that the map was dense. Their board degrades to empty
  regions, silently, with no statement of why.
- **`18/35 sources` on the risk gauge** — the composite is computed from half
  its inputs and the number is shown, but nothing says what the absence does to
  the score. We would call that a coverage finding.
- **"Sources (8)" counts outlets, not origins.** Nothing in the AI-summary
  panel distinguishes eight independent origins from eight outlets carrying one
  wire. This remains the deepest difference between the two products, and the
  one we must not trade away for breadth.
- **No Admiralty-style source grading**, and no confidence grade on a finding.

> **A correction, made the same day.** An earlier version of this section said
> they show *"no per-finding retrieval-versus-publication time"*. That was
> written from the first four screens and it is **wrong**. Their China Logistics
> Corridors panel displays, per provider: `observed 14 Aug 2026 11:00 PM UTC
> (Instant)`, `released Time unavailable (unknown)`, `retrieved 14 Aug 2026
> 11:30 PM UTC`, `revision unknown`, `content current`, `transport fresh` — a
> **three-way** split of observed / released / retrieved, one axis finer than
> our own two-way `publishedAt` / `retrievedAt`, plus explicit freshness and
> revision state.
>
> They also publish per-panel *provider-family coverage* (`families available ·
> Partial 3/6`, `Stale 4/6`) and, best of all, negative caveats naming what a
> source is **not**: *"UN Comtrade reporter 156 is China-level official
> statistics. It is not a town, corridor, factory, port, or shipment export
> ledger."* That is a discipline we do not have anywhere, and it is the single
> most impressive thing observed in this teardown.
>
> The correction is recorded rather than edited away because the error is the
> instructive part: four screens of a product are not the product, and a
> comparison written from a partial look reads exactly as confident as one
> written from a complete one.

### Chokepoints, which they treat as a first-class object

Kerch Strait and the Strait of Hormuz each render as a scored object rather than
a dot: `red 70/100`, `WAR ZONE`, `Disruption 100.0%`, `weekly change +14.8%`,
`incidents (7d) 421`, `AIS disturbances 0`, direction-split traffic
(`eastbound/westbound`), `mb/d (5% of 21 baseline)`, a threat-baseline review
date, and a written note — *"Traffic down 94% vs 30-day baseline, vessels may be
transiting dark (AIS off)"*. **"Transiting dark" is an inference from an absence
of signal**, which is real analysis and is the kind of finding our engine is
built to make and does not yet make anywhere.

### Macro indicators, straight from FRED

Fed Funds 3.63%, VIX 14.63, Unemployment 4.1%, 10Y–2Y spread 0.51%, each with a
week-over-week delta and a stamped source line (`FRED · 02:11`). Keyless, and we
carry none of it.
- **Two locked panels** (`PREMIUM BACKTESTING`, `PREMIUM STOCK ANALYSIS`) and a
  locked `RESILIENCE` layer render as teasers to a signed-out visitor.

### Our layers are not the same kind of thing as theirs

Worth stating precisely, because the counts look embarrassing and the comparison
is not like-for-like. Their ~40 layers answer *"what kind of thing is on the
map"*. Our five — events, corroboration, latency, coverage, liquidity — answer
*"what do we know about this data"*: which events are independently confirmed,
how late each source was, and **where we are blind**. No competitor surveyed
draws a coverage layer at all.

So: they have breadth we lack, we have an analytic depth they lack, and the
target is both. Breadth without the grading would make us a worse copy of them.

## Where we are behind, stated plainly

Measured in this tree, today:

| | Us | World Monitor |
|---|---|---|
| Sources | **129** (57 coded + 72 catalogue) | 536+ hosts |
| Distinct hosts | **67** | 536+ |
| Map layers | 5 analytic views | ~40 data layers |
| Reference geodata layers | **0** | cables, bases, pipelines, chokepoints, spaceports |
| Composed indices | 0 | CII, risk gauge, DEFCON, threat timeline |
| Cache tiers | 2 (in-process result cache + single-flight) | 4 (bootstrap → memory → Redis → upstream) |
| Real-time transports | None | WebSocket relay (AIS) |
| Prediction markets / commodities / energy inventories | None | All three |
| Live TV / webcams | None | 9 broadcasters, 23 cameras |
| Per-finding Admiralty grading | **Every finding** | None visible |
| Corroboration counted by independent origin | **Yes** | Outlets only |
| Published self-diagnosis | **`/api/diagnose`** | Status page only |

**Sources are the gap that matters, and it was an architectural problem rather
than an effort problem.** Every source was a hand-written module, so each cost a
file, a test and a registration — which caps a catalogue at a few dozen no
matter how much work goes in. The comparable platforms carry hundreds because
their feeds are *records in a list*. As of this change ours are too
(`lib/engine/catalog/`), and adding a source now costs one record. The count
above will move because the thing that was stopping it has been removed.

## Where they are weak — the openings

These are not complaints about competitors. They are the specific failures that
a platform of this shape produces, and each one is a design decision we can take
differently.

### 1. Volume is reported as if it were coverage

"536 sources" and "one million sources" are counts of *inputs*, not of
independent knowledge. Twenty outlets carrying one agency's wire is one
confirmation republished twenty times — and if corroboration is scored by
counting sources, heavy syndication of an unverified claim reads as
overwhelming consensus. That is exactly backwards: wide syndication is the
shape of a rumour propagating.

**What we do:** every source declares an `independence` group, and
corroboration counts groups. USGS and EMSC are separate groups because they
solve independently, which is what makes their agreement worth something; the
three USGS feeds are one group, because they are one network.

### 2. A source that answers is treated as a source that works

We had this bug ourselves and it is worth naming: an `ok` flag that meant "the
adapter did not throw". A provider returning `200` with an empty result set
reported healthy while contributing nothing, so the map could be blank with
every indicator green.

**What we do:** feeds report `ok` / `empty` / `failed` with a count, and an
empty surface states which feeds failed and which answered with nothing.
Absence of reports is never evidence that nothing happened.

### 3. Licences are documentation, not a control

ACLED restricts redistribution. OpenSky requires a prior agreement for
commercial REST use. Both are genuinely useful, and both are exactly the kind of
source a "we'll sort the licensing later" approach ships without noticing.

**What we do:** `lib/engine/catalog/licence.ts` holds each source's terms and
our real posture — commercial, storing, redistributing, all true. A source whose
terms forbid that **is not registered**, and the excluded set is kept with
reasons so a thin region can be traced to a licence rather than a bug.

### 4. Nobody shows where they cannot see

Every one of these platforms draws what it found. None draws where it has no
coverage, so a quiet region reads as a calm region.

**What we do:** `coverageReport()` returns sources *and* independent origins per
topic, sorted thinnest first. Where those two numbers diverge sharply, the gap
is the finding.

### 5. "Detected at" is presented as "happened at"

An event surfaced now may have happened eight hours ago in a region with thin
coverage. Collapsing the two makes late detection look like a fast-moving
situation.

**What we do:** the adapter never defaults a missing timestamp to now. A feed
that publishes no date yields a finding with no `observedAt`, and the interface
says so rather than implying freshness we cannot support.

### 6. The AI is asked to judge

Where an assistant summarises and scores in the same step, its confidence is a
property of the prose, not of the evidence.

**What we do:** confidence is computed from source reliability, corroboration
across independent groups, and recency — rules that can be recomputed and
argued with. The analyst layer explains and never grades.

## What we take from each

- **World Monitor** — tiered caching with per-key staleness bounds, and a
  health endpoint that reports `OK / STALE / WARN / EMPTY` per source. Their
  `seed-meta` idea (storing `fetchedAt` and `recordCount` beside every cached
  key) is the right way to make staleness measurable, and it is the direct
  ancestor of our `ok/empty/failed` grading.
- **SitDeck** — composable widgets over a shared data core, and disciplines
  (GEOINT, FININT, CYBINT…) as a first-class organising axis rather than a
  marketing list. Our `Discipline` type is that idea.
- **Dataminr** — fusing many signals into one event with a stable identity, so
  a user sees an event rather than thirty reports of it.
- **Crisis24** — automated detection is a candidate, not a verdict. Their human
  verification step is what our confidence grading and Contradiction Engine
  substitute for at a fraction of the cost.

## The order of work

1. **Catalogue scale** — grow the record set. The architecture no longer
   limits it, so this is now volume rather than engineering. *In progress.*
2. **Event Fusion** — stable event identity across sources, so thirty reports
   collapse into one event with thirty pieces of evidence.
3. **Confidence, computed** — reliability × independent corroboration ×
   freshness × completeness, each shown separately rather than as one number.
4. **Contradiction Engine** — surface disagreement instead of resolving it
   silently.
5. **Blind-spot map** — render `coverageReport()` geographically.
6. **Cache tiers** — the pattern World Monitor demonstrates, once source volume
   makes it necessary.

Sources:
- [World Monitor repository](https://github.com/koala73/worldmonitor)
- [World Monitor architecture](https://github.com/koala73/worldmonitor/blob/main/ARCHITECTURE.md)
- [World Monitor environment reference](https://github.com/koala73/worldmonitor/blob/main/.env.example)
- [SitDeck](https://sitdeck.com/)
- [Dataminr AI platform](https://www.dataminr.com/ai-platform/)
- [Crisis24 global intelligence](https://www.crisis24.com/capabilities/intelligence/global-intelligence)
- [GDELT documentation](https://docs.gdeltproject.org/)
- [ACLED API documentation](https://acleddata.com/acled-api-documentation)
- [OpenSky terms of use](https://opensky-network.org/about/terms-of-use)
