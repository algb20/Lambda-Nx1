# Pending — items only the owner can complete

| | |
|---|---|
| **Purpose** | One living list of everything that cannot be finished in the repository: keys, environment variables, decisions, permissions, writes to live systems. Owner R322: «احفظ في قائمة غير المكتمل مثل المفاتيح أو المتغيرات وغيرها». |
| **Rule** | No secret value is ever written here, in Git, or in any file (owner S2). A key is named; its value goes only into the hosting environment, by the owner. |
| **Production** | Locked on `9c19303`. No Production environment variable or deploy is changed without a new owner decision (R306). |
| **Updated** | 2026-10-09 (R332). Each item says where it came from. Close an item by striking it through, with the date and the commit or decision. |

## A. Source keys and tokens (environment only)

Setting a key is not enough. Each source still runs only if its licence allows it: the registry status is shown beside it.

| Variable | Source(s) | What it unlocks | Licence status | Notes |
|---|---|---|---|---|
| `NASA_API_KEY` | `science.ts` | NASA APIs above the shared demo-key limits | verified (US gov) | R312: key in the environment only |
| `RELIEFWEB_APPNAME` | `reliefweb_disasters`, `reliefweb_reports` | ReliefWeb API (an app name, not a secret) | **RESTRICTED** — personal, non-commercial (R318) | Pointless until ReliefWeb grants commercial use |
| `COMPANIES_HOUSE_API_KEY` | `uk_companies_house` | UK company register | LEGAL_REVIEW_REQUIRED (personal data) | The key alone does nothing: the record is a stub (web front end, no API mapping), and a test keeps it off until decision C5. After C5: build the API integration with a personal-data rule |
| `OPENAQ_API_KEY` | `openaq_latest`, `openaq_measurements` | Air quality (v3 needs a key) | LEGAL_REVIEW_REQUIRED (per-provider licences) | — |
| `EIA_API_KEY` | `infrastructure.ts` | US energy data | verified (US gov) | — |
| `ENTSO_E_TOKEN` | `entsoe_transparency` | European electricity data | UNCLEAR (terms page 400) | — |
| `COPERNICUS_TOKEN` | `keyed.ts` | Copernicus services | LEGAL_REVIEW_REQUIRED | — |
| `EPO_OPS_KEY` | `epo_ops_patents` | European patents | LEGAL_REVIEW_REQUIRED (fair-use charter unread) | — |
| `GFW_API_TOKEN` | `global_fishing_watch` | Vessel activity | **PROHIBITED** — non-commercial only | Do not set; no use is possible |
| `GOOGLE_FACTCHECK_KEY` | `google_factcheck_tools` | Fact-check search | LEGAL_REVIEW_REQUIRED | — |
| `SAM_GOV_API_KEY` | `keyed.ts` | US federal contracts | US gov | — |
| `USGS_M2M_TOKEN` | `keyed.ts` | USGS machine-to-machine data | US gov | — |
| `USPTO_ODP_KEY` | `keyed.ts` | US patents | US gov | — |
| `WORLDBANK_API_KEY` | `keyed.ts` | World Bank keyed API | see registry | — |
| `OPENALEX_API_KEY` | `openalex` (research gateway) | Its own request budget: keyless calls share a daily budget per IP address, and serverless addresses exhaust it (429 on 2026-10-08) | verified (CC0) | Free key from OpenAlex. Batch 19 wired it; without it the source works until the shared budget runs out |
| api.data.gov key (name to be fixed when wired) | CKAN `us_data_gov` | US open-data catalogue (moved to api.gsa.gov) | public domain metadata | Batch 11 §5; code change needed after the key exists |

## B. Platform variables (owner sets per environment)

Listed so none is forgotten. Whether each is set in a given environment is **UNVERIFIED** here; checking means reading hosting settings, an owner-authorised action.

| Group | Variables |
|---|---|
| **Core** | `DATABASE_URL` (Production: do not change, R306), `SESSION_SECRET`, `CRON_SECRET` (Production: do not change, R306), `ADMIN_SECRET`, `SOCIAL_SECRET_KEY` |
| **Providers** | `AUTH_PROVIDER`, `PAYMENT_PROVIDER`, `STORAGE_PROVIDER`, `QUEUE_PROVIDER`, `MAIL_PROVIDER`, `AI_PROVIDER`, `NEXT_PUBLIC_AUTH_MODE` |
| **Pi** | `PI_API_KEY`, `PI_API_BASE` |
| **Payments (standalone)** | `STRIPE_SECRET_KEY` |
| **Mail** | `MAIL_FROM`, plus one of `RESEND_API_KEY` / `BREVO_API_KEY` / `POSTMARK_TOKEN` / `SMTP_URL` |
| **AI analyst** | `ANTHROPIC_API_KEY`, `ANALYST_MODEL` |
| **Translation** | `DEEPL_API_KEY` or `GOOGLE_TRANSLATE_API_KEY` |
| **Engine** | `ENGINE_CONTACT` (contact address in the User-Agent) |

## C. Decisions only the owner can take

