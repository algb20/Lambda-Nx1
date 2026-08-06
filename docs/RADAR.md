# Radar — Continuous Research & Monitoring

A system that continuously searches and analyzes everything relevant to our field, to
(a) keep *us* ahead so we build our own stronger tech, and (b) power a product monitoring
feature. Legal, public sources only.

> The **human/curation layer** — which technologies & research we adopt, trial, assess or
> hold, on a weekly cadence — lives in **`docs/TECH_RADAR.md`** (rings + per-item decisions
> for Lambda NX + the prioritized source library). This automated Radar feeds it (`#27`).

## Two roles

1. **Internal (keeps us ahead).** Watches public, lawful sources — new/updated OSINT &
   intelligence tools, techniques, research, open-source engine releases — summarizes
   what's new/stronger, and proposes what we should build or improve. Feeds our own
   innovation; we never just copy.
2. **Product (serves users).** The same engine watches user-chosen public targets
   (a domain, keyword, brand, lookalike domains) and alerts on change or new appearance.

## How it runs

- Scheduled via `lib/queue` + `pg_cron` (not manual). `POST /api/radar/run` drives a
  pass; `?half=monitors|watch` runs one half (cadences differ — see `docs/DEPLOY.md` §4).
- Each finding is normalized and stored in our knowledge base with: source link,
  timestamp, Admiralty rating, confidence grade (same evidence model as the engine).
- De-duplication + change detection so we surface only what's new/meaningful.

## The ⭐ watchlist (internal half — implemented)

The internal half reads standing feeds through the **same engine** as everything else:
`watch`-capability sources (`lib/engine/sources/watch.ts`) behind the passive guardrail,
so the host allowlist and per-source rate limits apply unchanged. The curated list lives
in `lib/radar/watchlist.ts` — each entry carries the *rationale* for why it earns a slot,
and a test asserts every listed feed is actually served by a registered source, so the
list can never drift into fiction.

| Feed | Group | Grade | What it gives us |
|---|---|---|---|
| CISA Known Exploited Vulnerabilities | Security | A/1 · confirmed | Vulnerabilities **confirmed exploited in the wild** — the highest-signal security feed available to us |
| CISA cybersecurity advisories | Security | A/2 · probable | ICS advisories, joint alerts, analysis reports |
| Hugging Face daily papers | AI research | C/3 · possible | Curated daily AI selection with community attention weighting |
| arXiv cs.CR / cs.AI / cs.LG / cs.DC | Papers | C/3 · possible | The submission frontier for security, AI, ML and distributed-systems research |

Grading is honest about what each feed is: an authoritative catalogue reporting an
observed fact grades A/1; un-peer-reviewed preprints and community upvotes grade C/3 and
are labelled `[preprint]`. Attention is not evidence.

The sweep (`lib/radar/watch.ts`) is idempotent — items are de-duplicated by identity, not
by feed, so one paper on two feeds is one finding, and re-reading an unchanged feed stores
nothing. A feed that fails is reported with its error and the sweep continues; one dead
publisher never costs us the others. Findings are read back through
`GET /api/radar/findings` and shown in the Radar tab's knowledge-base panel.

**Failures are loud.** Elsewhere in the engine a source that gets an error status returns
no evidence and a sibling answers instead; a standing feed has no sibling, so a watch
source *throws* on a non-OK response and the sweep reports it. "The publisher had nothing
new" and "we could not reach the publisher" are different facts, and the sweep result
keeps them apart: `failed` counts only feeds that produced nothing *because* they errored,
while a feed that returned items despite a partial error still carries that error. Without
this, an outage would look exactly like a quiet week — the worst possible failure mode for
a radar.

### Wanted but not yet automated (and why)

Not stubbed — named honestly, so the gap is visible:

- **Lab blogs** (Anthropic, OpenAI, DeepMind, Meta FAIR, NVIDIA, AI2). No stable, uniformly
  available public feed across them; several publish HTML-only index pages that would need
  scraping. Adding them means adding scrape targets we would have to justify under
  robots.txt/ToS — deferred until each publisher's own feed is confirmed.
- **Standards bodies** (MITRE ATT&CK, OWASP, NIST, ENISA, CIS). Versioned corpora rather
  than event feeds; better modelled as a periodic *diff of a dataset* than a feed read.
  That is a distinct mechanism from this sweep and is its own follow-up.
- **Semantic Scholar / Papers with Code / OpenReview.** Overlap heavily with OpenAlex,
  Crossref and arXiv, which the Research gateway and this watchlist already cover; adding
  them now buys duplication, not coverage.

## Guardrails

- Public + lawful sources only; respect `robots.txt`, ToS, rate limits.
- No private-individual targeting. No sources that are illegal or acutely
  state-security-sensitive (excluded by the user and the charter).
- Passive only — the radar reads, it never probes a target.

## Status

Designed here in P0. Implemented in P4 after the engine (P2) and Module 1 (P3) exist,
since it reuses their source-adapter framework and evidence model.

Both halves are now built and tested:

- **Product half** — fingerprint + diff + scheduler over user monitors, with alerts.
- **Internal half** — the ⭐ watchlist above, collected through the engine and filed into
  the knowledge base (`radar_findings`, migration `0008` adds the Admiralty rating and
  feed provenance to each row).

Live feed reads run at deploy: the build sandbox blocks egress to the publishers, so the
end-to-end sweep is covered by a `RUN_LIVE=1` test (`lib/radar/watch.test.ts`) alongside
the offline tests that cover parsing, grading, de-duplication and failure handling.
