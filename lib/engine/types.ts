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
  /** ISO timestamp of retrieval. */
  retrievedAt: string
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
