# Lambda NX Technology Radar — what we adopt, trial, assess, hold

> Purpose (from the user): keep Lambda NX at the frontier without temporary
> solutions — review the newest technologies, research and tools on a cadence and
> **decide what deserves integration and what to ignore**. This is *curation and
> application*, not a copied list: every item below carries a **decision for our
> project**, not just a name. It complements the automated feed in `docs/RADAR.md`.

## How to read the rings (Thoughtworks-style)

- **Adopt** — proven for us / already our direction; integrate and deepen now.
- **Trial** — promising; build a real, bounded pilot next.
- **Assess** — watch and prototype small; not yet on the critical path.
- **Hold** — deliberately not now (immature, off-mission, or unlawful for a passive
  intelligence product).

The North Star is **Palantir's *thinking*, not its product**: an **Ontology** — a
model of real-world entities, relationships and actions that data, logic, AI and
permissions all share. We already have the spine (entities + links + evidence +
confidence + guardrail); the radar points where to deepen it.

## Adopt — our direction, integrate now

| Tech / concept | Why it's us | Where in Lambda NX |
|---|---|---|
| **Ontology / Knowledge Graph** | one shared model of entities & relations beats scattered tables | deepen `db.entities/entity_links` + `analysis.buildGraph` into a first-class ontology |
| **Decision Intelligence** | grade & recommend, don't just show | confidence grades + AI analyst + Nexus dossier |
| **Event Sourcing / provenance** | every fact is an immutable, sourced event | `scans`/`evidence` archive + Admiralty + timestamps |
| **Streaming (SSE) over polling** | instant, open-door delivery | `lib/stream/sse` + `/api/track` (shipped) |
| **Zero-Trust / passive-only** | never touch the target; least privilege | central guardrail (allowlist + read-only) |
| **Multi-agent / agentic AI (guarded)** | orchestrate tools with human-in-the-loop | AI analyst → agentic "pivot copilot" (planned) |
| **Data minimization / privacy-by-design** | store only what a task needs | charter §3, GDPR-aware |
| **Digital provenance / verifiable evidence** | tamper-evident, shareable dossiers | signed-dossier innovation (`docs/INNOVATIONS.md`) |

## Trial — build a bounded pilot next

| Tech / concept | The pilot for us |
|---|---|
| **Neuro-symbolic (rules + LLM)** | deterministic rules gate/verify AI output before it grades evidence |
| **Causal reasoning** | in the target **signature**, model "event A led to B", not mere correlation |
| **Digital twin (lite)** | the target tracker *is* a live twin — formalize state + horizon per target type |
| **Human-in-the-loop approval** | analyst proposes a pivot; a human approves before it runs |
| **CQRS / read-model** | split the live read-model (streams) from the write path (ingest) |
| **Calibration / continuous learning** | score our & others' published forecasts vs. outcomes (`#28`) |

## Assess — watch and prototype small

World Models · Confidential Computing · Zero-Knowledge Proofs · Verifiable
Credentials / DID (fits Pi identity) · Federated / on-device (Edge) AI · Swarm /
collective intelligence · Data Mesh · OpenTelemetry (adopt at deploy) · Synthetic
data (for tests) · Semantic Web · Retrieval / knowledge-OS patterns · Spatial /
ambient computing.

## Hold — deliberately not now

Quantum / "quantum-safe" marketing (we removed the fantasy) · autonomous-weapons
domains (study Anduril/Helsing's *systems thinking*, never the application) · any
mass-surveillance or private-individual targeting · anything requiring active
probing · closed vendor lock-in that breaks provider-swappability (charter §4).

## Source library — organized & prioritized for an intelligence platform

Not a dump: ranked by usefulness to *our* mission. ⭐ = wire into the automated
Radar first.

- **Security (highest value to us)** ⭐: MITRE ATT&CK & D3FEND, OWASP, NIST, CISA,
  ENISA, CIS Benchmarks, SANS, Cloud Security Alliance.
- **AI research** ⭐: Anthropic, OpenAI, Google DeepMind, Meta FAIR, Microsoft
  Research, NVIDIA Research, Allen AI (AI2), Hugging Face Papers.
- **Papers & venues** ⭐: arXiv (cs.AI/cs.CR/cs.DC), Semantic Scholar, Papers with
  Code, OpenReview, ACM DL, IEEE Xplore, Nature MI.
- **Systems & architecture**: Martin Fowler, Thoughtworks Technology Radar,
  ByteByteGo, High Scalability, InfoQ, CNCF, Linux/Apache Foundations, cloud
  well-architected frameworks (AWS/Azure/GCP), Cloudflare.
- **Engineering blogs**: Netflix, Uber, Stripe, Cloudflare, Discord, Databricks,
  Figma, Vercel, Shopify, Airbnb.
- **Web3 (feeds the finance gateway)**: Ethereum/Solana/Chainlink Research, Messari,
  Electric Capital, Coin Metrics, Token Terminal, DeFi Llama.
- **Data**: Databricks, Snowflake, ClickHouse, Confluent, Apache Spark/Flink, Trino,
  DuckDB, Elastic, Grafana.
- **Trend pulse**: GitHub Trending, Hacker News, Lobsters, IEEE Spectrum.
- **Frontier / strategic (study the thinking)**: Palantir (Ontology, Foundry, AIP,
  Apollo), Scale AI, C3 AI, DeepMind/Anthropic/OpenAI/NVIDIA labs; DARPA, IARPA,
  NASA, CERN, Bell Labs, SRI, RAND; MIT CSAIL, Stanford HAI, Berkeley BAIR, CMU,
  ETH Zürich, Mila, Vector, Max Planck.
- **Firms to learn systems thinking from**: Palantir, Anduril, Scale AI, C3 AI,
  Glean, Weights & Biases, Together AI, Perplexity, Cognition, Sierra, Harvey.

## Cadence — the weekly review (the process, not a vibe)

1. **Scan** the ⭐ feeds (many are automatable via the Radar module `#10/#27`; the
   News/GDELT gateway already ingests some).
2. **Shortlist** 3–5 items with real relevance to a gateway, the engine, or the UX.
3. **Ring it** — Adopt / Trial / Assess / Hold, with a one-line rationale.
4. **Task it** — an Adopt/Trial item becomes a task in the living list (`docs/PLAN.md`);
   Assess items get a dated note; Hold items get a reason so we don't re-litigate.
5. **Record** the decision here (append a dated row) so the radar has memory — and
   so we can later see which bets paid off (ties into the calibration ledger `#28`).

## Immediate decisions logged (2026-07)

- **Adopt now**: formalize the **Ontology** layer over `entities/entity_links`
  (Palantir-thinking) — highest architectural leverage. → new task.
- **Trial next**: **neuro-symbolic guard** on AI output; **causal** links in the
  target signature.
- **Assess**: Verifiable Credentials / DID (natural fit with Pi identity).
- **Automate**: point the Radar module at the ⭐ security + AI-research + arXiv feeds
  so this review is fed continuously, not manually (`#27`).
