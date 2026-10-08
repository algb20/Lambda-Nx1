import { CATALOG } from './index'
import { licenceProblem } from './licence'
import { SOURCE_LICENSE_REGISTRY, licenseRecord, usagePolicy } from '../licensing/registry'
import { licenceTextsFor } from '../licensing/licence-texts'
import type { SourceCredit } from './credits'

/**
 * Server-side derivation of `credits.ts` (see scripts/build-credit-index.ts).
 * Kept apart from the generated file so the browser bundle never imports the
 * catalogue or the registry.
 */
export function creditEntries(): [string, SourceCredit][] {
  const out: [string, SourceCredit][] = []
  for (const source of CATALOG) {
    if (licenceProblem(source.licence) !== null) continue
    const record = licenseRecord(source.key)
    if (record && usagePolicy(record.license_status) === 'WITHHOLD') continue
    const verified = record?.license_status.startsWith('VERIFIED') ?? false
    const credit = (verified && record?.attribution) || source.licence.attribution
    if (!credit) continue
    // A licence is named only when the registry verified it from the provider's
    // own terms; an UNCLEAR record must not be shown as "CC BY" on the strength
    // of a catalogue entry nobody re-read.
    const licence = verified && record ? licenceTextsFor(record.license)[0]?.label : undefined
    out.push([source.key, licence ? { credit, licence } : { credit }])
  }
  // Coded sources (gateways and boards) have no catalogue licence; their credit
  // is the attribution the registry verified from the provider's terms (R324).
  const seen = new Set(out.map(([key]) => key))
  for (const r of SOURCE_LICENSE_REGISTRY) {
    if (r.kind !== 'coded' || seen.has(r.source_id) || !r.attribution || !r.license_status.startsWith('VERIFIED')) continue
    const licence = licenceTextsFor(r.license)[0]?.label
    out.push([r.source_id, licence ? { credit: r.attribution, licence } : { credit: r.attribution }])
  }
  return out.sort(([a], [b]) => a.localeCompare(b))
}
