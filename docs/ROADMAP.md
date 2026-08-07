# Lambda NX — Roadmap

> Everything requested, plus everything `docs/EVALUATION.md` found, in one
> ordered list. Ordered by **leverage ÷ effort**, not by the order it was asked.
>
> **This file exists because a chat is not a memory.** Research, ideas and
> requests raised in conversation are lost when the conversation is compacted.
> Anything that matters belongs here or in `docs/RESEARCH/`, in the repository,
> where it survives.

---

## Wave 1 — Make what exists usable (highest leverage)

These unlock the product for every persona in the evaluation. None needs a new
data source.

### 1.1 Finish the translation (⚠️ correcting a real gap)
Seven dictionaries exist; **only 5 of 21 components use them**. Sixteen
components are hardcoded English, which is why the app looks untranslated.

- Wire every component through `t()`
- Extract every hardcoded string into the dictionaries
- **Google Translate for the long tail** — the user's explicit request. Needs a
  decision (see *Open questions*) because it costs money and, applied naively,
  would also translate evidence, which the charter forbids. Proposed shape: our
  reviewed dictionaries drive the interface; Google covers user-generated and
  overflow text only; evidence text is never machine-translated, only labelled
  with its original language.

### 1.2 Export & share — the adoption unlock
- PDF dossier with our grading, sources and timestamps
- CSV / JSON for analysts
- Citation formats (BibTeX, RIS) for researchers
- **Public permalink per dossier** — the single most viral mechanism available

### 1.3 Investigation history
Investigations already persist. Surface them: list, search, reopen, rename,
delete.

### 1.4 Onboarding with a real worked example
One guided dossier on first run. Converts sixteen empty boxes into a
demonstration.

### 1.5 Visual debt (from EVALUATION §7)
Fix the "19 gateways" mismatch, the dead header Pi button, `version: 0.0.0`,
empty states, and result-card hierarchy so the most significant finding draws
the eye.

---

## Wave 2 — Collaboration & social (the growth engine)

### 2.1 Teams / work groups *(requested)*
Telegram-grade group system:
- Create a group; owner/admin/member roles
- **Invite by Pi username** and by private invite link
- Add / remove members; a real control panel
- Shared dossiers and monitors inside a group
- Encryption at rest for group content; access enforced server-side
- New tables + migration; every action authorised on the server, never the client

### 2.2 Social layer *(requested)*
Comments, likes, reposts, follow, and **share outside the app**. This is not
vanity: it is the feedback loop that shows which analyses land, and it is how
the product markets itself. Feeds directly into the existing suggestions engine.

---

## Wave 3 — Depth: make one vertical undeniable

### 3.1 The asset deep-dive *(requested — the sharpest current gap)*
Today, clicking an asset shows a price. It should open **one window containing
everything**:
- price + series + history
- ownership and major holders (GLEIF — we have it)
- filings and disclosures (EDGAR — we have it)
- contracts and public money (USAspending — we have it)
- decisions, partnerships, projects, agendas
- news and sanctions exposure
- **every claim linked to its source**

**Most of this data is already in our gateways and simply is not joined.** This
is assembly, not acquisition — which is why it ranks high.

### 3.2 Two research modes *(requested)*
- **Comprehensive** — the full arc of a subject (e.g. gold from antiquity to the
  modern exchanges), structured into professional sections, evidenced throughout
- **Current** — the live state: markets, flows, latest developments

Both need a *composition* layer above the gateways: outline → gather → order →
grade → present.

### 3.3 Regional / country lens *(requested)*
"Everything about this country or region": news, crises, projects, agendas,
contracts, sanctions — scoped geographically.

---

## Wave 4 — Breadth: from 16 topics to the world

### 4.1 Topic taxonomy
A real subject taxonomy (hundreds of categories, not 16), each mapped to the
gateways and sources that serve it.

### 4.2 Source expansion
39 sources is the ceiling on everything above. Target the long tail: commodities,
energy, shipping, agriculture, health, law, patents, standards, climate,
demographics.

### 4.3 Radar expansion *(requested)*
The watchlist covers 7 feeds. It should cover every major category, including
the unfashionable ones that nobody watches — which is exactly where an
intelligence product earns its reputation.

---

## Wave 5 — Autonomy

### 5.1 The research mind *(requested)*
An unconstrained, unbiased research agent: plans its own investigation, chooses
its own pivots, gathers evidence, and composes a real report. Constrained only
by the charter's law/ethics guardrails — never by topic.

### 5.2 Auto-publishing *(requested)*
Detect significant developments at first appearance and publish them —
selectively, professionally, automatically — across social networks.

**Flagged honestly:** automated publishing carries real risk (being wrong in
public, at scale, in our name). It must be built *after* the calibration ledger
can demonstrate our accuracy, and should start human-approved before it becomes
autonomous. Publishing an error automatically is worse than publishing nothing.

---

## Open questions — I need answers to proceed

1. **Google Translate API key.** Cloud Translation needs a billed key. Options:
   (a) you provide a key, (b) I use a free self-hosted engine with lower
   quality, (c) we expand our own reviewed dictionaries only. Which?
2. **Social publishing accounts.** Auto-publishing needs API access for each
   network (X, Telegram, LinkedIn…). Which do you have, and under which account
   should we post?
3. **Your earlier research.** It was raised in conversation and lost to
   compaction. Please add it to `docs/RESEARCH/` in the repository — then it is
   permanent, and I will mine it properly into this roadmap.
4. **Priority.** Wave 1 is the highest leverage per hour. Confirm, or name a
   different starting point.

---

## Why this order

Wave 1 makes the existing engine usable by everyone. Wave 2 makes users bring
other users. Wave 3 makes us undeniable in one vertical. Wave 4 makes us broad.
Wave 5 makes us autonomous.

Doing Wave 5 first would produce an autonomous system publishing shallow work
from sixteen topics, with no way to export, share, or collaborate on it. The
order matters more than the speed.
