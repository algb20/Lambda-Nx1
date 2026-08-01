# News & Signals — design, sources, selection method, anti-bias

> The user asked for a precise, professional place that shows the strongest world
> news / most-covered stories and key partnerships, **non-stop**, always from the
> origin. This is the research and the design. It obeys `CLAUDE.md` §2–§3 and the
> "analysis, not relay" principle in `docs/FORESIGHT.md`.

## 1. What this is (and is not)

- **Is:** a *signals* layer — the top world events (or coverage of a topic) with
  source, country, timestamp and an honest grade, linking to the **origin**.
- **Is not:** a news reprint. We never republish article text (that is a ToS/
  copyright problem and adds no analytical value). We surface, attribute, link,
  dedupe, rank and hand off to the AI analyst / Radar.

## 2. Sources (public, keyless, primary-leaning)

Chosen for reach, neutrality and being free + always-on:

| Source | Role | Why | "Origin" |
|---|---|---|---|
| **GDELT DOC 2.0** | topic coverage | indexes global media in ~65 languages; article **volume across outlets** is a real proxy for how widely a story is "traded" | links to the actual outlet article |
| **Wikipedia "In the news"** | top world events | NPOV, editorially curated, each item sourced; genuinely the neutral "what matters now" | links to the sourced encyclopedia entry → primary refs |
| **USGS earthquakes** | real-time geolocated events | authoritative instrument-measured primary data (not a media claim); significant quakes in the past week with exact epicentre coordinates | links to the USGS event page |

They are **complementary by input**: GDELT needs a topic (used for topic search);
Wikipedia + USGS serve the topic-less "top events" case. This gives coverage of
"most-traded on X", "most important overall", and hard geophysical events —
without a single point of failure. USGS is the one source here graded **A/1
"confirmed"**: it is measured sensor data, so it also plots at exact coordinates
on the globe (via `pointsFromEvidence`), while media items stay "possible/
probable" until corroborated.

**Roadmap (more redundancy / origin depth):** official wire & institution feeds
(Reuters/AP/AFP where their ToS permits headlines+link, central banks, gov press
rooms via RSS/Atom), GDELT timeline-volume for "trending", and per-country/-language
balancing. Tracked, not shipped.

## 3. Selection & ranking method

1. **Recency window** — GDELT `timespan=48h`; Wikipedia = today's set.
2. **Importance / "most traded"** — GDELT `sort=hybridrel` (relevance × volume);
   Wikipedia ITN is importance-curated. Article volume/outlet spread is the
   circulation signal.
3. **Dedupe** — the engine drops exact duplicates; different outlets on the same
   story are kept (that spread is the signal, and it feeds corroboration).
4. **Grade honestly** — a single outlet is Admiralty C3 / `possible`; Wikipedia ITN
   is B2 / `probable`. News is a *report*, never asserted as fact.
5. **Order** — newest first for a live feed.

## 4. Anti-bias protocol (specific to news)

- **Multi-source, multi-country.** We show each item's outlet **domain and source
  country**; the summary lists the country spread so skew is visible.
- **No editorial voice.** We don't rewrite or "spin" — we show the headline and link
  to origin. Our value is ranking, attribution, dedup and grading, not opinion.
- **NPOV anchor.** Wikipedia ITN provides a neutral backbone for "top events".
- **The AI analyst sorts, it never verifies** — it can triage the feed (what matters,
  what to watch) but can't promote a headline to fact.

## 5. Non-stop operation

- **Redundancy:** two independent providers; if one is down/rate-limited the other
  still serves (covered by a test).
- **Live refresh:** the News view auto-refreshes every 60s while visible (pausable),
  so the feed stays current without hammering providers.
- **Durable, later:** the Radar sweep will ingest a watched topic's signals into the
  knowledge base over time, and the calibration ledger (`docs/FORESIGHT.md`) can score
  how stories developed. Tracked as #28/#31.

## 6. Status

- **Shipped:** News gateway — GDELT + Wikipedia ITN, `lib/modules/news`,
  `POST /api/intelligence/news` (empty = top events, topic = coverage), a live
  auto-refreshing "News" UI mode, and tests. The AI analyst can triage the feed.
- **Legal:** headlines + links only, passive, robots/ToS/rate-limits respected.
