/**
 * crt.sh — subdomains discovered from public Certificate Transparency logs.
 * Keyless; CT logs typically reveal more subdomains than DNS enumeration alone.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

interface CrtShEntry {
  name_value?: string
  common_name?: string
}

export const crtsh: Source = {
  key: 'crtsh',
  capability: 'subdomains',
  passive: true,
  hosts: ['crt.sh'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const retrievedAt = new Date().toISOString()
    const domain = input.value.toLowerCase()
    const url = `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`
    const res = await ctx.fetch(url)
    expectOk('crtsh', res)
    const entries = (await res.json().catch(() => null)) as CrtShEntry[] | null
    if (!Array.isArray(entries)) return []

    const subs = new Set<string>()
    for (const entry of entries) {
      for (const raw of (entry.name_value ?? '').split('\n')) {
        const name = raw.trim().toLowerCase().replace(/^\*\./, '')
        if (name && name !== domain && name.endsWith('.' + domain)) subs.add(name)
      }
    }

    return [...subs].sort().map<Evidence>((sub) => ({
      claim: `Subdomain: ${sub}`,
      entity: { type: 'domain', value: sub },
      sourceKey: 'crtsh',
      sourceUrl: url,
      retrievedAt,
      admiralty: { source: 'B', info: 2 },
      confidence: 'possible',
      data: { subdomain: sub },
    }))
  },
}
