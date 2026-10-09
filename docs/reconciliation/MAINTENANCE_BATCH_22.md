# Maintenance Batch 22 — fallbacks for capabilities with none (GL-09), and a stale fallback (2026-10-09, R330)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R330; wave W6 of `WORK_PLAN_R328.md` |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `c68c5d4` |
| **Status words** | Candidates are **DISCOVERED**: none is added to the catalogue. Adding a source is an adoption decision (CLAUDE.md §2 rule 2), so they wait for owner decision C11. |

## 1. Defect fixed: a withheld source offered as a fallback

| | |
|---|---|
| **Reproduce** | The `ripe_atlas_anchors` record listed `ooni_measurements (under review)` as a fallback. OONI was withheld in batch 21, because its data is CC BY-NC-SA 4.0. |
| **Root cause** | Fallbacks were free text. Nothing checked them against the policy of the source they name. |
| **Patch** | The entry is removed. M-Lab (CC0, BigQuery caveat) remains the recorded fallback. |
| **Test** | `s-invariants.test.ts`: "never names a withheld source as a fallback". It resolves every fallback naming a registry id and fails if any of them is WITHHOLD. |

## 2. Candidates, licence read on the provider's own page

Every row below was read on 2026-10-09.

| Capability (GL-09) | Candidate | Licence, in the provider's words | Verdict |
|---|---|---|---|
| **Maritime vessels** | Norwegian Coastal Administration (Kystverket) open AIS, also via BarentsWatch | "The data are free and universally accessible, and are regulated under the Norwegian Licence for Open Government Data (NLOD)." Excludes fishing vessels under 15 m and recreational craft under 45 m. | **Verified licence**; Norwegian waters only. The best maritime candidate found. Coverage would be labelled `['NO']`, never global. |
| Maritime vessels | Danish Maritime Authority historical AIS | "You can get access to continuously updated historical AIS data for free." No licence named. | Licence **not verified** (free ≠ licensed, R317). Historical only. |
| **Live flights** | adsb.lol | Its historical database README: "This database is made available under the Open Database License". The API code is BSD-3. | Historical data **verified ODbL** (share-alike on the database). The live API's data licence is not stated where read, so it is not verified for live use. |
| **Network interference** (OONI withheld) | Tor Project metrics / Onionoo | "Data on this site is freely available under a CC0 no copyright declaration". | **Verified CC0.** Covers Tor relays, bridges and per-country Tor usage, not website blocking. It is a partial signal of censorship events, and labelled that way. |
| Network interference | IODA (CAIDA) | No data licence found. CAIDA's general raw-data agreement is research-only (secondary source). | Not verified. |
| Network interference | M-Lab | CC0 (batch 12). | Verified, but served through BigQuery, not a keyless API (unchanged). |
| **Threat reputation** (abuse.ch withheld) | OpenPhish community feed | "You agree not to use any part of the Services for any commercial purposes, including … threat intelligence". | **Rejected.** |
| Threat reputation | PhishTank (Cisco Talos) | The terms link is Cisco's general EULA; nothing on the feed itself. | Not verified. |
| Threat reputation | CINS Army list, Emerging Threats compromised-IPs, blocklist.de | None of them publishes a licence on the page or in the file (the ET file has no header). | Not verified. |
| **Ethereum chain state** | Blockscout PRO API | Documented free plan (key required, 5 RPS, 100 K credits a day); terms of service not found (secondary). | Not verified. A key would be an owner item (§A) once terms are read. |
| IP exposure, scan history, PEP screening, Solana, broadcaster news | — | No openly licensed keyless candidate found this round. | **GAP stays named.** For PEPs, Wikidata (CC0, already VERIFIED_ALLOWED) holds "position held" statements; using it for screening is a capability decision about personal data (C3-like), not a licence question. |

## 3. Effect

- Code: one registry fallback removed; one conformance test added.
- Running sources: unchanged.
- GL-09 row updated with these candidates.
- Owner decision **C11** added: whether to adopt Kystverket AIS, Tor metrics and adsb.lol historical data as sources.

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 2868 passed, 10 skipped |
