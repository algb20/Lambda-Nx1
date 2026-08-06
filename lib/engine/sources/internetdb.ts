/**
 * Shodan InternetDB — passive IP exposure (open ports, hostnames, tags, known
 * CVEs) from Shodan's existing scan data. Keyless. Input is an IP address.
 * 404 means "no exposure data", which is a valid result, not an error.
 */
import type { Evidence, Source } from '../types'

interface InternetDbResponse {
  ip?: string
  ports?: number[]
  hostnames?: string[]
  cpes?: string[]
  tags?: string[]
  vulns?: string[]
}

export const internetdb: Source = {
  key: 'shodan.internetdb',
  capability: 'ip_reputation',
  passive: true,
  hosts: ['internetdb.shodan.io'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const retrievedAt = new Date().toISOString()
    const ip = input.value
    const url = `https://internetdb.shodan.io/${encodeURIComponent(ip)}`
    const res = await ctx.fetch(url)
    if (res.status === 404) return []
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as InternetDbResponse | null
    if (!j) return []

    const out: Evidence[] = []
    const push = (claim: string, data: unknown) =>
      out.push({
        claim,
        entity: { type: 'ip', value: ip },
        sourceKey: 'shodan.internetdb',
        sourceUrl: url,
        retrievedAt,
        admiralty: { source: 'B', info: 2 },
        confidence: 'possible',
        data,
      })

    if (j.ports?.length) push(`Open ports: ${j.ports.join(', ')}`, { ports: j.ports })
    if (j.hostnames?.length) push(`Hostnames: ${j.hostnames.join(', ')}`, { hostnames: j.hostnames })
    if (j.vulns?.length) push(`Reported CVEs: ${j.vulns.join(', ')}`, { vulns: j.vulns })
    if (j.tags?.length) push(`Tags: ${j.tags.join(', ')}`, { tags: j.tags })
    return out
  },
}
