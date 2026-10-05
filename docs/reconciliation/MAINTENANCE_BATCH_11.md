# Maintenance Batch 11 — the 184 unevidenced catalogue licences, read (2026-10-05, R318)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R317 (licence rules); R318 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `776b173` |
| **Status words** | REPO-PRESENT + REPO-TESTED. Nothing here is a Master status, and no status is a legal opinion. |

## 1. What was open

R317 left 184 catalogue records (`PRIOR_RECORD_NO_EVIDENCE`, called "188" in that report before four were researched). Each carried a licence written into the catalogue before 2026-10-04 with no evidence on file. Most were `publicFeed(...)`, a helper that treats "publishes an RSS feed" as a commercial syndication grant. R317 forbids exactly that assumption ("public ≠ redistributable").

## 2. Method

1. For every provider, the terms page was fetched directly.
   - The page recorded in the catalogue was tried first.
   - If that was a home page or dead, the provider's actual terms, copyright or licence page was tried, often several paths.
   - PDFs were decoded (IGN).
2. The sentences on licence, commercial use, redistribution, feeds and automated access were quoted into the registry, with URL and date.
3. Each quote was classified with the R317 statuses:
   - **VERIFIED** needs an express grant (CC BY, OGL, Licence Ouverte, an equivalent own grant).
   - **RESTRICTED / PROHIBITED** needs an express restriction that reaches this product's use.
   - **LEGAL_REVIEW_REQUIRED** where two express texts pull in different directions.
   - **UNCLEAR** where the terms could not be read, with the reason and date.
4. Where the terms withhold, the catalogue licence was corrected (`nonCommercial` / `needsAgreement`). The existing gate then removes the source from the active set. Nothing is deleted: the record, the evidence and the remedy stay.

## 3. Results — the 184

| Outcome | Records | Policy |
|---|---|---|
| VERIFIED_CONDITIONAL | 65 | runs (conditions: attribution, notices) |
| LEGAL_REVIEW_REQUIRED | 12 | runs, flagged |
| UNCLEAR | 73 | runs, flagged; each says why the terms were unreadable |
| RESTRICTED | 32 | withheld |
| PROHIBITED | 2 | withheld |

Active catalogue sources: **164 → 139**. Several withheld records were already quarantined for reachability.

### 3.1 Verified (express grant, quoted)

- **MeteoAlarm (39 country feeds):** "MeteoAlarm License (CC BY 4.0)"; the Atom feeds are offered "for Re-users".
- **Seismology:**
  - EMSC: CC BY 4.0. Its attribution was corrected to name EMSC, with the licence statement URL.
  - INGV: CC BY 4.0.
  - Geoscience Australia: CC BY 4.0.
  - GeoNet: CC BY 3.0 NZ.
  - IGN Spain: CC BY 4.0 under Orden FOM/2807/2015.
  - JMA: Public Data Terms v1.0, CC BY 4.0-compatible.
- **Weather:** DWD (CC BY 4.0), Met Office (OGL).
- **UK government (OGL v3.0):** GOV.UK (UKHSA, AAIB, MAIB), ONS, NCSC.
- **Central banks and regulators:**
  - Bank of Canada and ECB: free use with credit; buyers told the content is free.
  - RBA: CC BY 4.0.
  - ESMA: reproduction authorised with source.
  - Eurostat: CC BY 4.0.
- **Security:** CERT-EU (CC BY 4.0), CERT-FR (Licence Ouverte 2.0), OSV.dev (per-ecosystem open licences).
- **Other:**
  - GDACS: European Commission CC BY 4.0, aligned with the coded `gdacs` record of batch 09.
  - arXiv: metadata CC0.
  - W3C: Document Licence.
  - Wikipedia: CC BY-SA.
  - CoinGecko: the same API terms as the coded CoinGecko sources.

### 3.2 Withheld (express restriction, quoted)

| Group | Sources | What the terms say |
|---|---|---|
| International news | BBC (EN, AR), Guardian, NPR, Al Jazeera (EN, AR), NHK, Nature | Business use of BBC feeds needs a licence. Guardian terms cover RSS and are personal/non-commercial. NPR feeds are for personal or 501(c)(3) sites only. Al Jazeera is personal/non-commercial, with no bots. NHK bars reuse. Nature bars syndicating feeds. |
| Automated access banned outright | SCMP, DER SPIEGEL (**PROHIBITED**) | SCMP: "prohibited from using any automated system … for any purpose". SPIEGEL lists "die Nutzung für RSS-Feeds" as not permitted. |
| Regional news | Infobae, The Hindu, Middle East Eye, An-Nahar, Folha, The Daily Star | Personal or non-commercial use only, or written permission required. |
| Provenance failure | `ap_topnews` | The feed is a third-party full-text re-feed (feedx.net), not AP's. No AP licence can reach Lambda through it. |
| UN / humanitarian | ReliefWeb (2), FAO GIEWS | ReliefWeb is personal/non-commercial. FAO allows only news releases freely; GIEWS is not one. |
| Agencies and banks | ESA, Bank of England, Bank of Japan, World Bank news, FCA, FINRA | ESA is personal/non-commercial. BoE is personal or internal. BoJ needs permission for commercial use. World Bank site materials are non-commercial (its CC BY data catalogue is unaffected). FCA bars storage in another retrieval system. FINRA is non-commercial. |
| Weather / hazards | BoM warnings, Météo-France vigilance, NRCan quakes | BoM: "not for commercial use". Météo-France: private or educational use only on the public-data site. NRCan: commercial redistribution needs permission. |
| Internet measurement | RIPE Atlas, RIPEstat | Commercial use needs RIPE NCC permission. |
| Security | MSRC, BleepingComputer, SANS ISC | Microsoft defaults to personal/non-commercial. BleepingComputer allows storage only for personal use. SANS ISC is CC BY-NC-SA 4.0. |

