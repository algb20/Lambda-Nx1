/**
 * The source catalogue — sources as **data**, not code.
 *
 * ## Why this exists
 *
 * The engine's original shape was one TypeScript module per source. That is the
 * right shape for a source with real logic — a WHOIS pivot, a certificate-log
 * query, a chain scanner — and it is the wrong shape for the other kind, of
 * which there are hundreds: a URL that returns a feed in a format we already
 * know how to read.
 *
 * Writing those by hand caps the platform at a few dozen sources, because every
 * new one costs a file, a test and a registration. The comparable platforms
 * carry five hundred or more, and they can only do that because their feeds are
 * records in a list rather than modules in a directory. So ours are too.
 *
 * A catalogue entry is a **claim about a source that we can check**: where it
 * is, what it publishes, who publishes it, how far it can be trusted, and — the
 * part most collections omit — what its licence permits us to do with the
 * result. Adding a source is adding a record.
 *
 * ## What a record must carry, and why
 *
 * Every field here is load-bearing. In particular:
 *
 * - **`admiralty`** — a source is graded *before* it is read, by who publishes
 *   it, not by whether the fetch succeeded. A national seismic network is an A;
 *   an aggregator that republishes other people's reporting is a C at best.
 * - **`independence`** — the group a source belongs to. Twenty newspapers
 *   carrying one agency's wire are **one** confirmation, not twenty. Without
 *   this field a corroboration score just counts republication, which is how a
 *   single unverified claim ends up reading as overwhelming consensus.
 * - **`licence`** — what we may lawfully do with what comes back. Not
 *   documentation: `lib/engine/catalog/licence.ts` refuses to register a source
 *   whose terms forbid the use we intend.
 */

/** How the payload is shaped, which decides the parser. */
export type FeedKind =
  | 'rss' // RSS 2.0 / RDF
  | 'atom' // Atom 1.0
  | 'geojson' // RFC 7946 FeatureCollection
  | 'json' // arbitrary JSON, needs a `path` to the array

/**
 * The intelligence discipline a source belongs to.
 *
 * These are the standard OSINT/INT disciplines rather than product categories,
 * because a discipline says what *kind* of knowing a source gives you —
 * measured by an instrument, reported by a person, filed with a registrar — and
 * that is what decides how much weight a finding deserves.
 */
export type Discipline =
  | 'geoint' // geospatial: satellites, seismics, fire detection, hydrology
  | 'osint' // open publication: news, official statements, journals
  | 'cyber' // vulnerabilities, advisories, malicious infrastructure
  | 'fin' // markets, filings, sanctions, corporate registers
  | 'humint' // humanitarian reporting, displacement, health (institutional)
  | 'sci' // research output, preprints, standards
  | 'infra' // energy, transport, connectivity, outages

/** The subject matter, used for map layers and filters. */
export type Topic =
  | 'earthquake'
  | 'volcano'
  | 'wildfire'
  | 'flood'
  | 'storm'
  | 'tsunami'
  | 'drought'
  | 'weather'
  | 'air-quality'
  | 'space-weather'
  | 'health'
  | 'displacement'
  | 'conflict'
  | 'humanitarian'
  | 'news'
  | 'official'
  | 'cyber-advisory'
  | 'vulnerability'
  | 'malware'
  | 'markets'
  | 'economy'
  | 'sanctions'
  | 'corporate'
  | 'procurement'
  | 'energy'
  | 'aviation'
  | 'maritime'
  | 'connectivity'
  | 'research'
  | 'technology'
  | 'space'

/**
 * What a licence permits. Read by the registry, which refuses a source whose
 * terms forbid what we would do with it.
 */
export interface Licence {
  /** Short identifier, e.g. 'public-domain', 'CC-BY-4.0', 'terms:opensky'. */
  id: string
  /** Human sentence for the attribution line and the source dossier. */
  name: string
  /** May the result be used in a commercial product? */
  commercialUse: boolean
  /** May we store the result beyond the length of one request? */
  storage: boolean
  /** May we show the content itself, or only link to it? */
  redistribute: boolean
  /** Attribution text we are obliged to display, if any. */
  attribution?: string
  /** Where the terms are stated, so a claim here can be checked. */
  termsUrl?: string
}

