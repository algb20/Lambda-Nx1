# What the research could not reach — 2026-08-14

A standing record of every source, repository and site this project has tried to
examine and could not, with the exact reason. It exists because the alternative
is worse than a gap: a survey that quietly omits what it failed to read produces
a comparison that looks complete and is not, and nobody downstream can tell.

Every line here is a **debt**, not a decision. When access changes, the line is
worked and removed.

---

## 1. GitHub — every competitor repository

**Status: completely unreached.** `https://github.com/...` answers `403` and the
API answers *"GitHub access to this repository is not enabled for this session"*.
This session's GitHub scope is `algb20/lambda-nx1` only.

Never examined, and therefore never described in any comparison:

| Repository | Why it matters |
|---|---|
| `OpenCTI-Platform/opencti` | The strongest open competitor. Its data model, connector architecture and STIX implementation are the reference. |
| `MISP/MISP` | The indicator-sharing standard. Its taxonomy and galaxy structure are what the field actually uses. |
| `smicallef/spiderfoot` | ~200 modules; the closest analogue to our source catalogue. |
| `intelowlproject/IntelOwl` | Analyser orchestration — directly comparable to our orchestrator. |
| `OpenCTI-Platform/connectors` | The integration list. What they connect to *is* the competitive surface. |
| `MISP/misp-galaxy`, `MISP/misp-taxonomies` | Classification vocabularies we have no equivalent of. |
| `censys/censys-python`, `greynoise-io/pygreynoise` | Client-library design and rate-limit conventions. |
| `hslatman/awesome-threat-intelligence` | The field's own index of sources — a catalogue of catalogues. |
| `jivoi/awesome-osint`, `public-apis/public-apis` | Source discovery at scale. |

**What we still do not know because of this:** their real integration counts,
their data models, their licences (beyond what marketing pages state), their
release cadence, their actual technology choices, and every dependency they
carry. Any claim about "their repositories" would be invention.

**To resolve:** add read access for these repositories to the session, or run
the survey from an environment with open GitHub access.

---

## 2. Sites that refused or failed

| Site | Code | Note |
|---|---|---|
| `shodan.io/pricing` | 403 | Blocks automated readers. Tiers never verified. |
| `silobreaker.com/platform/` | 404 | Path moved; correct URL not found. |
| `crisis24.garda.com/services` | 404 | Path moved. |
| `socradar.io/pricing/` | 404 | Path moved. |

---

## 3. What the fetch method itself cannot see

The survey reads HTML over HTTP. Chromium is installed but its `CONNECT` through
the egress proxy is reset, so **no JavaScript is executed**. For a
single-page application that renders everything client-side, what we read is the
shell, not the product.

Affected, in descending order of how much was missed:

- **Recorded Future, Dataminr, Babel Street, Flashpoint** — marketing shells;
  the actual product is behind a login we do not have.
- ~~**Any interactive demo, dashboard or map** — never seen working.~~
  **Partly resolved, 2026-08-15.** World Monitor v2.10.0 was seen running, in
  full, and is torn down screen by screen in `docs/COMPETITORS.md`. It is the
  first competitor product this project has observed rather than inferred, and
  it changed the assessment materially: their ~40 map layers are *reference
  geodata*, not event categories, which is a whole half of a product we do not
  have. Note how it was reached — **a person opened it and sent screenshots**.
  The fetch limitation is unchanged; what changed is that we stopped requiring
  the machine to be the one that looks.
- **The other 29 platforms** — still never seen running. The same route would
  work for any of them.
- **Our own app** — the same limitation applies to us, which is exactly why
  `/api/diagnose` exists: it reports what the JavaScript would have shown.

**To resolve:** fix the browser tunnel, obtain trial accounts for the platforms
behind a login, or — cheapest and already proven — have a person open the
product and capture it.

---

## 4. Where the research is thin, honestly

Beyond access, the survey has real method gaps:

- **No pricing verified by purchase.** Published prices were read from public
  pages. Enterprise pricing is quoted on request everywhere and is unknown.
- **Capability detection is keyword-based.** A page mentioning "STIX" scores a
  hit whether the platform implements it or merely names it. The counts in the
  comparison are *signals*, not audits, and MISP scoring zero is proof of the
  method's limit — it plainly does support STIX.
- **No usage, revenue, customer or headcount data** for any competitor.
- **Nothing tested as a user.** No account was created anywhere, ours included.
- **Only ~30 platforms.** The charter says track at least 30 continuously; this
  is one snapshot of roughly that many, not a continuous watch.
- **No non-English platforms examined** — Chinese, Russian and regional
  intelligence products are absent entirely, which for a product claiming
  global coverage is a significant blind spot of its own.

---

## 5. What was reached, so the gap is measurable

27 of 30 sites returned `200` and were read as text. Our own live app was read
through both its HTML and `/api/world`. The findings drawn from those are
evidence; everything in sections 1–4 above is not, and no conclusion in
`docs/COMPETITORS.md` may rest on it.
