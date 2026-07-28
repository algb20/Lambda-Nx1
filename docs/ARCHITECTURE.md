# Architecture — Isolation & Portability

The overriding design goal (Charter rule #4): **any external provider can be replaced
without rewriting the app.** This is achieved with a strict ports-and-adapters layout.

## Layers

```
app/ (Next.js routes, UI)         →  calls ONLY lib/* interfaces
  │
  ├─ lib/db        ← repository interface over Drizzle/Postgres
  ├─ lib/auth      ← AuthProvider interface (Pi | standard)
  ├─ lib/payments  ← PaymentProvider interface (Pi | Stripe/other)
  ├─ lib/storage   ← blob/file storage interface
  ├─ lib/queue     ← background-job/queue interface
  └─ lib/engine    ← OSINT engine (source-adapter framework + analysis core)
        └─ sources/ ← one adapter per public source, all implementing Source
```

**Rule:** nothing in `app/` (or a component) imports a vendor SDK (Supabase client, Pi
SDK, Stripe SDK, a specific DNS library) directly. It imports a `lib/*` interface. The
vendor detail lives only inside that interface's implementation folder.

## Portability matrix

| Swap | What changes | What does NOT change |
|---|---|---|
| Supabase → other Postgres (Neon, RDS, self-host) | connection string; deploy of migrations | all app code, all queries (Drizzle) |
| Netlify → Vercel → self-host | the thin function/deploy wrapper + config | `lib/*` business logic |
| Pi auth/pay → standalone auth/pay | which adapter is registered at startup | every screen and flow |

Migrations live in `db/migrations/` as SQL so any Postgres can be rebuilt from zero.

## OSINT engine

- **Source interface:** every source (crt.sh, RDAP, DoH DNS, Wayback, InternetDB, …)
  implements a uniform `Source` contract: `id`, `capabilities`, `passive: true`,
  `rateLimit`, `run(input) → Evidence[]`.
- **Redundancy:** capabilities (e.g. "subdomains") map to *several* sources. If one is
  blocked/down, the orchestrator falls back automatically → independence.
- **Our cache/archive:** every fetched result is normalized and stored (with hash +
  timestamp) in our DB, so we retain data even if a source later disappears.
- **Passive guardrail:** a central policy refuses to register or run any non-passive
  action. Active probing (nmap/port scan) is impossible by construction.

## Analysis core (the real value)

Implements the intelligence-analysis method from the reference (ch. 1, 2.10, 5):

- **Entities & pivots:** typed entities (domain, ip, email, username, org, image…) and a
  pivot graph linking them.
- **Evidence model:** `{ claim, source_url, retrieved_at, archive_url, hash, admiralty,
  confidence, notes }` for every fact.
- **Confidence grades:** confirmed / probable / possible / unconfirmed — never asserted
  from a single source.
- **Admiralty code:** source reliability (A–F) × info credibility (1–6).
- **ACH support:** competing-hypotheses matrix to fight confirmation bias.

## Pi vs standalone

One build, two runtime modes selected by environment:
- **Pi mode:** `AuthProvider = PiAuth` (Pi SDK), `PaymentProvider = PiPayments`
  (existing `netlify/functions/pi-*`), runs in Pi Browser.
- **Standalone mode:** `AuthProvider = Email/OAuth`, `PaymentProvider = Stripe/other`.
No screen or feature knows which mode it is in — they use the interfaces.
