import data from './source-licence-registry.json'

/**
 * Source Licence & Usage Registry — one record per source the product can
 * reach: catalogue records, coded sources, CKAN portals and the sites inside
 * the username check (owner R317, 2026-10-05).
 *
 * ## What a record is, and is not
 *
 * A record states what a provider's **own terms** say about each use Lambda
 * makes of its data — access, display, redistribution, derivation, caching,
 * attribution, limits — with the quoted text, its URL and the date it was
 * read. It is evidence, not a legal opinion. Where the terms are silent the
 * field says NOT_STATED; it never fills the gap with a guess in either
 * direction.
 *
 * ## The rules this module enforces at load time
 *
 * - VERIFIED_* requires an **express grant or a statute**, with quoted
 *   evidence. "The terms mention no restriction" is UNCLEAR, never VERIFIED
 *   — a free API is not a commercial licence (R317 §7).
 * - RESTRICTED / PROHIBITED require quoted evidence of the restriction.
 * - Every record carries `checked_at`.
 *
 * ## How it governs use (`usagePolicy`)
 *
 * The registry is the policy input the Master's Source Control Plane / Policy
 * Engine / Context Firewall will consume (Build §31, §46; not built yet). Until
 * then it is enforced by `lib/conformance/s-invariants.test.ts`: nothing whose
 * policy is WITHHOLD may be registered or active.
 */

export type LicenseStatus =
  | 'VERIFIED_ALLOWED'
  | 'VERIFIED_CONDITIONAL'
  | 'RESTRICTED'
  | 'PROHIBITED'
  | 'UNCLEAR'
  | 'LEGAL_REVIEW_REQUIRED'
  | 'EXPIRED_OR_CHANGED'

/** How the status was reached — what kind of evidence stands behind it. */
export type EvidenceBasis =
  | 'EXPRESS_GRANT'
  | 'STATUTE'
  | 'EXPRESS_RESTRICTION'
  | 'ABSENCE_OF_RESTRICTION'
  | 'AMBIGUOUS_TERMS'
  | 'TERMS_NOT_READ'
  | 'PRIOR_RECORD'
  | 'PRIOR_RECORD_NO_EVIDENCE'

/** What the terms say about one use. NOT_STATED means silent, not permitted. */
export type Permission = 'YES' | 'NO' | 'CONDITIONAL' | 'NOT_STATED' | 'UNCLEAR'

export interface EvidenceReference {
  quote: string
  url: string
  read_at: string
}

export interface SourceLicenseRecord {
  source_id: string
  kind: 'coded' | 'catalogue' | 'ckan-portal' | 'username-site'
  provider: string
  official_url: string | null
  source_type: string
  dataset_api: string
  data_categories: string[]
  jurisdiction: string
  license: string
  terms_url: string | null
  commercial_use: Permission
  internal_use: Permission
  public_display: Permission
  redistribution: Permission
  derived_data: Permission
  caching: Permission
  retention: string
  attribution: string | null
  rate_limits: string | null
  authentication: string
  prohibited_uses: string[]
  geographic_restrictions: string | null
  ai_ml_use: Permission
  training_use: Permission
  provenance_requirements: string
  legal_risk: 'LOW' | 'MEDIUM' | 'HIGH'
  license_status: LicenseStatus
  basis: EvidenceBasis
  conditions: string | null
  evidence_reference: EvidenceReference[]
  checked_at: string
  fallback_sources: string[]
}

export type UsagePolicy = 'ALLOW' | 'ALLOW_WITH_CONDITIONS' | 'ALLOW_UNDER_REVIEW' | 'WITHHOLD'

/**
 * Status → what Lambda may do.
 *
 * UNCLEAR and LEGAL_REVIEW_REQUIRED stay usable, flagged: the owner's rule is
 * that temporary ambiguity does not delete a source before an alternative is
 * found (R317). EXPIRED_OR_CHANGED is withheld: an earlier verdict that can no
 * longer be confirmed is not a licence.
 */
export function usagePolicy(status: LicenseStatus): UsagePolicy {
  switch (status) {
    case 'VERIFIED_ALLOWED':
      return 'ALLOW'
    case 'VERIFIED_CONDITIONAL':
      return 'ALLOW_WITH_CONDITIONS'
    case 'UNCLEAR':
    case 'LEGAL_REVIEW_REQUIRED':
      return 'ALLOW_UNDER_REVIEW'
    case 'RESTRICTED':
    case 'PROHIBITED':
    case 'EXPIRED_OR_CHANGED':
      return 'WITHHOLD'
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Every rule a record must satisfy; the problems, or none. */
export function recordProblems(r: SourceLicenseRecord): string[] {
  const p: string[] = []
  if (!DATE.test(r.checked_at)) p.push('checked_at is not a date')
  const verified = r.license_status === 'VERIFIED_ALLOWED' || r.license_status === 'VERIFIED_CONDITIONAL'
  if (verified && r.basis !== 'EXPRESS_GRANT' && r.basis !== 'STATUTE') p.push(`VERIFIED on basis ${r.basis}`)
  if (verified && r.commercial_use !== 'YES' && r.commercial_use !== 'CONDITIONAL') p.push('VERIFIED without commercial use allowed')
  const needsQuote = verified || r.license_status === 'RESTRICTED' || r.license_status === 'PROHIBITED'
  if (needsQuote && !r.evidence_reference.some((e) => e.quote.length > 15 && /^https?:\/\//.test(e.url) && DATE.test(e.read_at))) {
    p.push('no quoted evidence with URL and date')
  }
  if (r.license_status === 'VERIFIED_CONDITIONAL' && !r.conditions && !r.attribution) p.push('conditional without a condition')
  return p
}

export const SOURCE_LICENSE_REGISTRY = data as SourceLicenseRecord[]

const BY_ID = new Map(SOURCE_LICENSE_REGISTRY.map((r) => [r.source_id, r]))

export function licenseRecord(sourceId: string): SourceLicenseRecord | undefined {
  return BY_ID.get(sourceId)
}
