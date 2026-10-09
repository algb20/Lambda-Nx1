import { beforeEach, describe, expect, it } from 'vitest'
import { CATALOG } from './index'
import { catalogSource, resetValidators } from './adapter'

/**
 * Conditional GET for catalogue feeds — owner decision C14 (R335).
 * Measured first: 48 of 118 active feeds answer 304, ~70 % of bytes per pass
 * (docs/RESEARCH/CONDITIONAL_GET_2026-10-09.md).
 */
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Outbreak linked to sprouts</title><link>https://www.cdc.gov/x</link><pubDate>Thu, 10 Sep 2026 13:00:00 GMT</pubDate></item>
</channel></rss>`
const NO_INPUT = {} as never
const source = () => catalogSource(CATALOG.find((s) => s.key === 'cdc_outbreaks')!)

function recorder(responses: Response[]) {
  const calls: Array<Record<string, string>> = []
  return {
    calls,
    ctx: {
      fetch: async (_url: string, init?: RequestInit) => {
        calls.push(Object.fromEntries(new Headers(init?.headers).entries()))
        return responses.shift()!
      },
    },
  }
}

describe('a feed that has not changed is asked, not re-downloaded (C14)', () => {
  beforeEach(() => resetValidators())

  it('sends the validators from the last full answer, and serves its records on 304', async () => {
    const { calls, ctx } = recorder([
      new Response(RSS, { status: 200, headers: { etag: '"v1"', 'last-modified': 'Thu, 10 Sep 2026 13:00:00 GMT' } }),
      new Response(null, { status: 304 }),
    ])
    const first = await source().run(NO_INPUT, ctx)
    expect(calls[0]['if-none-match']).toBeUndefined()
    expect(first[0].confirmedUnchangedAt).toBeUndefined()

    const second = await source().run(NO_INPUT, ctx)
    expect(calls[1]['if-none-match']).toBe('"v1"')
    expect(calls[1]['if-modified-since']).toBe('Thu, 10 Sep 2026 13:00:00 GMT')
    expect(second.map((e) => e.claim)).toEqual(first.map((e) => e.claim))
    // retrievedAt is the moment we actually received it; only the new field moves.
    expect(second[0].retrievedAt).toBe(first[0].retrievedAt)
    expect(second[0].confirmedUnchangedAt).toMatch(/^\d{4}-\d\d-\d\dT/)
    expect(second.length, 'a 304 is never "empty"').toBeGreaterThan(0)
  })

  it('replaces records and validators when the feed did change', async () => {
    const changed = RSS.replace('Outbreak linked to sprouts', 'New outbreak notice')
    const { calls, ctx } = recorder([
      new Response(RSS, { status: 200, headers: { etag: '"v1"' } }),
      new Response(changed, { status: 200, headers: { etag: '"v2"' } }),
      new Response(null, { status: 304 }),
    ])
    await source().run(NO_INPUT, ctx)
    const second = await source().run(NO_INPUT, ctx)
    expect(second[0].claim).toBe('New outbreak notice')
    expect(second[0].confirmedUnchangedAt).toBeUndefined()
    await source().run(NO_INPUT, ctx)
    expect(calls[2]['if-none-match']).toBe('"v2"')
  })

  it('asks unconditionally when the publisher sends no validator', async () => {
    const { calls, ctx } = recorder([new Response(RSS, { status: 200 }), new Response(RSS, { status: 200 })])
    await source().run(NO_INPUT, ctx)
    await source().run(NO_INPUT, ctx)
    expect(calls[1]['if-none-match']).toBeUndefined()
    expect(calls[1]['if-modified-since']).toBeUndefined()
  })

  it('treats a 304 it did not ask for as a failure, not as data', async () => {
    const { ctx } = recorder([new Response(null, { status: 304 })])
    await expect(source().run(NO_INPUT, ctx)).rejects.toThrow(/answered 304/)
  })
})
