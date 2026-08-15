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
 * Re-running the probe against this list is how a source gets released.
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

export type QuarantineReason = 'bot-blocked' | 'moved' | 'unreachable' | 'frozen'

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

/** The date the sweep below was taken. Every entry shares it. */
const PROBED = '2026-08-14'

const q = (
  key: string,
  reason: QuarantineReason,
  status: number,
  note?: string,
): QuarantinedSource => ({ key, reason, status, observedOn: PROBED, ...(note ? { note } : {}) })

export const QUARANTINE: QuarantinedSource[] = [
  // ── Answered with a challenge page. Their terms, and we respect them. ─────
  q('bls_us', 'bot-blocked', 403, 'Akamai "Access Denied". A browser reaches it; we will not claim to be one.'),
  q('sec_edgar_filings', 'bot-blocked', 403, 'SEC requires a declared contact in the User-Agent per its access policy — fixable by agreement, not by disguise.'),
  q('sec_litigation', 'bot-blocked', 403, 'Same SEC policy as sec_edgar_filings.'),
  q('cisa_advisories', 'bot-blocked', 403, 'Answered 403 to our agent; the JSON KEV catalogue is unaffected and still active.'),
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
  q('scmp_news', 'bot-blocked', 403),
  q('nation_kenya', 'bot-blocked', 403),
  q('map_morocco', 'bot-blocked', 403),
  q('ethiopia_addisstandard', 'bot-blocked', 403),

  // ── Answering perfectly, publishing nothing. ─────────────────────────────
  {
    key: 'thedailystar_bd',
    reason: 'frozen',
    status: 200,
    observedOn: '2026-08-15',
    note:
      'Returns a valid RSS document whose newest item is dated 2022-07-22 — silent 1,484 days. It ' +
      'was contributing 10 items to every news sweep, all four years old, and every health check we ' +
      'had called it healthy because it answered. Bangladesh coverage is now thinner by one outlet; ' +
      'release it if the publisher restores the feed.',
  },

  // ── The publisher moved. Ours to fix. ────────────────────────────────────
  {
    key: 'saws_south_africa',
    reason: 'moved',
    status: 200,
    observedOn: '2026-08-15',
    note:
      'Rebuilt as a single-page app; /home/rssfeed and every other path we tried answer 200 with the ' +
      'HTML shell and no feed anywhere. A 200 that is not the document is worse than a 404 — it fails ' +
      'the parser rather than the request. Southern African weather now reaches the board only through ' +
      'GDACS, which is a real coverage gap, not a solved one.',
  },
  q('reuters_world', 'moved', 404, 'Reuters withdrew its public RSS entirely. No first-party replacement exists.'),
  q('reliefweb_reports', 'moved', 410, 'ReliefWeb retired the v1 API. v2 answers 403 to our agent; needs the appname registration their terms describe.'),
  q('reliefweb_disasters', 'moved', 410, 'Same v1 retirement.'),
  q('who_don', 'moved', 404, 'WHO reorganised its Disease Outbreak News feed.'),
  q('who_afro', 'moved', 404),
  q('paho_alerts', 'moved', 404, 'Superseded by the paho_news record, which was verified answering.'),
  q('ecdc_threats', 'moved', 404),
  q('nsidc_news', 'moved', 404),
  q('meteoalarm_europe', 'moved', 404, 'Meteoalarm moved to a CAP endpoint with a different shape; needs a new adapter, not a new URL.'),
  q('fao_giews', 'moved', 404),
  q('bis_press', 'moved', 404),
  q('finra_actions', 'moved', 404),
  q('treasury_press', 'moved', 404),
  q('urlhaus_recent', 'moved', 404, 'abuse.ch moved to an authenticated API; the coded urlhaus source is unaffected.'),
  q('redhat_security', 'moved', 404),
  q('kyivindependent', 'moved', 404),
  q('jakartapost', 'moved', 404),
  q('infobae', 'moved', 404),
  q('eluniversal_mx', 'moved', 404),
  q('annahar_lebanon', 'moved', 404),
  q('skynewsarabia', 'moved', 404),
  q('aps_algeria', 'moved', 404),
  q('nhk_world', 'moved', 404),
  q('pagasa_philippines', 'moved', 404),

  // ── No answer at all, or a server fault. May recover. ────────────────────
  q('cbc_world', 'unreachable', 0),
  q('news24_za', 'unreachable', 0),
  q('acsc_australia', 'unreachable', 0),
  q('afp_via_gdelt', 'unreachable', 0, 'GDELT rate-limited the probe (429 earlier in the same sweep). Likely to recover on its own interval.'),
  q('smn_mexico', 'unreachable', 500),
  q('ted_europa', 'unreachable', 202, 'Answers 202 Accepted with no body — an async endpoint that needs a different call pattern.'),
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
 * for three different actions and a single "49 broken" tells an operator none
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
