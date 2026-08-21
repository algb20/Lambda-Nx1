# The Dossier — one page that is the whole file on a thing

> **Status: design, not yet built.** This was asked for as a study *before*
> implementation, so that the idea can be developed before it is committed to.
> Nothing here has shipped. Every source named below was probed live on
> 2026-08-21 and the result recorded, so the plan is built on what answers,
> not on what ought to.

## 1. What was asked for

> اختار سهم أو عملة أو أي شيء — يجب وضع كل المعلومات عنه، والتعريف أو النبذة،
> والأهم: كل أخبار وأحداث وشراكات وخطط وأعمال **من المصادر الرسمية** للسهم أو
> العملة، مع معلومات وإعلان الشريك، وما يتبعه، والمصادر، والأثر أو الاستنتاج.
> وأرفق كل حساباتهم ومواقعهم الرسمية. وأي شيء يُعلن يذهب مباشرة إلى لوحة.
> … ولا يوجد لنا منافس فيه عالميًا.

Restated as an engineering requirement:

**Pick any traded thing — a share, a coin, a company, an ounce of gold — and get
one page that is the complete file on it: what it is, what it costs, and every
announcement its own institutions have made, each one resolved to the parties
involved, the terms, what follows from it, the primary source, and what it
means. New announcements arrive on that page, live, without being asked for.**

Plus the classes we do not cover at all yet: **companies, commodities — raw and
processed — gold, silver, and everything else that trades.**

## 2. The thesis, in one paragraph

Every platform in this field aggregates **coverage**: what journalists,
aggregators and other aggregators said about a thing. Coverage is downstream,
duplicated, and its provenance dissolves within two hops. We index the
**primary act** instead: the 8-K the company itself filed, the governance
proposal its own token holders voted, the auction price its own benchmark
administrator set, the release its own maintainers tagged. Then we do the part
nobody does — we resolve the *counterparty* named in it to a real entity in our
graph, extract the *terms*, and state the *consequence* with a confidence grade
attached. A dossier is therefore not a page of headlines. It is a chain of
primary acts with the reasoning written down.

**Why this is defensible.** Aggregating coverage is easy and everybody does it,
which is why nobody wins at it. Primary-source indexing is unglamorous work
per source: one adapter per registry, per filing system, per governance forum,
per benchmark administrator. That work does not compress, cannot be scraped
from a competitor, and compounds — every adapter added makes every dossier
better, permanently. It is the same shape as the source catalogue this project
already has 227 integrations of.

## 3. What the field does, and where it breaks

Studied against the standing rule (charter §2.8) — architecture and public
surfaces, never their code.

| Platform | What it does well | Where it breaks |
|---|---|---|
| **Bloomberg / Refinitiv** | Genuinely complete; the reference standard | Price of entry; coverage-shaped, so provenance of a claim is often "a Bloomberg story"; nothing about the *reasoning* is exposed |
| **Koyfin / TIKR / Fiscal.ai** | Beautiful company pages, deep fundamentals | Filings are a *list*. Nobody reads the 8-K for you, resolves the partner, or says what follows |
| **Messari** | Best crypto asset profiles in the field: governance, fundraising, unlocks | Crypto only; the analysis is human-written and therefore sparse and slow |
| **CoinGecko / CMC** | The directory of official links is excellent and free | Directory only. "Announcements" is a link to somebody's blog |
| **Crunchbase / PitchBook** | Deals and counterparties, structured | Private-market only, licensed, and the source is usually a press release rather than a filing |
| **Trading Economics** | Every commodity in one place | Aggregated numbers with no institution behind them; you cannot check anything |
| **OpenCorporates / GLEIF** | Real registry identity, real hierarchy | Identity only — no prices, no announcements, no analysis |
| **Arkham / Nansen** | On-chain entity attribution | On-chain only; attribution is proprietary and unfalsifiable |

**The gap every one of them leaves:** nobody joins *identity* (this is the legal
entity), *market* (this is what it costs), *primary act* (this is what it did),
*counterparty* (this is who it did it with), and *consequence* (this is what
follows) on one surface, with the source and confidence attached to each link
in that chain. That join is the product.

## 4. The design

### 4.1 A dossier is an object, not a page

