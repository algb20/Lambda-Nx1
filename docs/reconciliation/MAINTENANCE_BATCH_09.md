# Maintenance Batch 09 — the last unread terms; CKAN licence gate; a rate limit (2026-10-05, R316)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R316 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `dc20285` |

## 1. Method

The 18 sources left unread in batch 08 were tried again by another route: the terms page fetched directly, its text extracted, and the sentences on licence, commercial use, automation and rate quoted.

## 2. Results

| Source | Terms (quoted) | Classification |
|---|---|---|
| `wikimedia_pageviews` | "All Analytics datasets are available under the Creative Commons CC0 dedication." | **verified** |
| `openalex` | Official docs: "Our complete dataset is free under the CC0 license"; 100,000 calls / day | **verified** |
| `gdacs` | The site links the European Commission copyright notice: CC BY 4.0, "provided appropriate credit is given and changes are indicated" | **verified** (alerts link to GDACS reports) |
| `dns.google` | Google APIs Terms: access "only … by the means described in the documentation"; no commercial bar | **verified** |
| `dns.cloudflare` | 1.1.1.1 terms: Cloudflare website terms apply; attribution only for ISPs and equipment makers integrating it | **verified — by absence of restriction** |
| `rdap` | "a maximum of 10 requests in 10 seconds" per IP; no use restriction | **verified — by absence of restriction.** **Defect fixed:** spacing was 500 ms (20 per 10 s); now 1000 ms. |
| `iss_position` | "limited to roughly 1 per second"; no use restriction | **verified — by absence of restriction** (spacing 3000 ms) |
| `ethereum_rpc` (PublicNode) | Users "agree not to … scrape … display, distribute, transmit, publish … the Service or the Service Content commercially and non-commercially" | **DECISION REQUIRED.** Is chain data "Service Content"? An RPC with permissive terms, or our own node, removes the question. |
| `wayback`, `courtlistener`, `celestrak` | Terms page unreadable (no extractable text / 403 / connection reset) | still unverified, reason updated |
| `crtsh`, `hackernews` | No terms published | still unverified |
| `crypto_news`, `factcheck`, `username.web` | Several publishers each; not yet read one by one | still unverified |
| `pi_network` | Developer-terms page renders no text | still unverified — Lambda NX's own platform |

"Verified by absence of restriction" is stated in each entry's evidence. It is weaker than an express grant, and is labelled so.

## 3. CKAN federation — licence gate (gap NEW-12 closed)

Every portal's metadata licence was recorded, but `activePortals()` never consulted it. It now admits only portals the licence gate accepts. Today the only refused portal, `who_gho`, is also disabled, so nothing changes at runtime; the next refused portal cannot slip in by being enabled.

**Test:** an enabled portal with a refused licence is excluded, and `who_gho` is never active.

## 4. Rate limits pinned from the terms

`lib/engine/sources/rate-terms.test.ts` pins the minimum spacing each provider publishes:

| Provider | Minimum spacing |
|---|---|
| rdap.org | ≥ 1000 ms |
| Nominatim | ≥ 1000 ms |
| NCBI | ≥ 334 ms |
| arXiv | ≥ 3000 ms |
| wheretheiss.at | ≥ 1000 ms |

A source may be gentler, never faster.

## 5. Registry after this batch

| State | Count |
|---|---|
| verified | 55 |
| refused (none registered) | 9 |
| owner decision | 5 — `xposedornot`, `solana_rpc`, `hf_papers`, `official_statements`, `ethereum_rpc` |
| unread, with reason | 10 |

## 6. Tests

| Check | Result |
|---|---|
| Full unit suite | **2817 passed, 0 failed** |
| `tsc` | 0 |
| UI | No UI file changed |

**Status:** REPO-PRESENT + REPO-TESTED. Not deployed.