export interface CatalogSource {
  /** Stable key. Appears in evidence, health reports and the licence registry. */
  key: string
  /** Publisher-facing name, shown to users. */
  name: string
  /** The organisation behind it — what `admiralty` is a judgement about. */
  publisher: string
  url: string
  kind: FeedKind
  discipline: Discipline
  topics: Topic[]
  /**
   * ISO-3166 alpha-2 codes this source is *about*, or 'global'. A national
   * meteorological service is authoritative for its own territory and no more,
   * and a map that treats it as global coverage is lying about its blind spots.
   */
  coverage: 'global' | string[]

  /**
   * Admiralty source-reliability letter, assigned from who publishes and how,
   * never from whether a given fetch worked.
   *
   * A — an official body publishing its own instrument readings
   * B — an established institution reporting within its remit
   * C — a reputable outlet reporting others' work
   * D — a source whose record is mixed or unestablished
   * E — known to be unreliable  ·  F — cannot be judged
   */
  admiralty: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

  /**
   * The independence group.
   *
   * Sources sharing a group are **not** independent of one another: they either
   * republish a common upstream or share an editorial owner. Corroboration
   * counts groups, not sources, so a story carried by twenty outlets from one
   * wire scores as one confirmation.
   *
   * Default is the source's own key — most sources are their own group.
   */
  independence?: string

  licence: Licence

  /** Minimum seconds between our requests. Respecting this is not optional. */
  minIntervalSec: number

  /** True when no credential is needed. Keyless sources are preferred. */
  keyless: boolean

  /**
   * Environment variable holding the credential, for the ones that need one.
   * Named here so the catalogue documents its own requirements, and so a source
   * whose key is absent is skipped rather than failing at request time.
   */
  keyEnv?: string

  /**
   * A rolling window over `url`, for publishers whose "recent" is a query.
   *
   * Given the moment of the request, it returns the address to fetch. It must
   * keep the host of `url` — that host is what the passive guardrail
   * allow-lists, and it is checked, so a function that wandered to another
   * domain would be refused rather than followed.
   *
   * It exists because a frozen address can be quietly, permanently wrong. NVD's
   * API returns its catalogue from the beginning when no date range is given,
   * so a source entered as "recently published CVEs" spent its life reporting
   * **CVE-1999-0095** — a 27-year-old record, delivered every hour, correct in
   * every particular except the one that mattered. Nothing failed; the feed was
   * simply answering a different question from the one it was catalogued under.
   */
  urlFor?: (now: Date) => string

  /**
   * A User-Agent this publisher requires, instead of our usual one.
   *
   * Almost nothing needs this and it should stay that way — one honest agent
   * across the catalogue is what lets a publisher identify and rate-limit us
   * fairly. The exception is publishers who *mandate* a particular form.
   *
   * The SEC is the one that forced it: its published access policy requires a
   * User-Agent carrying a contact address, and it answers **403** to anything
   * else. That single rule was the difference between having every US public
   * company's 8-K filings in real time and having none of them — the feed had
   * been catalogued and refused for as long as it had existed.
   */
  userAgent?: string

  /** For `kind: 'json'`, the dotted path to the array of records. */
  path?: string

  /** Field mapping for `kind: 'json'`, from our names to theirs. */
  map?: {
    /**
     * A readable headline built from the record's own fields.
     *
     * `{field}` placeholders are filled from the row by the same dotted-path
     * lookup as every other mapping; anything else is literal. It takes
     * precedence over `title`.
     *
     * It exists because a great many measurement APIs publish records with no
     * headline at all — only numbers — and pointing `title` at one of those
     * numbers produces exactly what it says. NOAA's tide gauge appeared on the
     * world board as an event titled **"0.821"**: true, sourced, timestamped,
     * and meaningless to anyone reading it. A row nobody can understand is not
     * intelligence, whatever its provenance.
     *
     * A placeholder that the row does not carry leaves the template unused, so
     * a feed that changes shape falls back to the ordinary title lookup rather
     * than publishing half a sentence.
     */
    titleTemplate?: string
    title?: string
    url?: string
    time?: string
    lat?: string
    lon?: string
    summary?: string
    magnitude?: string
  }

  /** Off by default when a source is heavy, noisy, or in trial. */
  enabled?: boolean

  /** One line on what this source is for — shown in the source dossier. */
  note?: string
}

/** Sources are their own independence group unless they declare otherwise. */
export function independenceGroup(source: CatalogSource): string {
  return source.independence ?? source.key
}

/** The host a source reads from — what the passive guardrail allow-lists. */
export function sourceHost(source: CatalogSource): string {
  try {
    return new URL(source.url).hostname.toLowerCase()
  } catch {
    return ''
  }
}
