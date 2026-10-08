import { afterEach, describe, expect, it } from 'vitest'
import { openalex } from './research'

/**
 * OpenAlex budgets keyless calls per IP address and answered 429 from shared
 * addresses on 2026-10-08 (R327). The key comes from the environment only.
 */
function capture() {
  const urls: string[] = []
  return {
    urls,
    ctx: {
      fetch: async (url: string) => {
        urls.push(url)
        return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    },
  }
}

describe('OpenAlex key', () => {
  afterEach(() => {
    delete process.env.OPENALEX_API_KEY
  })

  it('sends the key from the environment when one is set', async () => {
    process.env.OPENALEX_API_KEY = 'test-key-not-a-secret'
    const { urls, ctx } = capture()
    await openalex.run({ capability: 'research', value: 'quantum computing' }, ctx)
    expect(urls[0]).toContain('api_key=test-key-not-a-secret')
    expect(urls[0]).toContain('mailto=')
  })

  it('still works keyless, without inventing a key', async () => {
    const { urls, ctx } = capture()
    await openalex.run({ capability: 'research', value: 'quantum computing' }, ctx)
    expect(urls[0]).not.toContain('api_key')
  })
})
