# Maintenance Batch 18 — live audit of active sources: three repaired, twelve quarantined, an audit-tool bug (2026-10-08, R326)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation: "verified repair of moved or failed sources"); R326 «اكمل» |
| **Production** | Not affected; locked on `9c19303` (R306) |
| **Base** | `61b10c0` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

## E1 — Audit

`scripts/audit-feeds.ts` read every enabled catalogue feed from this environment with the engine's own User-Agent:
- 208 audited;
- 125 readable;
- 31 "quiet";
- 52 unreachable. Most of these were already withheld for licence, or already quarantined.

**Defect in the audit tool itself:**
- **What:** it read `geojson` sources as RSS, so the three USGS earthquake feeds were always reported "quiet" while they carried events (7, 27 and 3 that day).
- **Fix:** one line. GeoJSON goes through the JSON reader, which already handles `features`.

## E2 — Repairs (moved, with verified official replacements)

| Source | Was | Now | Read on 2026-10-08 |
|---|---|---|---|
| `ga_quakes` | `feeds/atom.xml`, which now serves the web app's HTML | GA's own WFS: `earthquakes_seven_days` as GeoJSON, mapped as JSON. The headline comes from `description`; it also maps the event page, origin time, coordinates and preferred magnitude. | 59 events |
| `usgs_volcano` | `vhp/rss/hans.xml`, which redirects to an HTML page | HANS public API `notice/getNewestOrRecent`. Headline: "{noticeType}: {volcanoes} ({observatory})". Uses the notice URL and the Unix send time (UTC). | 98 notices |
| `cert_fr` | `/avis/feed`, which redirects to the 404 page | `/avis/feed/`, the address the site links | 40 advisories |

- Old URLs are kept in `formerUrls`. Licences are unchanged: same publisher, same material.
- `moved-sources.test.ts` pins both new mappings on trimmed copies of the day's real payloads (headline, link, time, coordinates, magnitude).

## E2 — Quarantined, dated, with the reason

Observed from one network only. The daily recheck releases any entry that answers and reads.

| Reason | Sources |
|---|---|
| **bot-blocked (403)** | DW, CNA, El País, Le Monde, Punch, Clarín |
| **unreachable (451)** | Bangkok Post. "Unavailable For Legal Reasons" on this network. |
| **frozen (200, nothing current)** | `cdc_outbreaks` — the URL is CDC's "2019 Novel Coronavirus" feed, last built 2025-03-31, with no items; a current CDC outbreak feed was not found. |
| | `nist_cyber`, `africa_cdc`, `rferl` — channels with zero items. |
| | `pm25_lass` — zero records. |

- **Not quarantined: Smithsonian (`si_volcano_weekly`).** Its 403 page still reads "Smithsonian site temporarily unavailable". The 2026-10-04 decision, protected by a test, keeps that case out. The test caught my first attempt to add it.
- **Switched off by decision: `wikipedia_current`.** The parse API returns the portal as HTML, which the catalogue adapter cannot read, so the record had never produced a finding. The same coverage comes from the coded `wikipedia_itn`.

**Active catalogue sources: 139 → 126.** The count now matches what actually produces findings (charter §2a: honest counts).