```
Dossier
├── Identity        who this legally is, and every id it is known by
├── Channels        its own official mouths, each with a provenance chain
├── Market          what it costs, from the institution that sets the price
├── Ledger          every primary act, newest first
├── Network         counterparties, resolved into the existing ontology
├── Consequences    what each act implies, graded
└── Watch           the live rules a reader can arm on any of the above
```

Every field is `{ value, source, retrievedAt, admiralty, confidence }` — the
evidence model this engine already enforces (charter §6). A dossier with an
unattributed number in it does not render that number.

### 4.2 Identity — one thing, many names

The hardest unglamorous problem, and the one that decides whether anything else
works. `AAPL`, `Apple Inc.`, CIK `0000320193`, LEI `HWUPKR0MPOU8FGXBT394`,
Wikidata `Q312` and a hundred subsidiaries are one entity or five, depending on
the question being asked.

Resolution chain, in order of authority, all verified live:

| Rung | Source | Probe result |
|---|---|---|
| Legal identity | **GLEIF** LEI records, incl. parent/child | `200` |
| US issuer identity | **SEC** `data.sec.gov/submissions/CIK…json` | `200` — carries name, tickers, exchanges, EIN, **LEI**, SIC, addresses, former names, and the full filing index |
| Reference identity | **Wikidata** (already integrated) | already in the catalogue |
| Crypto identity | **CoinGecko** `/coins/{id}` | `200` |

The SEC endpoint is the keystone: it hands us the LEI, which hands us GLEIF,
which hands us the corporate tree. Identity is therefore *derived from
registries*, never guessed from a name — which is exactly how the "one million
sources" platforms end up merging two companies that share a word.

### 4.3 Channels — how we know a mouth is official

This is the part the request turns on: *من المصادر الرسمية*. A channel is not
official because it looks official. Each one carries **how we learned it was**:

| Provenance | Strength | Example |
|---|---|---|
| The registry itself names it | **A** | SEC `submissions.website` / `investorWebsite` |
| The issuer's own filing names it | **A** | An 8-K exhibit linking the press release |
| A recognised directory names it | **B** | CoinGecko `links.homepage`, `links.announcement_url`, `links.repos_url` |
| The domain matches the registered entity | **C** | verified against registry address/name |
| A human curator asserted it | **C** | ours, recorded as such |

Verified live for Uniswap: homepage `uniswap.org`, announcements
`uniswap.org/blog/`, repository `github.com/Uniswap/uniswap-v3-core`, handle
`@Uniswap`. That is a directory lookup producing a **read list** — and then we
read those channels *directly*, so the news is the issuer's own words, not
CoinGecko's summary of them.

**Nothing is ever quoted as official on a `C`.** A `C` renders as "linked, not
confirmed", which is the honest state and the one every competitor hides.

### 4.4 The Ledger — a primary act, modelled

The centre of the whole design. Not a headline: a structure.

```ts
interface PrimaryAct {
  kind: 'filing' | 'governance' | 'release' | 'listing' | 'benchmark'
      | 'sanction' | 'contract' | 'ownership' | 'incident'
  what: string            // the issuer's own words, quoted, never paraphrased
  when: string            // the act's date, never the date we fetched it
  channel: Channel        // which official mouth, with its provenance grade
  document: string        // the primary document itself, linkable
  parties: Party[]        // resolved into the ontology — the request's "الشريك"
  terms: Term[]           // amounts, dates, percentages, jurisdictions
  consequences: Consequence[]
  admiralty: Admiralty
  confidence: Confidence
}
```

**`parties` is the innovation.** Every platform shows you "Company X announced a
partnership with Company Y". We resolve **Y** — to its LEI, its own dossier, its
own filings, its own sanctions status, its own owners. The reader clicks the
partner and is in the partner's file. That single edge turns a news list into an
intelligence graph, and it is the thing the request is actually asking for when
it says *معلومات وإعلان الشريك*.

**`consequences` is where we say what it means**, and where we are most exposed
to inventing things. So it is bounded by rule:

- A consequence is **derived**, never predicted. "This 8-K reports a completed
  acquisition, so the target's filings cease after this date" is derivation.
  "This will raise the share price" is a forecast, and the charter bans
  forecasts outright.
- Every consequence names the rule that produced it, and is graded. A reader can
  disagree with the rule, which means the rule has to be visible.
- Where we cannot derive anything, the field is **empty**, not filled with a
  sentence that sounds like analysis.

### 4.5 Market — the price, from whoever actually sets it

