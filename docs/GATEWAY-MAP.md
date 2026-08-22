# The gateway map — what exists, what is missing, what may lawfully fill it

> **R187** asked for research producing *the complete list of gateways*, then for
> building them. This file is the list. It is the standing answer to R179, R212
> and R213 as well, because those four requests are one request in four
> phrasings: *find every kind of gateway there is, and finish them.*
>
> It is kept current. A gateway that ships moves from **Gap** to **Built** here
> in the same commit that builds it, and a candidate source that stops answering
> moves to **Withdrawn** with the date and the reason.

Last verified live: **2026-08-22.** Every "verified" line below was fetched on
that date, and the HTTP result is recorded — including the failures, which are
the more useful half.

---

## 1. The frame: what a complete intelligence platform must cover

Not invented here. `docs/OSINT_REFERENCE.md` §2.0 lists twenty disciplines that
either *are* OSINT or serve it, and the charter binds us to extend that method
rather than replace it. So the map is scored against those twenty — not against
a competitor's feature list, which would only ever make us second.

Three of the twenty are **out of scope by charter, permanently**, and saying so
is part of the map rather than an omission from it:

| Discipline | Why it will never be a gateway here |
|---|---|
| **SIGINT / MASINT** | Interception. Not lawful for a civilian product, and §3's passive-only rule forbids it regardless. |
| **HUMINT** | People as sources. §3 forbids targeting private individuals; a "source" who is a person is exactly that. |
| **Pentesting / red team** | Sends packets at a target. §3's first rule is that the engine never touches the subject. |
| **DFIR** | Operates on a device in your possession. A different product, not a gateway. |
| **BI** | Reads your *own* internal data. We have no internal data of a customer's to read. |

That leaves **fifteen** disciplines a gateway can honestly serve.

---

## 2. Where we stand

**34 gateways in 7 families.** Sources, counted by importing the registry
rather than grepping the tree — the only count that cannot drift from the code:

| | Measured 2026-08-22 |
|---|---|
| **Coded sources** (modules with real logic) | **63** |
| **Catalogue records, total** | **239** |
| **Catalogue records that actually run** (`activeSources()`) | **158** |
| **Sources live in a sweep** | **221** (63 + 158) |
| **Distinct hosts the guardrail permits** | **182** |

The 81 catalogued records that do not run are not a discrepancy to hide: they
are licence-blocked, keyed-and-unconfigured, or gateway-driven rather than
swept — and each states which in its own record. A platform that quotes its
catalogue size as its live source count is quoting the wrong column, which is
exactly what §2a exists to prevent us doing. across 7 disciplines
(`osint` 52, `fin` 44, `geoint` 46, `cyber` 22, `humint` 15, `infra` 11,
`sci` 6), plus the coded modules.

| # | Discipline (reference §) | Our gateways | State |
|---|---|---|---|
| 1 | OSINT, general (§1) | `nexus`, `track` | **Built** |
| 2 | Competitive intelligence (§2.1) | `companies`, `filings`, `board` | **Partial** — no IP/patent record |
| 3 | Market intelligence (§2.2) | `markets`, `board`, `venues`, `crypto`, `resources` | **Built** |
| 4 | CTI (§2.4) | `threat`, `domain` | **Built** |
| 5 | FININT (§2.5) | `finance`, `ownership`, `procurement`, `crypto` | **Built** |
| 6 | GEOINT (§2.6) | `geo`, the globe, `world-events` | **Partial** — no earth observation |
| 7 | Transport — aviation (§2.7) | `geo` (OpenSky), FAA airspace | **Built** |
| 8 | Transport — maritime (§2.7) | `maritime` (NOAA NDBC) | **Built** 2026-08-22 → §3.1 |
| 9 | TECHINT (§2.9) | `space-weather`, `orbital`, `grid` | **Built** |
| 10 | Intelligence analysis (§2.10) | analyst, ontology, trust lens, calibration | **Built** |
| 11 | Data science (§2.11) | `open-data` (CKAN federation) | **Built** |
| 12 | Investigative research (§2.12) | `research`, `reference` | **Built** |
| 13 | Verification (§2.13) | `media` (artefacts) + `verify` (claims) | **Built** 2026-08-22 → §3.2 |
| 14 | Due diligence / KYC / AML (§2.14) | `finance` (OpenSanctions), `ownership` (GLEIF L2) | **Partial** — no debarment lists → §3.3 |
| 15 | Digital footprint (§2.18) | `username`, `email` | **Built** |

