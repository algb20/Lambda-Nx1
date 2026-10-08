# Maintenance Batch 14 — the pending list, Gazette quarantine scripts, Companies House guard, provenance rule (2026-10-08, R322)

| | |
|---|---|
| **Authority** | Owner R312 (standing authorisation); R322 |
| **Production** | Not affected; locked on `9c19303` (R306). No live database touched. |
| **Base** | `acd8c97` |
| **Status words** | REPO-PRESENT + REPO-TESTED |

Work order, done in sequence, each item finished before the next (owner R322).

## W1 — Pending-owner list

`docs/reconciliation/PENDING_OWNER_ITEMS.md` lists everything that only the owner can finish:

| Section | Contents |
|---|---|
| A | 14 source keys and tokens, each beside its licence status. Some are pointless to set: `GFW_API_TOKEN` (prohibited), `RELIEFWEB_APPNAME` (restricted). |
| B | Platform variables. |
| C | Decisions. |
| D | Permissions and agreements to request. |
| E | Writes to live systems. |

Variable names only; no value appears anywhere (owner S2).

## W2 — The Gazette: findings stored before the fix (E1)

- **Scripts:** `db/ops/gazette-personal-quarantine.sql` and `gazette-personal-restore.sql`.
  - They move every stored Gazette row (evidence, radar findings, system posts) to `lambda_quarantine` in one transaction.
  - Posts written by people are counted, not moved.
  - Every stored Gazette row is moved because the notice code is not stored, so personal and company notices cannot be separated in the database. Company notices return through the fixed source.
- **Tested on a scratch PostgreSQL 16** loaded with `db/schema.sql`, using synthetic rows:

| Scenario | Result |
|---|---|
| First run | evidence 2, radar 1, system posts 1 moved; 1 user post left in place |
| Second run | changes nothing |
| Restore | everything returned |
| Restore after the investigation was deleted | 2 evidence rows stay in quarantine, as designed |

  The scratch database was then deleted.
- **Not run on any live database.** Owner authorisation per action (CLAUDE.md §9).

## W3 — Companies House

- **The record is a stub.** Its URL is the register's web front end, not its API, and it has no field mapping. Setting `COMPANIES_HOUSE_API_KEY` alone would produce nothing.
- **The register is personal data** (officers, persons with significant control), and the OGL does not cover personal data.
- **Changes:**
  - the record's comment now says so;
  - its registry entry lists the prohibited use;
  - a conformance test keeps it off until owner decision C5.

## W4 — Provenance rule (GL-14)

- **New catalogue field `via`:** how a feed reaches us when its host is not the publisher's. Values: `publisher-hosted`, `aggregator`, `unverified`, `unofficial-refeed`.
- **New test `provenance.test.ts`**, with a negative control:
  - every record on a known intermediary host (FeedBurner, feedx.net, GDELT, rss.app and similar) must declare `via`;
  - the declared host must be the one actually read;
  - an `unofficial-refeed` must be refused by the licence gate and never active.
- **Records annotated:**

| Record | `via` | Basis |
|---|---|---|
| The Hacker News | `publisher-hosted` | its site links the FeedBurner feed |
| NDTV | `unverified` | its RSS page answered 403 |
| AFP via GDELT | `aggregator` | — |
| AP via feedx | `unofficial-refeed` | already withheld |

- **Repaired on the way:** Google Project Zero moved from Blogspot to `projectzero.google/feed.xml`. The old URL now redirects across hosts. The URL is updated and the old one kept in `formerUrls`. The new feed is current (2026-10-06).

## W5 — Verification

See the ledger entry R322.
