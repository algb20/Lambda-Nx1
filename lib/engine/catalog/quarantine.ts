/**
 * Sources withheld from the sweep because they were **observed** to be broken.
 *
 * ## Why this is a separate file and not 43 edits
 *
 * On 2026-08-14 every active catalogue URL was requested with the engine's own
 * User-Agent and headers. 110 of 159 answered; 49 did not. The obvious response
 * is to go into the feed files and set `enabled: false` on each one — and it is
 * the wrong response, for a reason this project cares about more than most.
 *
 * A catalogue record is a **claim about a source**: where it is, who publishes
 * it, how far it can be trusted. Editing that record to say "off" destroys the
 * distinction between *we decided not to use this* and *we tried and it did not
 * answer*. The first is an editorial choice; the second is an observation with
 * a date, a status code, and a reason — evidence, in other words, and this is a
 * platform built on not throwing evidence away.
 *
 * So the records stay exactly as they were, and what we *observed* lives here,
 * dated, one line per source, with the status the provider actually returned.
 * Re-running the probe against this list is how a source gets released — and
 * since 2026-08-22 that runs on a clock rather than on somebody's memory:
 * `recheck.ts`, driven daily by `/api/cron/sources`. It reports which entries
 * to release; the edit to this file stays a human one, because removing a line
 * from the record of what we observed should be a decision, not a side effect.
 *
 * ## The re-probe of 2026-08-22, and why a status code is not enough
 *
 * The list was retaken. **Eight of fifty-one answered `200`; six were released
 * and two were not**, and the two are the reason this paragraph exists.
 *
 * `thedailystar_bd` answered 200 with ten well-formed items, exactly as it does
 * every time — and its newest item is dated 2022-07-22, silent for 1,492 days.
 * Releasing on the status code would have put four-year-old reporting back onto
 * a live board looking like today's. `saws_south_africa` answered 200 with zero
 * items parsed, which is the same trap wearing different clothes.
 *
 * So a release now requires the document to be *read*: it must parse, contain
 * items, and carry a recent one. The six that passed — `bls_us`,
 * `sec_litigation`, `cisa_advisories`, `nsidc_news`, `redhat_security`,
 * `kyivindependent` — each had an item within two days.
 *
 * The same bar released `scmp_news` on 2026-10-04 (owner, ledger R311). It
 * had answered 403, then 405 on 2026-08-22; the recheck that day read 50
 * items, the newest from that afternoon, with readable headlines, and its
 * robots.txt does not disallow the feed path (it asks a 10 s crawl delay; we
 * poll every 1800 s). Its entry is removed here and kept as history in
 * `docs/reconciliation/MAINTENANCE_BATCH_03.md`.
 *
 * Two entries also named keys that no longer exist in the catalogue at all
 * (`sec_edgar_filings`, `meteoalarm_europe`). A quarantine entry for a record
 * nobody holds withholds nothing; they are gone.
 *
 * ## The three reasons a source is here, and why only one is our fault
 *
 * - **`bot-blocked`** — the provider answered, with a challenge page. IEA and
 *   OPEC return Cloudflare's "Just a moment…"; BLS returns Akamai's "Access
 *   Denied". These feeds are *reachable by a browser* and we will not pretend
 *   to be one: the charter says respect robots, terms and rate limits, and a
 *   bot challenge is the clearest possible statement of a provider's terms.
 *   Working around it would be the single worst thing this catalogue could do
 *   to its own credibility.
 * - **`moved`** — 404 or 410. The publisher reorganised and the URL we hold is
 *   stale. Ours to fix, and the only class here that is genuinely our fault.
 * - **`unreachable`** — DNS or TLS failure, or a server error. May be
 *   temporary; the probe date says when it was last true.
 * - **`frozen`** — answers `200` with a valid document that has not gained a
 *   new item in months. The hardest class to notice and the most damaging: it
 *   passes every health check, counts as an active source, and puts years-old
 *   reporting on a live board looking exactly like today's apart from a date
 *   nobody reads. Found by `lib/analysis/staleness.ts`, which measures the
 *   newest item each feed offers rather than whether it answered.
 * - **`credential`** — the publisher requires a registration we do not hold
 *   (an approved appname, an account key). Not a fault on either side; the
 *   release is an owner action, documented on the record, and the secret or
 *   name lives in the deployment's environment, never in this repository.
 *
 * ## What is NOT done here
 *
 * A blocked feed is not replaced by scraping the same publisher through an
 * aggregator. Google News will happily serve Reuters headlines to anyone, and
 * routing round a paywall or a bot wall through a third party would be both a
 * licence problem and — worse for us — an independence lie: one aggregator
 * wearing twenty mastheads, which is precisely the inflation this catalogue
 * exists to refuse. Where a genuine, machine-welcoming alternative exists it
 * was added to the catalogue as its own record. Where none exists, the gap is
 * left open and the blind-spot map reports it.
 */