| # | Decision | Source |
|---|---|---|
| C1 | Notify the UN, as its copyright notice requires for news material (keeps `un_news` and the UN feeds on the statements board) | R318; batch 11 §3.3 |
| C2 | AI/ML use of source content when the terms say nothing (default for the AI analyst). Research done (batch 17): of 210 readable terms pages only GitHub, Docker Hub and Nominatim mention AI, none about summarising; the rest are silent | GL-08, BC-4 |
| C3 | Username-presence capability (HIGH personal-data risk) | GL-10 |
| C4 | Build a udata adapter (Portugal; it would also serve France's data.gouv.fr) | Batch 11 §5 |
| C5 | Companies House: may officer and PSC data appear at all, and in what form? | GL-13; batch 14 |
| C6 | Dedicated RPC provider or own node (Ethereum, Solana) | R317 |
| C7 | XposedOrNot: does Lambda's use count as "personal and low-volume"? | R317 |
| C8 | Approve Blueprint changes BC-1 to BC-8 (licence registry into the Policy Engine, terms-change detection, and the rest) in the Master unification session. Already built in the repository: `npm run check:terms` (BC-5, manual today) and credits beside findings and in every export (BC-8; social publishing waits for 30.27.8.R) | Gap audit §4; batch 15 |
| C9 | Lift the Production pause, when 30.27.8.R is closed | R294, R306 |
| C10 | EU AI Act Art. 50(4): before publishing resumes, the Publication contract decides whether AI-written text carries the disclosure or passes a recorded human editorial review. Also: is Lambda a "deployer" publishing "to inform the public"? (legal advice). The interface already labels AI text "AI-generated" (batch 20) | R328; `docs/RESEARCH/FIELD_2026-10-08.md` §1 |
| C11 | Adopt licence-verified fallbacks as new sources: Kystverket open AIS (NLOD, Norway only), Tor metrics/Onionoo (CC0), adsb.lol historical flights (ODbL, share-alike on the database). Each needs a source specification before code | GL-09; batch 22 |
| C12 | Retry budget (BP §15, NEW-05): may the engine retry a failed call within one run, how often, and with what backoff? The part charter §3 already requires — never calling a host before its `Retry-After` — is built (batch 24); no retry was added | NEW-05; batch 24 |
| C13 | CourtListener's terms forbid any FCRA use of data derived from it (credit, employment, housing, insurance eligibility; consumer reports). Should Lambda's own terms of service pass that restriction to users, and should court-record results carry a notice? The source runs under review meanwhile (LEGAL_REVIEW_REQUIRED) | Batch 26 |

## D. Permissions and agreements to request (owner action)

| # | From | For | Source |
|---|---|---|---|
| D1 | abuse.ch / Spamhaus | Account or subscription for threat feeds (Feodo, URLhaus, ThreatFox) | Batch 07 |
| D2 | WHO | Written authorization for commercial use | Batch 07 |
| D3 | BIS | Commercial reproduction | Batch 08 |
| D4 | OpenSky, OpenSanctions, Shodan, urlscan | Commercial licences | Batches 05–06 |
| D5 | BBC, Guardian, NPR and the other withheld publishers | Licences, if their coverage is wanted | Batch 11 |
| D6 | RIPE NCC | Commercial use of RIPEstat / Atlas, or use RouteViews (CC BY 4.0) instead | Batches 11–12 |
| D7 | Brazil open-data portal | API token | Batch 10 |
| D8 | Mexico, Africa open-data portals | Allow-listing (they block automated requests) | Batch 10 |
| D10 | JPCERT/CC | Courtesy notice by email (office@jpcert.or.jp) that Lambda quotes its advisories — JPCERT asks for it; the source runs meanwhile | Batch 21 |
| D11 | WTO | Written permission for commercial use (permissions by e-mail to the WTO) — `wto_news` withheld until then | Batch 21 |
| D12 | BSI (CERT-Bund) | Licence agreement for commercial use — `bsi_germany` withheld until then | Batch 21 |
| D13 | RNZ | Express permission to aggregate its RSS feeds — `rnz_pacific` withheld until then | Batch 21 |
| D14 | OONI, Swiss National Bank, Canonical (Ubuntu), Red Hat | Commercial-use permission, if their coverage is wanted. Alternatives exist for two: Ubuntu advisories through OSV, and Red Hat's CC BY 4.0 security data (a source decision) | Batch 21 |

## E. Writes to live systems awaiting per-action authorisation

| # | Action | Prepared | Source |
|---|---|---|---|
| E1 | Quarantine stored Gazette findings that name private individuals (made before R321) | **Ready:** `db/ops/gazette-personal-quarantine.sql` and `gazette-personal-restore.sql`. Tested 2026-10-08 on a scratch PostgreSQL 16 loaded with `db/schema.sql`: quarantine, a second run that changes nothing, a full restore, and a restore after the investigation was deleted (those rows stay quarantined). **Not run on any live database.** Run after the deploy that carries `acd8c97`. | R321 |
| E2 | Anything on Production (`DATABASE_URL`, `CRON_SECRET`, deploys) | — | R306 |

## G. Repository actions

| # | Action | Why | Source |
|---|---|---|---|
| G1 | Merge `claude/bittorent-network-app-c8j9pv` into `main` (via a pull request, when the owner asks for one) | `main` still has `source-map-js` 1.2.1 — GitHub Dependabot alert #15 (high), fixed on this branch in batch 17. It also carries batches 11–17. Merging does not deploy Production (R306) | Batch 17 |

## F. Open research that Claude continues (no owner action needed)

These are tracked in `SOURCE_LICENSING_GAP_AUDIT_2026-10-05.md`, not here:
- the 74 unreadable terms pages;
- the fallbacks still missing (GL-09);
- terms-change detection (GL-06);
- per-finding attribution (GL-04);
- ~~a current official CDC outbreak feed to replace `cdc_outbreaks` (batch 18)~~ — done 2026-10-08, batch 20 (CDC media 285676);
- re-reading the 12 sources quarantined on 2026-10-08 from a second network (re-read from this network in batch 20: all still refused);
- research findings F-2 to F-4 (conditional GET, GDELT export files, C2PA) in `docs/RESEARCH/FIELD_2026-10-08.md`.
