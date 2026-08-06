# Source Catalog — keyless-first, with fallbacks

Sources our engine builds on. Priority: **keyless & free** (no signup) so nothing can shut
us down; each capability has ≥2 sources for redundancy (Charter #3/#4). Keyed sources are
optional enhancers, added only if the user provides keys.

Legend: 🆓 keyless · 🔑 needs key (optional) · passive = read-only, never touches target.

## Domain / Infrastructure (Module 1)

| Capability | Primary 🆓 | Fallback / extra |
|---|---|---|
| DNS records | DoH (Cloudflare `1.1.1.1`, Google `dns.google`) 🆓 | authoritative NS query 🆓 |
| WHOIS / registration | **RDAP** (rdap.org, registry RDAP) 🆓 keyless & structured | WHOIS text fallback 🆓 |
| Subdomains | **crt.sh** (CT logs) 🆓 | certspotter 🆓 · HackerTarget hostsearch 🆓 |
| Tech fingerprint | our own HTTP header/HTML/JS fingerprinter 🆓 | Wappalyzer signatures (OSS) 🆓 |
| History / archived | **Wayback CDX API** 🆓 | archive.today 🆓 |
| IP geo / ASN | ipapi/ipwho.is-style keyless 🆓 | RIR RDAP (ARIN/RIPE) 🆓 |
| IP exposure | **Shodan InternetDB** (keyless) 🆓 | GreyNoise community 🔑 |
| URL inspection | urlscan.io public 🆓 | — |

## Email / Username (Module 2)

| Capability | Primary 🆓 | Fallback / extra |
|---|---|---|
| Breach exposure | HIBP range/k-anon (yes/no only) 🆓/🔑 | XposedOrNot 🆓 |
| Username enumeration | our checker over public profile URLs (WhatsMyName-style dataset, 50+ sites) 🆓 | — |
| Email validity/shape | MX/SMTP-safe checks 🆓 | — |

## Media / content (Module 3)

| Capability | Primary 🆓 | Fallback / extra |
|---|---|---|
| EXIF/metadata | our own parser (exif) 🆓 | — |
| Reverse image | deep-link to Yandex/Google/TinEye/Bing 🆓 | — |
| AI-content hints | heuristic + metadata consistency 🆓 | detector API 🔑 |

## Companies / sanctions (later)

OpenSanctions 🆓 · OpenCorporates 🔑 · GLEIF 🆓 · Companies House 🆓 · SEC EDGAR 🆓

## Radar watch feeds (`watch` capability — internal knowledge base)

Standing feeds, not subject queries: `input.value` is a feed key from the curated
watchlist (`lib/radar/watchlist.ts`), and each source serves only the keys it owns.
Rationale, grading and the not-yet-automated list live in `docs/RADAR.md`.

| Feed | Source 🆓 | Grade |
|---|---|---|
| Known Exploited Vulnerabilities | CISA KEV catalogue 🆓 | A/1 · confirmed |
| Cybersecurity advisories | CISA advisories feed 🆓 | A/2 · probable |
| AI papers (daily, attention-weighted) | Hugging Face daily papers 🆓 | C/3 · possible |
| Preprint frontier (cs.CR/cs.AI/cs.LG/cs.DC) | arXiv category listings 🆓 | C/3 · possible |

## Rules for adding a source

1. Passive (read-only). 2. Public + lawful. 3. Respect robots/ToS/rate limits.
4. Implement the `Source` interface. 5. Register under a capability with ≥1 sibling for
fallback. 6. Normalize output into our Evidence model.

> Full landscape (250+ tools, 20 disciplines) is in `docs/OSINT_REFERENCE.md`. This file is
> only what our engine *implements*, keyless-first.