export type QuarantineReason = 'bot-blocked' | 'moved' | 'unreachable' | 'frozen' | 'credential'

export interface QuarantinedSource {
  key: string
  reason: QuarantineReason
  /** What the provider actually returned. `0` means no response at all. */
  status: number
  /** ISO date the observation was made. */
  observedOn: string
  /** Anything a person needs in order to fix or release it. */
  note?: string
}

/**
 * The date of the sweep an entry was last observed in.
 *
 * There are two now, and there will be more. A quarantine entry is an
 * observation with a date on it, so re-probing does not overwrite history — it
 * adds a newer observation, and an entry that has not been re-checked keeps the
 * older date and says so.
 */
const PROBED = '2026-08-14'
const REPROBED = '2026-08-22'
/** Production's `/api/diagnose`, confirmed from a second network the same day. */
const OBSERVED_2026_10_04 = '2026-10-04'

const q = (
  key: string,
  reason: QuarantineReason,
  status: number,
  note?: string,
): QuarantinedSource => ({ key, reason, status, observedOn: PROBED, ...(note ? { note } : {}) })

export const QUARANTINE: QuarantinedSource[] = [
  // ── Answered with a challenge page. Their terms, and we respect them. ─────
  q('github_advisories', 'bot-blocked', 403),
  q('usda_reports', 'bot-blocked', 403),
  q('iea_news', 'bot-blocked', 403, 'Cloudflare interstitial.'),
  q('imf_news', 'bot-blocked', 403, 'Cloudflare interstitial.'),
  q('irena_news', 'bot-blocked', 403),
  q('opec_press', 'bot-blocked', 403, 'Cloudflare interstitial.'),
  q('oecd_newsroom', 'bot-blocked', 403),
  q('unhcr_news', 'bot-blocked', 403),
  q('eu_sanctions_map', 'bot-blocked', 403, 'Returns HTML rather than the declared feed; the Council press feed covers the same designations.'),
  q('alarabiya', 'bot-blocked', 403),
  q('ahram_egypt', 'bot-blocked', 403),
  q('nation_kenya', 'bot-blocked', 403),
  q('map_morocco', 'bot-blocked', 403),
  q('ethiopia_addisstandard', 'bot-blocked', 403),
  { key: 'bse_india', reason: 'bot-blocked', status: 403, observedOn: OBSERVED_2026_10_04,
    note: 'Akamai "Access Denied" — the same refusal as BLS. Seen by Production and re-requested from a second network.' },

  // ── Answering perfectly, publishing nothing. ─────────────────────────────
  {
    key: 'thedailystar_bd',
    reason: 'frozen',
    status: 200,
    observedOn: REPROBED,
    note:
      'Returns a valid RSS document whose newest item is dated 2022-07-22 — silent 1,492 days as of the ' +
      '2026-08-22 re-probe, which is the point: it answered 200 with 10 items that day too. A status ' +
      'code cannot see this class, and a release decided on one would have re-admitted it. It ' +
      'was contributing 10 items to every news sweep, all four years old, and every health check we ' +
      'had called it healthy because it answered. Bangladesh coverage is now thinner by one outlet; ' +
      'release it if the publisher restores the feed.',
  },

  // ── The publisher moved. Ours to fix. ────────────────────────────────────
  {
    key: 'saws_south_africa',
    reason: 'moved',
    status: 200,
    observedOn: REPROBED,
    note:
      'Re-probed 2026-08-22: still 200, still zero items parsed. Rebuilt as a single-page app; /home/rssfeed and every other path we tried answer 200 with the ' +
      'HTML shell and no feed anywhere. A 200 that is not the document is worse than a 404 — it fails ' +
      'the parser rather than the request. Southern African weather now reaches the board only through ' +
      'GDACS, which is a real coverage gap, not a solved one.',
  },
  q('reuters_world', 'moved', 404, 'Reuters withdrew its public RSS entirely. No first-party replacement exists.'),
  { key: 'reliefweb_reports', reason: 'credential', status: 403, observedOn: OBSERVED_2026_10_04,
    note: 'Repaired 2026-10-04 to v2 (v1 was 410). v2 answers 403 "You are not using an approved appname": since 2025-11-01 ReliefWeb issues appnames on request. Owner action: request one, set RELIEFWEB_APPNAME in the deployment.' },
  { key: 'reliefweb_disasters', reason: 'credential', status: 403, observedOn: OBSERVED_2026_10_04,
    note: 'Same registration as reliefweb_reports: v2 answers 403 until an approved appname is set in RELIEFWEB_APPNAME. Was recorded as moved (2026-08-22, 403).' },
  { key: 'who_afro', reason: 'frozen', status: 200, observedOn: OBSERVED_2026_10_04,
    note: 'Repaired 2026-10-04 to its current address (/rss/emergencies.xml, listed on afro.who.int/rss-feeds). It answers, but its newest item is from 2025 — frozen, not released.' },
  q('paho_alerts', 'moved', 404, 'Superseded by the paho_news record, which was verified answering.'),
  q('fao_giews', 'moved', 404),
  q('finra_actions', 'moved', 404),
  q('treasury_press', 'moved', 404),
  q('urlhaus_recent', 'moved', 404, 'abuse.ch moved to an authenticated API; the coded urlhaus source is unaffected.'),
  q('jakartapost', 'moved', 404),
  { key: 'eluniversal_mx', reason: 'bot-blocked', status: 200, observedOn: OBSERVED_2026_10_04,
    note: 'Repaired 2026-10-04 to the publisher\'s current feed, which answers — but robots.txt (edition of 2026-09-24) disallows every agent not on its list. A robots refusal is the provider\'s terms (charter §3), so it stays out.' },
  // Its advertised replacement answers 403 — a bot challenge, which §3 of
  // the charter forbids working around. It stays out until it answers.
  q('skynewsarabia', 'bot-blocked', 403),
  q('aps_algeria', 'moved', 404),
  q('nhk_world', 'moved', 404),
  q('pagasa_philippines', 'moved', 404),

  // ── No answer at all, or a server fault. May recover. ────────────────────
  q('cbc_world', 'unreachable', 0),
  q('news24_za', 'unreachable', 0),
  q('acsc_australia', 'unreachable', 0),
  { key: 'afp_via_gdelt', reason: 'unreachable', status: 429, observedOn: REPROBED,
    note: 'GDELT rate-limits the probe. Re-checked 2026-08-22 and still 429, so this is their standing limit for us rather than one bad sweep.' },
  q('smn_mexico', 'unreachable', 500),
  { key: 'nasa_donki', reason: 'unreachable', status: 429, observedOn: OBSERVED_2026_10_04,
    note: 'NASA answers 429 OVER_RATE_LIMIT on the shared DEMO_KEY (Production received HTML instead of JSON). A shared anonymous key on shared serverless addresses is a standing limit, as with afp_via_gdelt. The lasting fix is a registered api.nasa.gov key — an owner decision, not a workaround.' },
  { key: 'ted_europa', reason: 'moved', status: 404, observedOn: REPROBED,
    note: 'Was 202 Accepted with no body; now 404. The async endpoint we were calling is gone, so this is a moved record needing a new URL, not an unreachable one waiting to recover.' },
]

const KEYS = new Set(QUARANTINE.map((entry) => entry.key))

/** Whether a source key is currently withheld. */
export function isQuarantined(key: string): boolean {
  return KEYS.has(key)
}

export function quarantineFor(key: string): QuarantinedSource | undefined {
  return QUARANTINE.find((entry) => entry.key === key)
}

/**
 * The quarantine broken down by cause.
 *
 * Reported rather than summed into one number, because the three causes call
 * for three different actions and a single "43 broken" tells an operator none
 * of them. Only `moved` is work we can simply do.
 */
export function quarantineSummary() {
  const byReason = { 'bot-blocked': 0, moved: 0, unreachable: 0 } as Record<QuarantineReason, number>
  for (const entry of QUARANTINE) byReason[entry.reason]++
  return {
    total: QUARANTINE.length,
    byReason,
    probedOn: PROBED,
    headline: `${QUARANTINE.length} sources withheld as of ${PROBED}: ${byReason.moved} moved (ours to fix), ${byReason['bot-blocked']} block automated readers (their terms, respected), ${byReason.unreachable} did not answer.`,
  }
}