Plus the state and the record, which the reference treats as sources rather
than disciplines and which we gateway directly: `statements`, `courts`,
`regulation`, `officials`, `news`, `broadcasts`, `property`.

---

## 3. The gaps, each with a named authority and a verified status

### 3.1 Maritime & ocean — the missing half of transport

The reference pairs aviation and maritime in one section. We built aviation
and never built the other half, so the platform can tell you where an aircraft
is and nothing whatever about the sea — which carries roughly ninety per cent
of world trade.

| Candidate | What it is | Verified 2026-08-22 |
|---|---|---|
| **NOAA NDBC — latest observations** | Every reporting marine station on earth: wave height, period, wind, gust, pressure, air and sea temperature, with coordinates. **856 stations reporting**, in one 102 KB request. | `200 text/plain` ✅ |
| **NOAA NDBC — active stations** | The station *register*: **1,351 stations** with owner, programme, type, and a `dart` flag marking tsunami-detection buoys. The maritime equivalent of ISO 10383. | `200 text/xml` ✅ |
| NOAA CO-OPS tides & currents | Water level at US port stations. | `200 application/json` ✅ |
| NWS coastal waters forecasts | `api.weather.gov` product type `CWF`. Host already allow-listed. | `200 application/ld+json` ✅ |
| UN/LOCODE (UNECE) | The authoritative register of ~110,000 port and location codes. | `403` ✗ — bot challenge. §3 forbids working around one. A GitHub mirror answers, but a mirror is a **C**, not the **A** the register itself would be. Not adopted on those terms. |
| AIS vessel positions | Live ship tracking. | Every route requires a key or a commercial agreement (aisstream.io, Global Fishing Watch, MarineTraffic). **No keyless route exists.** |

**Grading.** A buoy measuring the sea it floats in is an instrument reading —
`A`/`1`, exactly as USGS seismometers are. Not a report about an observation:
the observation itself.

**Status: BUILT** (2026-08-22) — the `maritime` gateway. NDBC was the strongest
verified keyless primary in any gap, and it is geolocated, so it is also a globe
layer the product has never had.

Four defects surfaced only because the gateway was read live rather than
assumed working, and each is a lesson the next gateway inherits:

 - **Guam, Yap and Palau were filed in the Indian Ocean.** One longitude band
   for an ocean whose eastern limit moves with latitude. Fixed against the IHO
   limits, and tested with the real coordinates of real stations.
 - **Korean partner stations rendered as `" (22103)"`** — a blank name is not a
   name, and `?? id` does not catch an empty string.
 - **A North Sea platform read `Tartan &quot;A&quot; AWS`** — attribute values
   are XML and nothing decoded them.
 - **The phone page was 64,056 pixels tall**, with 731 tap targets and 385
   rows in the Atlantic group alone — five and a half times the globe page this
   project had already been told was unusable. The data was perfect and the
   page was not. Every other board in the codebase caps in the source; this one
   emitted all 861 stations. Each basin now shows its roughest twenty and
   **counts what it left out on the page**, because a cap the reader cannot see
   is indistinguishable from missing coverage. **10,767 px** after the fix.
   Found only by opening it in a browser — which is exactly what R267 is for.
 - **Lake Winnipeg and eleven Lake Ontario stations were in the Atlantic.**
   NDBC's network carries the Great Lakes and reservoirs as far inland as Lake
   Murray. Separated using two signals the register itself supplies — elevation
   above 65 m, and NDBC's own `45xxx` inland series — because elevation alone
   cannot do it: Lake Champlain at 30 m sits *below* a dozen genuine Alaskan sea
   stations.

### 3.2 Verification — the claim record

`media` verifies an *artefact* (an image, a video frame). It cannot tell you
whether a *claim* has already been checked and found false, which is the other
half of §2.13 and the half a reader actually asks for.

| Candidate | Verified 2026-08-22 |
|---|---|
| Snopes | `200 text/xml` ✅ |
| Full Fact (UK) | `200 application/rss+xml` ✅ |
| PolitiFact (`/rss/factchecks/`) | `200 application/rss+xml` ✅ |
| FactCheck.org | `200 application/rss+xml` ✅ |
| Lead Stories | `200 application/xml` ✅ |
| AFP Fact Check (`factcheck.afp.com/rss.xml`) | `403` ✗ — refused. Not adopted. |
| Google Fact Check Tools API (ClaimReview) | Requires a key. Catalogued as keyed, inactive. |

