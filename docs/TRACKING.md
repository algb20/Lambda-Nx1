# Target Tracking — the radar-per-target (static vs. live, streamed, correlated)

> The user's requirement: when we show a target (a stock, coin, exchange, company,
> domain…), we must present its **past, present and published forward-looking**
> points, track its **key partnerships / agreements / announcements / decisions /
> events by type**, and do it **continuously and instantly** — an always-open door,
> not periodic polling — with **our own signature** correlating everything. And this
> applies to anything in the app that needs it. This is the design. It obeys the
> charter: passive, lawful, our own tech, **analysis not relay, no fabricated
> predictions**.

## 1. Static vs. live — the core separation

A target has two very different kinds of information; we keep them apart on purpose.

| Layer | What | Change rate | Where |
|---|---|---|---|
| **Identity** | what the target *is* — profile, fundamentals, registration, LEI/ownership, on-chain identity | slow / stable | cached; cheap to serve |
| **Timeline (live)** | what is *happening* — news, filings, partnerships, agreements, decisions, price moves | fast → instant | streamed continuously |
| **Horizon** | *published* forward-looking points — scheduled events, stated guidance/targets | appears/updates over time | streamed, clearly labelled "published outlook" |
| **Signature** | *our* correlation — links events across time and to similar cases, with logic | recomputed each tick | our own algorithms + AI analyst |

`lib/modules/target.ts` produces exactly these four parts (`identity` / `timeline`
/ `horizon` / `signature`). Static facts never mix into the live stream.

## 2. The honest boundary on "future"

We do **not** predict. "Future/horizon" means **published** forward-looking facts —
an earnings date a company announced, guidance it stated, a scheduled event, an
analyst target *someone else* published — each attributed and timestamped. Where
there is nothing published, the horizon is empty and says so. Our own view lives in
the **signature** as graded analysis (`possible`/`probable`/`confirmed`), never as a
certainty.

## 3. Always-open door — streaming, not polling

Traditional apps poll every N seconds. We hold **one open connection** and **push**
updates the moment we recompute them:

- `GET /api/track?q=<target>` returns **Server-Sent Events** (`lib/stream/sse.ts`):
  an `open` frame, an initial `target` snapshot, then continuous `target` updates,
  with a heartbeat comment so intermediaries keep the door open.
- The client (`components/target-tracker.tsx`) consumes it with `EventSource`,
  auto-reconnects, and re-renders the four layers live.
- **Next:** push *deltas* (only what changed) and move the recompute cadence to an
  event-driven trigger (webhooks / source push) instead of a server timer; a shared
  fan-out so 10k viewers of the same target cost one upstream fetch. Tracked.

## 4. Our signature — the brain (correlation + self-improvement)

The differentiator is not the data, it's the **synthesis**. The signature:
- correlates the target's events **across time** (what led to what),
- relates them to **similar cases** (pattern reuse),
- states the **logic** and what to **watch** — sorting, never verifying.

Today it runs over the fused evidence via the AI analyst (graceful without a key).
The self-improving loop (tracked): the **Radar** ingests each tick into the
knowledge base, and the **calibration ledger** (`docs/FORESIGHT.md` #28) scores how
tracked expectations played out — so the system learns which signals matter from its
own history. Super-intelligent, expandable algorithms are the roadmap's core, built
on this evidence spine — not bolted on.

## 5. Reusable everywhere

Target Tracking is a *capability*, not a one-off screen: any entity the app surfaces
(a gateway result, a market instrument, a news subject) can open its live tracker.
The "Track" investigator mode is the first surface; the same stream backs future
per-target views across the app.

## 6. Status

- **Shipped:** `lib/stream/sse.ts` (framing, tested) · `lib/modules/target.ts`
  (identity/timeline/horizon/signature, tested) · `GET /api/track` SSE stream ·
  live "Track" UI mode with EventSource + auto-reconnect.
- **Next:** deltas + event-driven push + shared fan-out; Radar ingestion of ticks;
  calibration scoring; richer scheduled-event sources per target type.
