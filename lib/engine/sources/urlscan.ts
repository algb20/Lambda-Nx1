/**
 * urlscan.io (public search) — hosting & technology signals from existing public
 * scans. Passive (queries urlscan's database, never the target). Keyless.
 */
import type { Evidence, Source } from '../types'

interface UrlscanPage {
  domain?: string
  ip?: string
  server?: string
  asn?: string
  asnname?: string
  country?: string
}
interface UrlscanResultItem {
  page?: UrlscanPage
  task?: { url?: string; time?: string }
  result?: string
}
interface UrlscanSearch {
  results?: UrlscanResultItem[]
  total?: number
}

export const urlscan: Source = {
  key: 'urlscan',
  capability: 'tech',
  passive: true,
  hosts: ['urlscan.io'],
  minIntervalMs: 2000,
  async run(input, ctx) {
    const retrievedAt = new Date().toISOString()
    const url = `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(input.value)}&size=1`
    const res = await ctx.fetch(url)
    if (!res.ok) return []
    const j = (await res.json().catch(() => null)) as UrlscanSearch | null
    const page = j?.results?.[0]?.page
    const resultUrl = j?.results?.[0]?.result ?? url
    if (!page) return []

    const out: Evidence[] = []
    const base = {
      sourceKey: 'urlscan',
      sourceUrl: resultUrl,
      retrievedAt,
      admiralty: { source: 'C', info: 3 } as const,
      confidence: 'possible' as const,
    }
    if (page.server) out.push({ ...base, claim: `Web server: ${page.server}`, data: { server: page.server } })
    if (page.ip)
      out.push({
        ...base,
        claim: `Hosting IP: ${page.ip}`,
        entity: { type: 'ip', value: page.ip },
        data: { ip: page.ip },
      })
    if (page.asn || page.asnname)
      out.push({
        ...base,
        claim: `ASN: ${[page.asn, page.asnname].filter(Boolean).join(' ')}`,
        data: { asn: page.asn, asnname: page.asnname },
      })
    if (page.country) out.push({ ...base, claim: `Server country: ${page.country}`, data: { country: page.country } })
    return out
  },
}
