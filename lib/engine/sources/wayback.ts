/**
 * Wayback Machine (CDX API) — archive history. Reveals how long a site has
 * existed and its snapshot span. Keyless.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

function fmt(ts?: string): string {
  if (!ts || ts.length < 8) return 'unknown'
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
}

export const wayback: Source = {
  key: 'wayback',
  capability: 'archive',
  passive: true,
  hosts: ['web.archive.org'],
  minIntervalMs: 500,
  async run(input, ctx) {
    const retrievedAt = new Date().toISOString()
    const url =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(input.value)}` +
      `&output=json&limit=500&collapse=timestamp:8&fl=timestamp,original`
    const res = await ctx.fetch(url)
    expectOk('wayback', res)
    const rows = (await res.json().catch(() => null)) as string[][] | null
    if (!Array.isArray(rows) || rows.length <= 1) return []

    const header = rows[0]
    const tsIdx = header.indexOf('timestamp')
    if (tsIdx < 0) return []
    const timestamps = rows
      .slice(1)
      .map((r) => r[tsIdx])
      .filter((t): t is string => Boolean(t))
      .sort()
    if (timestamps.length === 0) return []

    const first = fmt(timestamps[0])
    const last = fmt(timestamps[timestamps.length - 1])
    return [
      {
        claim: `Archived: ${timestamps.length} snapshot-days, first ${first}, last ${last}`,
        sourceKey: 'wayback',
        sourceUrl: `https://web.archive.org/web/*/${input.value}`,
        retrievedAt,
        admiralty: { source: 'B', info: 3 },
        confidence: 'possible',
        data: { snapshotDays: timestamps.length, first, last },
      },
    ]
  },
}