Five verified keyless IFCN-signatory publishers. All are **C** — reputable
outlets reporting their own checking work — and none is independent of the
others in the way a wire is independent of a government, so two of them agreeing
is worth less than one of them plus a primary document.

**Status: BUILT** (2026-08-22) — the `verify` gateway.

Its differentiator is the reading on top, not the syndication: searching a
subject reports **how many independent checkers examined it**, counting
independence groups rather than headlines. It never collapses them into a
verdict, and the row says so in itself — three checkers addressing a claim is
not three confirmations of any answer.

Of the five, exactly one (Lead Stories) states its finding in the feed. That
one is shown; the other four say *verdict on the page* and link there. Guessing
"False" from a headline that begins "No," would be right often enough to be
trusted and wrong often enough to be dangerous.

One defect surfaced live and produced a general engine fix: **FactCheck.org's
encyclopaedia entries were listed as fact-checks** — "Americans for
Prosperity" presented as a debunking. The label lives in `<category>`, which
the feed parser dropped, so a filter reading the title and summary passed its
unit test and did nothing at all on real data. `FeedEntry.categories` now
carries the publisher's own classification, which every catalogue source
benefits from, and the test that guards it runs through `parseFeed` rather than
around it.

### 3.3 Due diligence — debarment and exclusion

We read sanctions (OpenSanctions) and corporate control (GLEIF Level 2). We do
not read **debarment**: the lists of firms and individuals barred from public
contracting, which is the question a due-diligence check actually asks before
signing.

| Candidate | Verified 2026-08-22 |
|---|---|
| World Bank listing of debarred firms (`apigwext.worldbank.org`) | `401` ✗ — the public JSON endpoint now authenticates. |
| US SAM.gov exclusions | Requires a key. |
| EU Early Detection and Exclusion System | Published as documents, not as a feed. |

**Status: gap, no verified keyless route yet.** Recorded rather than quietly
dropped. Re-probe on the Radar's schedule.

### 3.4 Competitive intelligence — patents and trademarks

R213 names **«الاكتشافات»** — discoveries — beside economy, research and news.
Scholarly output we have (OpenAlex, Crossref, PubMed, arXiv). The *applied*
half of discovery is the patent record, and we have none of it.

| Candidate | Verified 2026-08-22 |
|---|---|
| PatentsView legacy (`api.patentsview.org`) | `200 text/html` — returns the Open Data Portal landing page. The API is **retired**. ✗ |
| PatentsView search (`search.patentsview.org`) | Connection refused without a key. ✗ |
| USPTO `developer.uspto.gov` ibd-api | `200 text/html` — landing page, not JSON. ✗ |
| USPTO trademark search API | `404` ✗ |
| EPO Open Patent Services | Free tier, **but keyed**. |
| Lens.org, Google Patents BigQuery | Keyed. |

**Correction, 2026-08-22 — a keyless route does exist, and this file said it
did not.** Re-probing turned up **EPO Linked Open Data** (`data.epo.org`),
which is the European Patent Office publishing its own register as JSON with no
key at all:

| | Verified 2026-08-22 |
|---|---|
| `data.epo.org/linked-data/data/publication/EP/1000000/A1/-.json` | `200 application/json` ✅ — full record: abstract, applicant, inventor, agent, application number, filing date, priority, languages |
| `…/data/publication.json?publicationDate=2026-01-07&_pageSize=3` | `200` ✅ — **the date filter genuinely filters**; returns publications from exactly that day |
| `…?_search=Siemens` · `?title=battery` | `200` and **zero items** ✗ |
| `?applicant=Siemens` | `400 unknown shortname` ✗ |

**What that means, precisely.** It answers *"what was published on this date"*
and it cannot answer *"what has this company patented"*. Text and applicant
search are accepted by the endpoint and silently return nothing — which is the
same shape as the Stooq failure that cost this product two board sections while
every health check stayed green. A "patent search" built on it would look like
it worked and return empty for every query a reader actually types.

So the honest statement is not "no keyless route" and not "patents solved". It
is: **a keyless primary-registry patent-publication feed exists, filterable by
date only.** That earns a board — *what the patent offices published this week*
— and does not earn a search gateway.

