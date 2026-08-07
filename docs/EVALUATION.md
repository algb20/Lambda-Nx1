# Lambda NX — Honest Product Evaluation

> Written by walking the product as eight different users, then measuring the
> code behind what each of them met. Every number here was counted, not
> estimated. Where the product falls short, it says so plainly — a flattering
> audit is worthless.
>
> Date: 2026-08-07 · Commit: `e48ba7a` · 271 tests · 0 vulnerabilities

---

## 1. What we actually built (measured)

| | count | note |
|---|---|---|
| Intelligence gateways | 16 | all reachable, all keyless |
| Registered sources | 39 (+4 watch) | across 22 capabilities |
| API routes | 26 | |
| UI components | 21 | |
| Database tables | 15 | migrations 0000–0008 applied |
| Languages | 7 | **but see §3.1** |
| Tests | 271 | |
| Radar watch feeds | 7 | |

This is a real engine, not a mock. The passive guardrail, the Admiralty grading,
the evidence model, the ontology and the calibration ledger are genuine and
tested. **The problem is not that the foundation is fake — it is that the
foundation is far larger than the surface built on top of it.**

---

## 2. Walking the product as eight users

### 2.1 The ordinary user (curious, non-technical)

**Journey:** opens the app → sees a feed → taps "Intelligence" → sees 16 gateway
chips → types something.

**What works:** the Nexus "Unified" mode is genuinely good. One query, fan-out
across every relevant gateway, a graded dossier. This is the single strongest
thing in the product.

**Where it fails:**
- Every gateway expects an expert's input. The placeholders say `example.com`,
  `octocat`, `ICAO24 hex`. An ordinary user has none of these.
- **There is no worked example anywhere.** No "try this", no sample dossier, no
  guided first run. A new user faces sixteen empty boxes.
- Results are dense evidence lists. There is no plain-language summary of *what
  it means* unless the AI analyst is configured — and it is off by default.

**Verdict: 4/10.** Powerful, and effectively unusable without training.

### 2.2 The journalist / researcher

**What works:** source links, retrieval timestamps, Admiralty ratings and
confidence grades on every finding. This is exactly what a citation-conscious
researcher needs, and most consumer tools do not offer it.

**Where it fails:**
- **No export.** Not PDF, not CSV, not a citation format. A researcher cannot
  get a dossier *out* of the app into an article, a paper or a report. This is
  the single biggest gap for this persona.
- **No history.** Signed-in investigations persist to the database, but nothing
  in the UI lets a user browse, search or reopen past work.
- Coverage is narrow: 16 gateways against millions of possible subjects.

**Verdict: 5/10.** The evidence discipline is excellent; the workflow around it
does not exist.

### 2.3 The OSINT / security analyst (the strongest fit)

**What works:** the domain, threat, ownership and infrastructure gateways are
real and well-sourced. Passive-only is enforced by construction. The pivot graph
and ontology are genuinely useful. The Radar watchlist (CISA KEV, arXiv cs.CR)
is exactly right.

**Where it fails:**
- **No case management.** Analysts work cases, not queries. There is nowhere to
  group findings, annotate them, or build a narrative.
- **No collaboration.** One analyst, one browser. No teams (this is now on the
  roadmap).
- Monitoring exists but only for domains — not for people-adjacent public
  signals, companies, or topics.

**Verdict: 7/10.** The best-served user, and still missing the workflow layer.

### 2.4 The financial analyst / trader

**What works:** the markets board is live and multi-class (crypto, commodities,
indices, FX). Prices are real and never predicted.

**Where it fails — and this is the sharpest gap in the product:**
- **A price is not an analysis.** Clicking an asset gives a number. It does not
  give: who owns it, who trades it, what decisions were taken about it, what
  partnerships or projects surround it, what is scheduled, what filings mention
  it. The user asked for exactly this and they are right — *the data to build it
  already exists in our own gateways* (EDGAR filings, GLEIF ownership,
  procurement, news, calibration) and is simply not joined up.
- No historical depth. No chart, no series, no "how did we get here".

**Verdict: 3/10.** We show quotes. We do not explain markets.

### 2.5 The government / public-sector user

**What works:** procurement (USAspending, World Bank), sanctions (OpenSanctions),
ownership (GLEIF), humanitarian (ReliefWeb). The lawful/passive posture and the
documented evidence model are exactly what a public body needs.

**Where it fails:**
- **No regional lens.** Everything is global. A ministry wanting "everything
  about this country/region" cannot get it. The user asked for this and it is a
  correct request.
- No audit trail of who searched what — a hard requirement in most public bodies.
- No teams, no roles, no delegation.

**Verdict: 5/10.** Right sources, wrong shape.

### 2.6 The company / competitive-intelligence user

**What works:** ownership networks, procurement, filings, brand monitoring
through the domain radar.

**Where it fails:**
- No company-centric view. You can query a company through four different
  gateways and must assemble the picture yourself.
