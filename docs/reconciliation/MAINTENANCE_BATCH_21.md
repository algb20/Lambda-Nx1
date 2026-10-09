# Maintenance Batch 21 — terms that had never been read (2026-10-08, R329)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R329; wave W5 of `WORK_PLAN_R328.md` |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `b24e38d` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## Scope

Before this batch, 114 registry records were UNCLEAR with basis TERMS_NOT_READ. Thirty-three of them were catalogue sources **running** under review (R317).

Two rules applied throughout:
- A record changes only on the provider's own words, quoted with URL and date.
- A refusal (403, bot challenge, empty 202) is recorded, never worked around.

## Results — 12 records decided, each on a quote

| Source | Before | After | The provider's words (read 2026-10-08) |
|---|---|---|---|
| `uk_carbon_intensity` | UNCLEAR | **VERIFIED_CONDITIONAL** (CC BY 4.0) | "Our API is licensed under the CC BY 4.0 license." — carbonintensity.org.uk. Its separate Terms of Use host did not answer; still unread, noted in the record. |
| `ietf_rfc` | UNCLEAR | **VERIFIED_CONDITIONAL** | TLP 5.0 §3.c.iii: "to copy, publish, display and distribute unmodified portions … provided that … each such portion is clearly attributed to IETF and identifies the RFC". Read from the Trust's PDF. |
| `jpcert` | UNCLEAR | **VERIFIED_CONDITIONAL** | 「本ウェブサイトで公開している文書の引用は自由に行っていただけます。…引用元名、資料名、URLを明示」 — quotation is free when source name, title and URL are shown. JPCERT asks to be told by email (D10). |
| `nsidc_news` | UNCLEAR (ambiguous) | **VERIFIED_CONDITIONAL** | "You may download and use photographs, imagery, or text from our web site, unless limitations for its use are specifically stated. Please credit the National Snow and Ice Data Center". |
| `ooni_measurements` | UNCLEAR, catalogue said **CC BY** | **RESTRICTED** — withheld | `ooni/license` data/LICENSE.md: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0". The earlier CC BY entry was wrong. |
| `wto_news` | UNCLEAR | **RESTRICTED** — withheld | "Commercial use of materials from the website requires written permission from the WTO." |
| `snb_press` | UNCLEAR | **RESTRICTED** — withheld | "… may be saved, translated (with reference to the source), transmitted or used in other ways, for non-commercial purposes". |
| `bsi_germany` (CERT-Bund) | UNCLEAR | **RESTRICTED** — withheld | „Eine kommerzielle Verwendung von Inhalten … bedarf einer lizenzrechtlichen Vereinbarung mit dem BSI." Verbatim quotation is allowed (§III), but whether a commercial headline feed counts as a quotation is a legal question, so the stricter reading applies. |
| `ubuntu_usn` | UNCLEAR | **RESTRICTED** — withheld | "… for personal, education and non-commercial use only." Ubuntu advisories stay reachable through OSV (CC BY-SA 4.0). |
| `redhat_security` | UNCLEAR | **RESTRICTED** — withheld | "… a copyright license to copy such material for your own personal or internal business purposes." DISCOVERED: Red Hat's security data (CSAF/VEX, RHSA feed) is CC BY 4.0. Adopting it is a source decision. |
| `rnz_pacific` | UNCLEAR | **PROHIBITED** — withheld | "The RSS Feeds must not be used to aggregate content on other websites. They are intended for personal use only." |
| `project_zero` | UNCLEAR, terms not read | UNCLEAR, **AMBIGUOUS_TERMS** | Google's Terms of Service give no grant for republishing blog posts (paraphrase recorded). |

**Effect:**
- Active catalogue sources: **127 → 120**.
- Registry: UNCLEAR 123 → 112; VERIFIED_CONDITIONAL 102 → 106; RESTRICTED 57 → 63; PROHIBITED 5 → 6.
- Credits index: 183 → 176 entries. Withheld sources lose their credit; three verified sources gain an exact credit wording.

**Tests:** `s-invariants.test.ts` pins the seven new withholdings. The registry rules, credits drift test and catalogue tests all pass.

## Still unread, and why

| Reason | Sources |
|---|---|
| Terms page refuses this network (403/406), not worked around | `science_news`, `abc_au`, `ndtv_india`, `dawn_pakistan`, `africanews`, `euronews`, `france24`, `france24_arabic`, `ifrc_appeals` (JavaScript only) |
| No terms found at any official path tried | `krebs`, `thehackernews`, `kyivindependent`, `allafrica`, `kathmandupost` (no reuse clause), `inmet_brazil`, `rbi_india` ("All Rights Reserved" notice only) |
| Host unreachable from this network | `cwa_taiwan`, `kma_korea` |
| JavaScript-rendered terms | `mempool_blocks` |
| Terms read, but no clause on this use | `blockstream_blocks` |
| PAHO | The permissions page renders only navigation here. Secondary sources say PAHO material is CC BY-NC-SA 3.0 IGO, which is not verified, so the record is left unchanged until the provider's page is read. |

All of these keep running under review, as R317 requires.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2867 passed, 10 skipped |
| `next build` | OK |
