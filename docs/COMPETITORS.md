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

## Where we are behind, stated plainly

Measured in this tree, today:

| | Us | World Monitor |
|---|---|---|
| Sources | **129** (57 coded + 72 catalogue) | 536+ hosts |
| Distinct hosts | **67** | 536+ |
| Map layers | 2 (events, liquidity) | 25+ |
| Cache tiers | 1 (in-process) | 4 (bootstrap → memory → Redis → upstream) |
| Real-time transports | None | WebSocket relay (AIS) |

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