- No alerting on anything except domain change.
- No shared workspace.

**Verdict: 4/10.**

### 2.7 The educator / student

**What works:** the research gateway (OpenAlex, Crossref, arXiv) is solid and
free. The evidence grading is genuinely instructive — it teaches source
criticism by doing.

**Where it fails:**
- No explanation of *why* something is graded B/2. The Admiralty code is shown
  and never taught.
- No citation export (again).
- No reading path, no curriculum, no "start here".

**Verdict: 5/10.** A missed opportunity — this product could teach intelligence
method and currently does not try.

### 2.8 The power user / expert

**What works:** Nexus, the ontology, the global knowledge graph, the calibration
ledger, target tracking over SSE. There is real depth here.

**Where it fails:**
- No API for their own tooling. Everything is UI-bound.
- No saved queries, no scheduling beyond domain monitors.
- No bulk / batch operations.

**Verdict: 6/10.**

---

## 3. Measured weaknesses

### 3.1 Translation is 24% wired, not 100%

Seven complete dictionaries exist. But:

| | measured |
|---|---|
| UI components | 21 |
| Components that call `t()` | **5** |

**Sixteen components — including the entire intelligence dashboard, the monitor
dashboard, the calibration scoreboard and the globe — contain hardcoded English.**
Switching to Arabic or Chinese changes the header and the feed and almost
nothing else. The user's report that "translation is nearly disabled" is
accurate, and the earlier claim of "seven complete languages" was true about the
dictionaries and misleading about the product.

### 3.2 Topic breadth is the real ceiling

16 gateways. The user is right to call this narrow. Compare what a subject
actually needs: a query like "gold" should reach commodity markets, mining
ownership, export/import flows, central-bank reserves, historical price series,
sanctions exposure, and the scholarly record. We touch two of those.

### 3.3 No output

No export, no share, no permalink, no embed, no PDF. Whatever a user discovers
stays trapped in the tab. **This alone caps adoption**: nothing can spread if
nothing can leave.

### 3.4 No social layer

No comments, no likes, no reposts, no following. The user asked for these and
they are strategically right: they are the feedback loop that tells us what
works, and the mechanism by which the product markets itself.

### 3.5 No collaboration

Single-user only. No teams, no groups, no invitations, no roles.

### 3.6 The AI analyst is off

`ANTHROPIC_API_KEY` is unset, so the one feature that turns evidence into
explanation returns "not configured". Most users will never see the product's
best idea.

---

## 4. How we compare

| capability | world-class reference | us |
|---|---|---|
| Evidence grading & provenance | most tools do not do this at all | **we are ahead** |
| Passive/lawful by construction | rare; usually a policy, not code | **we are ahead** |
| Unified one-query dossier | Maltego needs manual transforms | **we are ahead** |
| Calibration of our own claims | almost nobody does this | **we are ahead, uniquely** |
| Breadth of sources | Palantir, Recorded Future: thousands | **far behind** (39) |
| Export & reporting | table stakes everywhere | **absent** |
| Collaboration & cases | table stakes everywhere | **absent** |
| Market depth | Bloomberg, TradingView | **far behind** |
| Onboarding | every consumer app | **absent** |

**The honest summary:** our *method* is better than the market. Our *coverage,
workflow and output* are far behind it. We built the hard half first — which was
the right call, and is why the second half is now the whole job.

---

## 5. Have we reached the goal?

**No — and the distance is measurable.**

The charter's goal is an analysis product whose value is "pivoting,
verification, confidence grading and documentation". We have built the
verification and the grading. We have not built the **documentation** (no
export), the **pivoting workflow** (no cases, no history), or the **breadth**
that makes pivoting meaningful.

Rough position: **the engine is ~80% of a serious product. The product around
the engine is ~25%.**

---

## 6. What would make it spread by itself

Ranked by leverage, not by effort:

1. **Export & share** — a dossier that can leave the app is a dossier that
   advertises the app. Every shared PDF with our grading on it is marketing.
2. **A public permalink per dossier** — link-shareable results are the single
   most viral mechanism a research tool has.
3. **Comments & reposts** — the feedback loop, and the reason to return.
4. **Teams** — one user brings four colleagues.
5. **Onboarding with a real worked example** — converts curiosity into use.
6. **Regional/topical lenses** — "everything about my country" is the query
   people actually have.
7. **Depth on one vertical** (markets) — being the best at one thing beats being
   present in sixteen.

---

## 7. Visual and UX debt found

- Sixteen gateway chips wrap to three rows on a phone; readable now, but there
  is no grouping or hierarchy among them.
- The feed's "19 live gateways" claim does not match the 16 actually offered.
- The Pi payment button in the header does nothing (the real checkout is in
  Preferences).
- `version: 0.0.0` in the health report.
- No empty-state guidance in most gateways.
- Result cards are uniform regardless of importance — nothing draws the eye to
  the most significant finding.

---

*This document is the baseline. `docs/ROADMAP.md` turns it into a plan.*
