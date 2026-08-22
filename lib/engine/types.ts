/**
 * Lambda NX engine — core types.
 *
 * The engine is our own source-adapter framework + analysis core. Every source
 * implements the `Source` port; the orchestrator runs sources for a capability
 * with automatic fallback; the analysis core turns raw evidence into graded,
 * documented intelligence.
 */

export type Capability =
  | 'dns'
  | 'whois'
  | 'subdomains'
  | 'tech'
  | 'archive'
  | 'ip_geo'
  | 'ip_reputation'
  | 'url_scan'
  | 'email_breach'
  | 'username_presence'
  | 'image_metadata'
  | 'threat'
  | 'sanctions'
  | 'wallet'
  | 'market'
  | 'securities'
  | 'fx'
  | 'procurement'
  | 'ownership'
  | 'news'
  | 'market_board'
  | 'crypto'
  | 'maritime'
  | 'verification'
  | 'property'
  | 'venues'
  | 'filings'
  | 'broadcasts'
  | 'company'
  | 'company_ranking'
  | 'courts'
  | 'regulation'
  | 'officials'
  | 'resources'
  | 'power_grid'
  | 'space_weather'
  | 'orbital'
  | 'statements'
  | 'geo'
  | 'research'
  | 'economy'
  | 'reference'
  | 'watch'
  | 'trending'
  | 'world_events'
  | 'chain_state'
  | 'open_data'

export type EntityType =
  | 'domain'
  | 'ip'
  | 'email'
  | 'username'
  | 'organization'
  | 'phone'
  | 'url'
  | 'image'
  | 'wallet'
  | 'company'
  | 'person'
  | 'other'

/** Standardized confidence grades (reference §5.3). */
export type Confidence = 'confirmed' | 'probable' | 'possible' | 'unconfirmed'

export type AdmiraltySource = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type AdmiraltyInfo = 1 | 2 | 3 | 4 | 5 | 6

/** Admiralty code (reference §1.6): source reliability × information credibility. */
export interface Admiralty {
  source: AdmiraltySource
  info: AdmiraltyInfo
}

export interface EntityRef {
  type: EntityType
  value: string
}

/** A single documented fact produced by a source (reference §5.4). */
export interface Evidence {
  claim: string
  /** The entity this fact is about or reveals (used to build the pivot graph). */
  entity?: EntityRef
  sourceKey: string
  sourceUrl?: string
  /**
   * ISO timestamp of **retrieval** — when we fetched it. Always known.
   *
   * This field used to carry two different meanings depending on the source,
   * and the cost was concrete: the news feed sorted by it, so a feed whose
   * sources all stamped their fetch time sorted by nothing at all, and no
   * publication date was ever shown. `retrievedAt` now means retrieval and only
   * retrieval; when a source states when the thing happened, that goes in
   * `publishedAt`.
   */
  retrievedAt: string
  /**
   * ISO timestamp of **publication** — when the source says the thing happened
   * or was published. Null or absent when the source stated no time.
   *
   * Never defaulted to `retrievedAt`. A missing publication date is a real
   * finding about a source, and filling it with "now" turns a five-year-old
   * report into breaking news — which is the single most damaging thing a
   * signals feed can do.
   */
  publishedAt?: string | null
  admiralty?: Admiralty
  confidence: Confidence
  /** Raw normalized payload, kept for the archive. */
  data?: unknown
}

export interface SourceInput {
  capability: Capability
  /** The subject value, e.g. a domain or IP. */
  value: string
}

export interface SourceContext {
  /**
   * Guarded fetch — reaches only allow-listed provider hosts, read-only (GET/HEAD).
   * A source MUST use this, never the global fetch, so the passive guarantee holds.
   */
  fetch: (url: string, init?: RequestInit) => Promise<Response>
}

export interface SourceResult {
  sourceKey: string
  ok: boolean
  evidence: Evidence[]
  error?: string
  /**
   * The source was not fetched because its own minimum interval had not
   * elapsed, and this evidence (if any) is the last answer it gave.
   *
   * A distinct state from both success and failure, because it is neither. The
   * evidence keeps its original `retrievedAt`, so its true age is visible
   * everywhere downstream.
   */
  cached?: boolean
  /** Age of the replayed answer in ms; null when nothing was held. */
  cacheAgeMs?: number | null
  /**
   * How long this source took, in ms — success, failure and timeout alike.
   *
   * Added because a fan-out is only as fast as its slowest member and nothing
   * recorded which member that was. The world picture takes 8.0 seconds over
   * 135 sources — exactly the per-source deadline, so at least one is running
   * to the buzzer and every reader waits for it — and there was no way to name
   * it without instrumenting the engine by hand.
   *
   * `ok` and `error` say whether a source works. This says what it costs, which
   * is the other half of knowing whether to keep it.
   */
  durationMs?: number
}

/**
 * A passive OSINT source. It queries a third-party data *provider* about a
 * subject — it never connects to the subject/target itself.
 */
export interface Source {
  readonly key: string
  readonly capability: Capability
  /** Must be literally true; the engine refuses to register non-passive sources. */
  readonly passive: true
  /** Provider hostnames this source may contact (feeds the guardrail allowlist). */
  readonly hosts: string[]
  /** Minimum ms between calls to this source (politeness / rate limiting). */
  readonly minIntervalMs?: number
  run(input: SourceInput, ctx: SourceContext): Promise<Evidence[]>
}
