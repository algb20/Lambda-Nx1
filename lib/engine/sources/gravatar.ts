/**
 * Gravatar — a public profile tied to an email's MD5 hash (keyless, passive).
 * Presence of a profile is a useful pivot; we read the public profile only.
 */
import { createHash } from 'node:crypto'
import type { Evidence, Source } from '../types'

interface GravatarProfile {
  entry?: Array<{ displayName?: string; profileUrl?: string; aboutMe?: string }>
}

export const gravatar: Source = {
  key: 'gravatar',
  capability: 'email_breach', // grouped under email footprint; distinct source key
  passive: true,
  hosts: ['www.gravatar.com'],
  minIntervalMs: 250,
  async run(input, ctx) {
    const email = input.value.trim().toLowerCase()
    const hash = createHash('md5').update(email).digest('hex')
    const retrievedAt = new Date().toISOString()
    const url = `https://www.gravatar.com/${hash}.json`
    const res = await ctx.fetch(url)
    if (!res.ok) return [] // 404 = no public Gravatar
    const j = (await res.json().catch(() => null)) as GravatarProfile | null
    const entry = j?.entry?.[0]
    const profileUrl = entry?.profileUrl ?? `https://www.gravatar.com/${hash}`

    const out: Evidence[] = [
      {
        claim: `Has a public Gravatar profile${entry?.displayName ? ` (${entry.displayName})` : ''}`,
        entity: { type: 'url', value: profileUrl },
        sourceKey: 'gravatar',
        sourceUrl: url,
        retrievedAt,
        admiralty: { source: 'B', info: 2 },
        confidence: 'possible',
        data: { profileUrl, displayName: entry?.displayName },
      },
    ]
    return out
  },
}
