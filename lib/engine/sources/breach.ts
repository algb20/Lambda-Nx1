/**
 * Email breach exposure via XposedOrNot (keyless). Passive — reports *whether*
 * an address appears in known breaches (names only), never redistributes any
 * breached data (charter §3).
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

interface XonResponse {
  breaches?: string[][]
  Error?: string
}

export const xposedornot: Source = {
  key: 'xposedornot',
  capability: 'email_breach',
  passive: true,
  hosts: ['api.xposedornot.com'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const email = input.value.trim().toLowerCase()
    const retrievedAt = new Date().toISOString()
    const url = `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`
    const res = await ctx.fetch(url)
    if (res.status === 404) return [] // not found in any breach — a valid result
    expectOk('xposedornot', res)
    const j = (await res.json().catch(() => null)) as XonResponse | null
    const names = j?.breaches?.[0] ?? []
    if (names.length === 0) return []

    return names.map<Evidence>((name) => ({
      claim: `Exposed in breach: ${name}`,
      entity: { type: 'email', value: email },
      sourceKey: 'xposedornot',
      sourceUrl: url,
      retrievedAt,
      admiralty: { source: 'B', info: 2 },
      confidence: 'possible',
      data: { breach: name },
    }))
  },
}
