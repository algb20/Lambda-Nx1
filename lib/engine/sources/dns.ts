/**
 * DNS over HTTPS sources (passive — queries public resolvers, never the target).
 * Cloudflare is primary, Google is the fallback; both speak the same JSON format.
 */
import type { Evidence, EntityRef, Source, SourceContext } from '../types'

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT'] as const
const TYPE_NUMBERS: Record<(typeof RECORD_TYPES)[number], number> = {
  A: 1,
  AAAA: 28,
  MX: 15,
  NS: 2,
  TXT: 16,
}

interface DohAnswer {
  name: string
  type: number
  TTL: number
  data: string
}
interface DohResponse {
  Status: number
  Answer?: DohAnswer[]
}

function entityFor(recordType: string, data: string): EntityRef | undefined {
  if (recordType === 'A' || recordType === 'AAAA') return { type: 'ip', value: data }
  return undefined
}

async function queryDoh(
  ctx: SourceContext,
  base: string,
  domain: string,
  sourceKey: string,
): Promise<Evidence[]> {
  const retrievedAt = new Date().toISOString()
  const out: Evidence[] = []

  for (const rtype of RECORD_TYPES) {
    const url = `${base}?name=${encodeURIComponent(domain)}&type=${rtype}`
    let res: Response
    try {
      res = await ctx.fetch(url, { headers: { accept: 'application/dns-json' } })
    } catch {
      // One record type failing must not abort the rest.
      continue
    }
    if (!res.ok) continue
    const json = (await res.json().catch(() => null)) as DohResponse | null
    if (!json?.Answer) continue

    for (const ans of json.Answer) {
      if (ans.type !== TYPE_NUMBERS[rtype]) continue // skip CNAME chain entries
      const value = rtype === 'TXT' ? ans.data.replace(/^"|"$/g, '') : ans.data
      out.push({
        claim: `${rtype} record: ${value}`,
        entity: entityFor(rtype, value),
        sourceKey,
        sourceUrl: url,
        retrievedAt,
        admiralty: { source: 'B', info: 2 },
        confidence: 'possible',
        data: { type: rtype, value, ttl: ans.TTL },
      })
    }
  }
  return out
}

export const cloudflareDns: Source = {
  key: 'dns.cloudflare',
  capability: 'dns',
  passive: true,
  hosts: ['cloudflare-dns.com'],
  minIntervalMs: 100,
  run: (input, ctx) =>
    queryDoh(ctx, 'https://cloudflare-dns.com/dns-query', input.value, 'dns.cloudflare'),
}

export const googleDns: Source = {
  key: 'dns.google',
  capability: 'dns',
  passive: true,
  hosts: ['dns.google'],
  minIntervalMs: 100,
  run: (input, ctx) => queryDoh(ctx, 'https://dns.google/resolve', input.value, 'dns.google'),
}
