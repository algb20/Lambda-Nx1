/**
 * Sanitising the findings a browser posts back.
 *
 * Two routes accept a set of findings from the client — one renders them into a
 * downloadable document, the other publishes them at a public URL. Both hand the
 * result to somebody who was not there when it was collected, so neither can
 * pass the payload through unexamined, and both must do it the *same* way: two
 * sanitisers drift, and the one that drifts is the one nobody looked at.
 *
 * Only the fields a dossier uses survive, each bounded in length. Everything
 * else in the request body is dropped rather than carried along.
 */
import type { Evidence } from '@/lib/engine/types'

/** A document nobody would read, and a cheap way to spend our CPU. */
export const MAX_FINDINGS = 5_000
const MAX_TEXT = 4_000

const str = (v: unknown, max = MAX_TEXT): string => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * One finding, or null when it carries nothing worth documenting. A claim with
 * no text and no source is not evidence.
 */
export function toEvidence(raw: unknown): Evidence | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const claim = str(r.claim)
  const sourceKey = str(r.sourceKey, 120)
  if (!claim.trim() || !sourceKey.trim()) return null

  const entityRaw = r.entity as Record<string, unknown> | undefined
  const entity =
    entityRaw && typeof entityRaw === 'object'
      ? { type: str(entityRaw.type, 40), value: str(entityRaw.value, 300) }
      : undefined

  const admiraltyRaw = r.admiralty as Record<string, unknown> | undefined
  const admiralty =
    admiraltyRaw && typeof admiraltyRaw.source === 'string' && typeof admiraltyRaw.info === 'number'
      ? { source: admiraltyRaw.source, info: admiraltyRaw.info }
      : undefined

  // An unparseable timestamp would corrupt every "retrieved" date in the
  // citations, so fall back to now rather than print a lie.
  const retrievedAt = str(r.retrievedAt, 40)
  const when = Number.isFinite(Date.parse(retrievedAt)) ? retrievedAt : new Date().toISOString()

  return {
    claim,
    sourceKey,
    sourceUrl: str(r.sourceUrl, 2000) || undefined,
    retrievedAt: when,
    confidence: str(r.confidence, 20) || 'unconfirmed',
    ...(entity?.value ? { entity } : {}),
    ...(admiralty ? { admiralty } : {}),
  } as Evidence
}

/** Raised when a caller sends more than a document could sensibly hold. */
export class TooManyFindingsError extends Error {
  constructor(readonly limit = MAX_FINDINGS) {
    super(`Too many findings — the limit is ${limit}`)
    this.name = 'TooManyFindingsError'
  }
}

/** Sanitise a posted list, dropping anything unusable. */
export function toEvidenceList(raw: unknown): Evidence[] {
  const list = Array.isArray(raw) ? raw : []
  if (list.length > MAX_FINDINGS) throw new TooManyFindingsError()
  return list.map(toEvidence).filter((e): e is Evidence => e !== null)
}
