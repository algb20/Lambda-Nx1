/**
 * RDAP — registration data (the structured, keyless successor to WHOIS).
 * rdap.org bootstraps to the authoritative registry, so this is official data
 * (Admiralty A2).
 */
import type { Evidence, Source } from '../types'

interface RdapEvent {
  eventAction?: string
  eventDate?: string
}
interface RdapEntity {
  roles?: string[]
  vcardArray?: unknown
}
interface RdapNameserver {
  ldhName?: string
}
interface RdapResponse {
  ldhName?: string
  status?: string[]
  events?: RdapEvent[]
  entities?: RdapEntity[]
  nameservers?: RdapNameserver[]
}

/** vcardArray = ["vcard", [ ["fn", {}, "text", "Registrar Name"], ... ]] */
function registrarName(entities: RdapEntity[] | undefined): string | undefined {
  const reg = entities?.find((e) => e.roles?.includes('registrar'))
  const vcard = reg?.vcardArray
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return undefined
  const fn = vcard[1].find((p: unknown) => Array.isArray(p) && p[0] === 'fn')
  return Array.isArray(fn) && typeof fn[3] === 'string' ? fn[3] : undefined
}

export const rdap: Source = {
  key: 'rdap',
  capability: 'whois',
  passive: true,
  hosts: ['rdap.org'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const retrievedAt = new Date().toISOString()
    const url = `https://rdap.org/domain/${encodeURIComponent(input.value)}`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as RdapResponse | null
    if (!j) return []

    const out: Evidence[] = []
    const push = (claim: string, data?: unknown) =>
      out.push({
        claim,
        sourceKey: 'rdap',
        sourceUrl: url,
        retrievedAt,
        admiralty: { source: 'A', info: 2 },
        confidence: 'possible',
        data,
      })

    const registrar = registrarName(j.entities)
    if (registrar) push(`Registrar: ${registrar}`, { registrar })
    for (const ev of j.events ?? []) {
      if (ev.eventAction && ev.eventDate) push(`${ev.eventAction}: ${ev.eventDate}`, ev)
    }
    if (j.status?.length) push(`Status: ${j.status.join(', ')}`, { status: j.status })
    for (const ns of j.nameservers ?? []) {
      if (ns.ldhName) {
        out.push({
          claim: `Nameserver: ${ns.ldhName}`,
          entity: { type: 'domain', value: ns.ldhName.toLowerCase() },
          sourceKey: 'rdap',
          sourceUrl: url,
          retrievedAt,
          admiralty: { source: 'A', info: 2 },
          confidence: 'possible',
          data: { nameserver: ns.ldhName },
        })
      }
    }
    return out
  },
}
