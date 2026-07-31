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

- Scheduled via `lib/queue` + `pg_cron` (not manual).
- Each finding is normalized and stored in our knowledge base with: source link,
  timestamp, Admiralty rating, confidence grade (same evidence model as the engine).
- De-duplication + change detection so we surface only what's new/meaningful.

## Guardrails

- Public + lawful sources only; respect `robots.txt`, ToS, rate limits.
- No private-individual targeting. No sources that are illegal or acutely
  state-security-sensitive (excluded by the user and the charter).
- Passive only — the radar reads, it never probes a target.

## Status

Designed here in P0. Implemented in P4 after the engine (P2) and Module 1 (P3) exist,
since it reuses their source-adapter framework and evidence model.