Not from an aggregator. From the institution whose number it is.

| Class | Institution | Probe |
|---|---|---|
| **Gold, silver** | **LBMA** auction prices, `prices.lbma.org.uk/json/gold_pm.json` | `200` — 14,666 daily rows, USD/GBP/EUR, latest 2026-08-20 at **$4,482.95/oz**. The benchmark itself, with two decades of history for a chart |
| Euro rates & FX | ECB (already shipped) | `200` |
| Crypto | CoinGecko + our own chain radar (already shipped) | `200` |
| Company fundamentals | **SEC XBRL** `companyconcept` / `companyfacts` | `200` — audited figures from the filing, not a data vendor's copy |
| Commodities, broad | **World Bank** commodity series | `200` |
| Macro | World Bank / ECB / IMF (partly shipped) | `200` |

**Equity index and single-stock prices remain absent, and that stays a finding
rather than a gap.** Index levels are licensed IP; the free endpoints that exist
are scrapes of a broker's site in breach of its terms, and charter §3 forbids
that. Yahoo's `query1` endpoint answers `200` and we are **not** going to use
it. The category needs a licensed feed, and until it has one the page says so.
Fundamentals from SEC XBRL are lawful, audited and free — so a company dossier
is genuinely rich without a single price tick.

### 4.6 The live dashboard — *أي شيء يُعلن يذهب مباشرة إلى لوحة*

Nothing new is needed for this and that is the point: the alert engine, the
monitors and the signed webhooks already exist. A dossier simply becomes a
**subscribable object**. Arm a watch on Apple and every new 8-K, every LEI
status change, every sanctions hit on a resolved counterparty lands on the
dashboard, in the reader's language, with the primary document attached.

The rule that keeps this from becoming noise: **a watch fires on a primary act,
never on coverage of one.** Ten outlets writing about one filing is one event.

## 5. What we add that nobody has

The request asked for innovations beyond the ask. These are the five that
survived scrutiny — each is cheap for us because the machinery already exists,
and expensive for anyone else because it depends on the machinery.

1. **The provenance ladder on every official channel.** Competitors show a link.
   We show *how we know it is theirs*, graded A–C. It is the difference between
   a directory and a source of record.

2. **Counterparty resolution as a first-class edge.** The partner in an
   announcement becomes a node: their file, their owners, their sanctions
   status, their own announcements. This is the ontology layer earning its
   keep — it exists, and nothing has pointed a product at it yet.

3. **The silence signal.** Every dossier knows the issuer's own publishing
   *rhythm*. A company that files an 8-K every eleven days on average and has
   filed nothing in ninety is a fact worth surfacing — and the latency layer
   already computes exactly this shape for world events. **No competitor
   reports absence, because absence has no press release.**

4. **Contradiction between primary sources.** When the registry says one
   domicile and the filing says another, when the LEI is lapsed but the issuer
   still files, when two official channels disagree on a date — that is shown as
   a contradiction rather than silently resolved to whichever we read last. The
   fusion layer already grades agreement across origins; this points it at one
   entity instead of one event.

5. **The dossier seal.** Export the file, and the export carries a hash of every
   primary document it rests on, with its retrieval time — so the file can be
   shown to a third party and checked. The seal already exists for
   investigations; a dossier is the natural thing to seal.

## 6. Coverage plan — everything that trades

The request named the missing classes explicitly. Each row is a probe result,
not an intention.

| Class | Primary sources | State |
|---|---|---|
| **US public companies** | SEC submissions + XBRL facts + 8-K/10-Q/10-K index | verified `200`, not built |
| **Legal entities, globally** | GLEIF LEI + relationship records | verified `200`, partly built |
| **UK companies** | Companies House API | `401` — free key exists; needs the key layer |
| **Crypto assets** | CoinGecko directory → the project's *own* blog, forum, repos | verified `200`; governance forums answer `/latest.json` `200` |
| **Gold, silver** | **LBMA** auction benchmark | verified `200` — **this closes the request's الذهب والفضة with the actual benchmark** |
| **Energy** | EIA | `403` — keyed; OPEC basket `403` |
| **Agricultural** | FAO food price index; World Bank series | `200` |
| **Industrial metals & minerals** | USGS; World Bank | `200` |
| **FX** | ECB reference rates | shipped |
| **Sovereign debt** | ECB yield curve | shipped |
| **Equity prices/indices** | — | licensed; deliberately absent (§4.5) |

