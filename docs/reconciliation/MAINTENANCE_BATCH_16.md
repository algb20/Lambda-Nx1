# Maintenance Batch 16 — credits for coded sources and in every export (2026-10-08, R324)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R324 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `330c05c` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## C1 — Coded sources

The credits index (`credits.ts`, batch 15) covered catalogue feeds only. Gateways and boards have no catalogue licence.

- **The index now also covers coded sources.** It takes each verified registry attribution:
  - "Powered by CoinGecko" (6 sources);
  - "© OpenStreetMap contributors" (ODbL);
  - FRED, ECB, World Bank, Eurostat, Elexon, HM Land Registry (OGL), Wikipedia (CC BY-SA), GDACS, GDELT.
- **183 entries now**, up from 158. The drift test covers both kinds.
- **`SourceCredit` is now also used** in the investigation evidence badges and the target tracker (timeline and identity).

## C2 — Exported dossiers (BC-8, as far as the repository reaches)

An export (Markdown, printable HTML, CSV, JSON, shared links) redistributes third-party material. CC BY and OGL ask for the credit in every copy. Until now exports named sources by key only.

- **Each reference now carries** the source's `credit` and, where the registry verified it, its `licence` (name and link to the text).
- **Markdown and HTML:** the reference shows the credit, with the key in brackets, and links the licence. The closing line states that third-party material is reused under the named licences and credits.
- **CSV:** two new columns, `credit` and `licence`, so a single row carries its own credit.
- **JSON:** the fields come with the references.
- **Tests:** the CSV header test is updated. New tests check the credit and licence for a CC BY source (EMSC) in all four formats, and that a source owing nothing carries nothing.
- **Bundle:** `lib/export/dossier.ts` is imported only by server routes (`app/api/export`), so the registry does not reach the browser bundle.

## Not done here

BibTeX and plain citations still name the source by key: citation formats have their own author field conventions. Wiring credits into scheduled social publishing is part of 30.27.8.R (Publication / Export / Share), whose contract is not closed. Publishing stays paused (R294).
