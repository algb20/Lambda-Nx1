/**
 * Change detection for the Radar. A monitored domain is reduced to a stable
 * fingerprint of its meaningful public state; comparing fingerprints across runs
 * yields a precise ChangeSet (what appeared / disappeared).
 */
import type { DomainReport } from '../modules/domain'

export interface DomainFingerprint {
  subdomains: string[]
  ips: string[]
  registrar: string | null
  nameservers: string[]
}

export interface FieldChange {
  category: string
  added: string[]
  removed: string[]
}

export interface ChangeSet {
  changed: boolean
  fields: FieldChange[]
}

function sortedUnique(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))].sort()
}

export function computeDomainFingerprint(report: DomainReport): DomainFingerprint {
  const subdomains = report.sections.subdomains
    .map((e) => e.entity?.value)
    .filter((v): v is string => Boolean(v))

  const ips = report.sections.dns
    .filter((e) => e.entity?.type === 'ip')
    .map((e) => e.entity!.value)

  const registrarEvidence = report.sections.registration.find((e) =>
    e.claim.startsWith('Registrar:'),
  )
  const registrar = registrarEvidence
    ? registrarEvidence.claim.replace(/^Registrar:\s*/, '')
    : null

  const nameservers = report.sections.registration
    .filter((e) => e.claim.startsWith('Nameserver:'))
    .map((e) => e.claim.replace(/^Nameserver:\s*/, '').toLowerCase())

  return {
    subdomains: sortedUnique(subdomains),
    ips: sortedUnique(ips),
    registrar,
    nameservers: sortedUnique(nameservers),
  }
}

function diffLists(category: string, oldList: string[], newList: string[]): FieldChange | null {
  const oldSet = new Set(oldList)
  const newSet = new Set(newList)
  const added = newList.filter((x) => !oldSet.has(x))
  const removed = oldList.filter((x) => !newSet.has(x))
  if (added.length === 0 && removed.length === 0) return null
  return { category, added, removed }
}

/**
 * Compare fingerprints. A null `previous` is a first run — a baseline is
 * established and no change is reported.
 */
export function diffFingerprints(
  previous: DomainFingerprint | null,
  current: DomainFingerprint,
): ChangeSet {
  if (!previous) return { changed: false, fields: [] }

  const fields: FieldChange[] = []
  for (const [category, oldL, newL] of [
    ['subdomains', previous.subdomains, current.subdomains],
    ['ips', previous.ips, current.ips],
    ['nameservers', previous.nameservers, current.nameservers],
  ] as const) {
    const d = diffLists(category, oldL, newL)
    if (d) fields.push(d)
  }

  if (previous.registrar !== current.registrar) {
    fields.push({
      category: 'registrar',
      added: current.registrar ? [current.registrar] : [],
      removed: previous.registrar ? [previous.registrar] : [],
    })
  }

  return { changed: fields.length > 0, fields }
}

export function summarizeChanges(changes: ChangeSet): string {
  return changes.fields
    .map((f) => {
      const parts: string[] = []
      if (f.added.length) parts.push(`+${f.added.length}`)
      if (f.removed.length) parts.push(`-${f.removed.length}`)
      return `${f.category} ${parts.join('/')}`
    })
    .join(', ')
}