Two 403s came from our own egress rather than from the origin and need
re-checking from production before being called blocked.

## 7. The interface — and the boxes that prompted this

The request began with a complaint about a specific box: weak design, wrong
translations, no information, no links, no chart, no analysis. The dossier is
the answer to that complaint, so the box has to become its front door.

- **Every instrument on the markets page becomes a link into its dossier.** A
  row that cannot be clicked is a row that cannot be investigated.
- **The dossier is one column of sections**, in the order a person actually
  reads: what it is → what it costs → what it did → who with → what follows.
  Not a grid of widgets that each answer a different question at the same size.
- **The chart is the LBMA/ECB series itself**, drawn from the institution's own
  history, with the source under it.
- **Translation is already solved** by the conditional shield shipped this week:
  the labels are curated in seven languages and machine-translated in a hundred
  more, and the issuer's own quoted words are never machine-translated — a
  quotation that has been through a translator is not a quotation.
- **Empty space is a bug.** Sections with nothing in them collapse to a single
  line stating what is missing and why, rather than reserving a card for
  nothing.

## 8. Where the guardrails bind

- **Passive only.** Every source is a published document read from a public
  endpoint. No dossier ever touches an issuer's infrastructure.
- **Entities, not people.** A dossier is of a company, an instrument, a
  commodity. Officers appear only where a registry or a filing names them in
  their official capacity — never a private individual, never their private
  life.
- **Quotation, not republication.** We link the primary document and quote what
  identifies the act. We do not mirror licensed content.
- **No forecasts.** §4.4 above is the operational form of this rule.

## 9. Order of work

Ordered by what unlocks the most, not by what is easiest.

| Phase | What | Why first |
|---|---|---|
| **D1** | Identity resolution: SEC ↔ GLEIF ↔ Wikidata ↔ CoinGecko, into the existing ontology | Nothing else can be attached to a thing until the thing has an identity |
| **D2** | The channel registry with the provenance ladder | Defines what "official" means before anything claims to be it |
| **D3** | The Ledger for one class end to end — **US filings**, because 8-K *is* the primary announcement, structured, dated and free | One class working completely beats five half-built |
| **D4** | The dossier surface, and every markets row becomes a door into it | Closes the original complaint about the box |
| **D5** | Counterparty resolution — the partner becomes a node | The innovation that separates this from a news list |
| **D6** | Commodities: **LBMA gold and silver first**, then World Bank/FAO/USGS | Named in the request; the benchmark is already verified and has 20 years of history |
| **D7** | Crypto ledger: official blog, governance forum, releases | The channel discovery is verified; the reading is adapter work |
| **D8** | Consequences, silence and contradiction | These need a populated ledger to be worth anything |
| **D9** | Watches on dossiers, into the existing alert engine | Small, because the engine exists |
| **D10** | The seal on dossier export | Smallest, and the one that makes a dossier citable |

## 10. What is deliberately not in this plan

Saying so explicitly, because a plan that promises everything is a plan that
will be judged on the part it quietly dropped.

- **Price forecasts, target prices, buy/sell opinions.** Banned by charter, and
  they are what most of this field actually sells.
- **Equity and index price data**, until a licensed feed exists (§4.5).
- **Sentiment from social platforms.** A verified account's own post is a
  channel; the crowd's reaction to it is coverage, and coverage is what this
  design exists to get away from.
- **Private-company deal data.** It is licensed, and the free versions are
  someone else's licensed data redistributed.

## 11. Open questions — where the idea wants your input

The request asked to wait for the idea to be developed, so these are the four
decisions worth making before D1 starts:

1. **Depth or breadth first?** One class complete (US filings, D3) versus a thin
   dossier for every class at once. The plan above assumes depth; the opposite
   is defensible if the goal is to demonstrate range.
2. **How far does counterparty resolution recurse?** One hop is cheap and
   useful. Two hops is a network. Three is a research project.
3. **Do we take the keyed sources?** Companies House and EIA are free but need
   registration. That is a small operational cost against real coverage of UK
   companies and energy — and it needs the owner's decision, since it means keys
   in the secret layer.
4. **Who is the dossier for first?** An investor watching one instrument, or an
   analyst mapping a network? The same object serves both, but the *default
   ordering of the sections* differs, and that is a real fork.