Keyed routes remain the only way to search: EPO OPS, USPTO's Open Data Portal,
Lens.org. They belong in the catalogue as `keyEnv` records that stay
unregistered until a credential exists, so the gap is one environment variable
away rather than a project. **We will not substitute a scraped mirror for a
register**, and we will not ship a search that always returns nothing.

**Status: partially open.** The date board is buildable now; applicant search
is keyed.

### 3.5 GEOINT — earth observation

`geo` resolves places and reads flights; the globe draws events. Neither looks
at the earth. Sentinel and Landsat imagery is genuinely open, but the access
routes (Copernicus Data Space, USGS M2M, STAC catalogues) are keyed or require
registration, and imagery is a different product surface from a row on a board.

**Status: gap, deferred with a reason** — not a licence problem, a scope one.
Revisit when the globe can carry a raster layer.

---

## 4. What this map refuses to do

A gap here is never closed by finding *something* that returns JSON. Three
rules decided every line above, and each one cost us a candidate:

1. **A mirror is not a register.** The GitHub copy of UN/LOCODE answers where
   UNECE refuses. Adopting it would let us claim the authoritative port register
   while actually reading a volunteer's snapshot. It is graded C for a reason
   and it is not adopted on an A's terms.
2. **A bot challenge is the publisher's answer.** UNECE and AFP said no. §3
   settles it: availability is not permission, and a challenge is not an
   obstacle to route around.
3. **"Keyed" is recorded, not hidden.** EPO OPS and SAM.gov are real answers
   that need a credential. They belong in the catalogue as keyed and inactive,
   so the gap is visible and the fix is one environment variable — rather than
   quietly absent, which is how a platform ends up not knowing what it lacks.

---

## 5. The second axis: what the field has that we do not

§2 rule 8 and R267 make this half of the map, not an appendix to it. A
discipline can be "covered" by our own frame and still be *behind* — the
reference says what an intelligence platform must answer, and the field says
what a reader has already been shown elsewhere and will expect here.

The living record of who they are is `docs/COMPETITORS.md`. What belongs in
*this* file is only the part that turns into work: capabilities they ship that
we do not, ranked by how visible their absence is to a reader.

| Capability the field ships | Where we stand | Verdict |
|---|---|---|
| Live map with selectable layers | Built, and R266 rebuilt it to be operable | **Ahead** — ours states its own coverage gaps, which theirs do not |
| Alerting on a saved query | Built (`lib/alerts`, rule language, signed webhooks) | **Parity** |
| Export — PDF, CSV, JSON, citations | Built (W1.2), with a sealed dossier | **Ahead** — the seal is ours |
| Source transparency | Built — every finding carries source, timestamp, Admiralty grade, confidence | **Ahead**, and it is the product's whole argument |
| Honest source counting | §2a — integrations vs publishers vs independent origins, never added | **Ahead**, and unique. The field quotes the middle column as the first |
| Mobile / PWA / desktop clients | Web + Pi Browser, one codebase (R265), fits every screen (R264) | **Parity on reach**, no installable desktop client yet |
| Streaming / real-time push | Polling with a refresh buffer; no server-push channel | **Behind** — the honest gap |
| Saved workspaces, collaboration | History and groups exist; no shared workspace | **Behind** |
| Earth-observation imagery | Not built — §3.5 | **Behind**, with a stated reason |
| Ship tracking (AIS) | No keyless route; §3.1 | **Behind by licence, not by effort** |

Three of those are genuinely behind and none of the three is behind for lack of
noticing. They are written here so they cannot be forgotten, which is the whole
reason this file exists.

---

## 6. Order of work

1. ~~**Maritime & ocean** — NDBC.~~ **Built** 2026-08-22: the `maritime` gateway.
   856 stations reporting, grouped by ocean with the roughest seas first, the
   DART tsunami network called out, and inland waters separated from seas.
2. ~~**Verification / claim record**~~ **Built** 2026-08-22: the `verify` gateway.
3. **Debarment** — re-probe; no route today.
4. **Patents** — build the EPO Linked Open Data publication board (keyless,
   date-filtered, primary registry); catalogue EPO OPS and USPTO as keyed for
   the applicant search that needs a credential.
5. **Earth observation** — after the globe can carry a raster layer.
