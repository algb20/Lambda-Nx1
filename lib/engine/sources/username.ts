/**
 * Username presence — checks public profile endpoints across platforms (passive:
 * we read third-party public pages/APIs, we never contact the person). Only
 * platforms with reliable "not found" semantics are included, to avoid false
 * positives (charter: truth over volume).
 */
import type { Evidence, Source } from '../types'

interface Platform {
  name: string
  host: string
  url: (u: string) => string
  /** Decide presence from the response. */
  present: (status: number, body: string) => boolean
}

const byStatus = (status: number) => status === 200

/**
 * Removed in batch 10, by each site's own terms (read 2026-10-05):
 * - GitHub — information from the Service, "whether scraped, collected through
 *   our API, or obtained otherwise", may be used for research (non-personal,
 *   open-access publications) or archiving; a commercial profile lookup is
 *   neither.
 * - Dev.to — "personal, non-commercial transitory viewing only".
 * - Replit — "Scraping or otherwise obtaining content … for any other purpose"
 *   is prohibited.
 * - Reddit — "If you are interested in using the Data APIs for commercial
 *   purposes … you will need to enter into a separate agreement with Reddit."
 * The remaining sites state no rule on this use (UNCLEAR in the registry).
 */
const PLATFORMS: Platform[] = [
  { name: 'GitLab', host: 'gitlab.com', url: (u) => `https://gitlab.com/${u}`, present: byStatus },
  { name: 'npm', host: 'www.npmjs.com', url: (u) => `https://www.npmjs.com/~${u}`, present: byStatus },
  { name: 'PyPI', host: 'pypi.org', url: (u) => `https://pypi.org/user/${u}/`, present: byStatus },
  {
    name: 'Docker Hub',
    host: 'hub.docker.com',
    url: (u) => `https://hub.docker.com/v2/users/${u}/`,
    present: byStatus,
  },
  {
    name: 'Chess.com',
    host: 'api.chess.com',
    url: (u) => `https://api.chess.com/pub/player/${u}`,
    present: byStatus,
  },
  {
    name: 'Keybase',
    host: 'keybase.io',
    url: (u) => `https://keybase.io/_/api/1.0/user/lookup.json?username=${u}`,
    present: (_s, body) => /"them"\s*:\s*\[\s*\{/.test(body),
  },
  {
    name: 'Hacker News',
    host: 'hacker-news.firebaseio.com',
    url: (u) => `https://hacker-news.firebaseio.com/v0/user/${u}.json`,
    present: (_s, body) => body.trim() !== 'null' && body.trim().length > 0,
  },
]

export const USERNAME_HOSTS = [...new Set(PLATFORMS.map((p) => p.host))]

/** Basic username sanity (avoid nonsense requests). */
function validUsername(u: string): boolean {
  return /^[a-zA-Z0-9._-]{1,39}$/.test(u)
}

export const usernameWeb: Source = {
  key: 'username.web',
  capability: 'username_presence',
  passive: true,
  hosts: USERNAME_HOSTS,
  minIntervalMs: 0,
  async run(input, ctx) {
    const username = input.value.trim()
    if (!validUsername(username)) return []
    const retrievedAt = new Date().toISOString()

    const checks = PLATFORMS.map(async (platform): Promise<Evidence | null> => {
      const url = platform.url(username)
      try {
        const res = await ctx.fetch(url)
        const body = platform.present.length > 1 ? await res.text() : ''
        if (!platform.present(res.status, body)) return null
        return {
          claim: `Found on ${platform.name}: ${url}`,
          entity: { type: 'url', value: url },
          sourceKey: 'username.web',
          sourceUrl: url,
          retrievedAt,
          admiralty: { source: 'C', info: 3 },
          confidence: 'possible',
          data: { platform: platform.name, url },
        }
      } catch {
        return null // a platform being unreachable is not a finding
      }
    })

    const results = await Promise.all(checks)
    return results.filter((e): e is Evidence => e !== null)
  },
}