### 3.3 Under legal review (two express texts disagree; still running)

- **UN News.** The copyright notice says "News-related material can be used as long as the appropriate credit is given and the United Nations is advised". The general terms of use say "personal, non-commercial". Advising the UN is an owner action.
  - This was first classified RESTRICTED from the terms of use alone. The copyright page was re-read before commit and the classification corrected; the UN feeds in the statements board were left running.
- **Personal data.**
  - The Gazette: OGL "does not cover the re-use of personal data".
  - Companies House: the register holds officers' personal data.
- **Per-record third-party licences, like CKAN.** OpenAQ (latest and measurements).
- **Data versus surrounding content.**
  - Copernicus Data Space: Sentinel data are free; other portal content is non-commercial.
  - World Bank procurement and debarred lists: the API is non-commercial unless the data is a CC BY catalogue dataset.
- **Publishers' rights versus the index's licence.** AFP via GDELT: GDELT licenses its index, not AFP's headlines.
- **Data licence versus site use policy.**
  - BGS quakes: re-use of data products needs a licence, but the feed is not named.
  - GitHub advisories: the data is CC BY 4.0, but the acceptable-use policy applies.
  - Internet Society Pulse: the site terms bar robots; the API's own terms page answered 404.

### 3.4 Unreadable (UNCLEAR, reason dated)

There are 73 such records. They are mostly news sites behind 403/406/451 or bot challenges, plus agencies whose terms pages are 404 or JavaScript-only:
- news sites: DW, France 24, ABC, CBC, CNA, El País, Le Monde, Euronews, Al Arabiya, Sky News Arabia, Dawn, NDTV, Nation and others;
- agencies and organisations: OECD, IMF, IEA, OPEC, IRENA, UNHCR, IFRC, PAHO, Africa CDC, national weather services, mempool.space, BSE, and others.

They keep running under review (R317). Each record states what was tried.

## 4. Defects found and fixed beyond the 184

| # | Defect | Fix |
|---|---|---|
| 1 | The coded `official_statements` board read UN feeds that the catalogue record would refuse. The S-invariant-4 test caught it on the first run. | Not withheld after the UN copyright carve-out was read (§3.3); the record states the pending owner action. |
| 2 | **Four coded records were VERIFIED on an absence of restriction** ("no restriction on commercial use is stated"), labelled EXPRESS_GRANT: `mempool`, `mempool_network`, `dns.google`, `github`. This is the exact R317 prohibition, carried into the registry when it was built. | `mempool`, `mempool_network` and `dns.google` → UNCLEAR / ABSENCE_OF_RESTRICTION. `github` → LEGAL_REVIEW_REQUIRED (its acceptable-use policy is quoted). All still run. New test: no VERIFIED record may rest only on absence wording. |
| 3 | The catalogue licences of NRCan, BoM, ESA, World Bank news, RIPE (2), FCA, FAO and ReliefWeb said CC BY or OGL. The providers' terms say otherwise. | Corrected. These are the "transcribed wrongly, and the wrong transcription will be the permissive one" case `licence.ts` warns about. |
| 4 | The registry's Markdown view had no generator in the repository. | `scripts/render-licence-registry.py`. |

## 5. CKAN path repair (GL-11)

No portal could be repaired by a path change:

| Portal | Probe on 2026-10-05 | What it would take |
|---|---|---|
| **US** | The CKAN API now lives at `api.gsa.gov/technology/datagov/v3/action/package_search` and answers `403 API_KEY_MISSING`. | An api.data.gov key, placed in the environment only. Owner action. |
| **Austria** | Three CKAN paths answer 404. | No successor API found. |
| **Portugal** | The portal now runs **udata**: `/api/1/datasets/` answers 200. | A udata adapter. DISCOVERED — an engine addition, not a repair. |
| **Romania** | Connection reset. | Nothing yet. |

The notes are recorded in `portals.ts`. All four stay disabled.

## 6. Coverage now withheld with no verified fallback (GAP, stated rather than hidden)

- Australian weather warnings (BoM).
- Broad English-language world news from public broadcasters (BBC, NPR, ABC unreadable, CBC unreadable). GDELT remains, under review for publisher rights.
- Humanitarian situation reports (ReliefWeb). GDACS and IFRC GO remain, the latter unreadable.
- Internet routing (RIPEstat) and measurement (RIPE Atlas). OONI remains under review.
- **DISCOVERED replacements, not adopted:**
  - Red Hat's RHSA feed is CC BY 4.0 (`access.redhat.com/security/data`);
  - Météo-France open data under Licence Ouverte (`meteo.data.gouv.fr`, unreachable on the day).

## 7. Tests

- New conformance tests:
  - R318 withholdings stay withheld;
  - no record stands on an unevidenced earlier licence;
  - no VERIFIED record rests on absence wording.
- Suite: see the ledger entry R318.
