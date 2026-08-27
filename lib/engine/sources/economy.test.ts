import { describe, expect, it, vi } from 'vitest'
import { worldbankEconomy } from './economy'
import type { SourceContext, SourceInput } from '../types'

/**
 * The macro-economy source, against the shape the World Bank actually returns.
 *
 * This source had no tests at all, which is how it went years reporting three
 * indicators — GDP, population, inflation — while a reader asking about a
 * country's **industry**, its **factories** or its **private sector** got
 * nothing, and nothing anywhere said so.
 *
 * The fixture is the real response reduced to the fields the reader touches,
 * including the detail that matters most: the API returns the indicators in
 * **its** order, not the order they were asked for.
 */
function response(rows: Array<{ id: string; value: number | null; date: string }>) {
  return [
    { page: 1, total: rows.length },
    rows.map((r) => ({
      indicator: { id: r.id, value: r.id },
      country: { id: 'DE', value: 'Germany' },
      date: r.date,
      value: r.value,
    })),
  ]
}

function context(body: unknown, ok = true): SourceContext {
  return {
    fetch: vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response),
  } as unknown as SourceContext
}

const GERMANY: SourceInput = { value: 'Germany' } as SourceInput

describe('what the country makes, not only how big it is', () => {
  /**
   * The gap this closes. Manufacturing, industry, agriculture and services as
   * shares of GDP are what say a country *does* — and none of them were ever
   * requested.
   */
  it('reports the productive economy, not just size and prices', async () => {
    const ctx = context(
      response([
        { id: 'NY.GDP.MKTP.CD', value: 5.05e12, date: '2025' },
        { id: 'NV.IND.MANF.ZS', value: 17.61, date: '2025' },
        { id: 'NV.IND.TOTL.ZS', value: 25.16, date: '2025' },
        { id: 'FS.AST.PRVT.GD.ZS', value: 77.25, date: '2023' },
      ]),
    )
    const claims = (await worldbankEconomy.run(GERMANY, ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('Manufacturing (share of GDP)') && c.includes('17.6%'))).toBe(true)
    expect(claims.some((c) => c.includes('Industry incl. construction'))).toBe(true)
    expect(claims.some((c) => c.includes('Credit to the private sector'))).toBe(true)
  })

  /**
   * Twelve indicators used to mean twelve round trips to one institution about
   * one country. §3 asks us to respect the rate limits of the public bodies we
   * read — and a source declaring `minIntervalMs` can have its own fan-out
   * silently refused, which is a bug this codebase has already paid for once in
   * the ECB yield curve.
   */
  it('asks for every indicator in one request', async () => {
    const ctx = context(response([{ id: 'NY.GDP.MKTP.CD', value: 1, date: '2025' }]))
    await worldbankEconomy.run(GERMANY, ctx)
    expect(ctx.fetch).toHaveBeenCalledTimes(1)
    const url = String((ctx.fetch as unknown as { mock: { calls: string[][] } }).mock.calls[0][0])
    expect(url).toContain('NY.GDP.MKTP.CD;')
    expect(url).toContain('NV.IND.MANF.ZS')
  })

  /**
   * The ECB yield curve was read by position and printed the ten-year yield
   * under the two-year's name. The same trap is here: a multi-indicator
   * response is matched by indicator id, and the reading order is ours.
   */
  it('matches each figure to its indicator by id, never by position', async () => {
    const ctx = context(
      response([
        // Deliberately not the order they are declared in.
        { id: 'NV.IND.MANF.ZS', value: 17.61, date: '2025' },
        { id: 'SP.POP.TOTL', value: 83_491_249, date: '2025' },
        { id: 'NY.GDP.MKTP.CD', value: 5.05e12, date: '2025' },
      ]),
    )
    const claims = (await worldbankEconomy.run(GERMANY, ctx)).map((e) => e.claim)
    // GDP leads because that is the reading order chosen here, not the order
    // the provider happened to answer in.
    expect(claims[0]).toContain('GDP (2025): $5.05T')
    expect(claims.some((c) => c.includes('Manufacturing (share of GDP) (2025): 17.6%'))).toBe(true)
    expect(claims.some((c) => c.includes('Population (2025): 83.5M'))).toBe(true)
  })

  it('carries the year the figure describes, not the moment we fetched it', async () => {
    const ctx = context(response([{ id: 'FS.AST.PRVT.GD.ZS', value: 77.25, date: '2023' }]))
    const [e] = await worldbankEconomy.run(GERMANY, ctx)
    // A 2023 series is still the most recent one published; saying so is the
    // difference between a stale figure and a dishonest one.
    expect(e?.claim).toContain('(2023)')
  })
})

describe('it refuses rather than invents', () => {
  it('returns nothing when the subject is not a country', async () => {
    const ctx = context(response([{ id: 'NY.GDP.MKTP.CD', value: 1, date: '2025' }]))
    expect(await worldbankEconomy.run({ value: 'Apple Inc.' } as SourceInput, ctx)).toEqual([])
    // And does not spend a request finding that out.
    expect(ctx.fetch).not.toHaveBeenCalled()
  })

  /**
   * Inverted, because it was asserting the fault.
   *
   * "Returns nothing when the provider fails" is exactly the shape that let a
   * refusal be reported as a healthy source with nothing to say — measured on
   * the deployed site as 13 sources OK, 0 failed and 0 movers. A provider that
   * refused us has not told us the country has no economy.
   *
   * The half-picture worry the old name carried is still honoured: it throws
   * *before* emitting anything, so no partial set escapes.
   */
  it('raises the provider’s refusal rather than reporting an empty economy', async () => {
    await expect(worldbankEconomy.run(GERMANY, context(null, false))).rejects.toThrow(
      /worldbank_economy/,
    )
  })

  it('skips an indicator with no value instead of printing a blank figure', async () => {
    const ctx = context(
      response([
        { id: 'NY.GDP.MKTP.CD', value: 5.05e12, date: '2025' },
        { id: 'IC.BUS.NDNS.ZS', value: null, date: '2024' },
      ]),
    )
    const out = await worldbankEconomy.run(GERMANY, ctx)
    expect(out).toHaveLength(1)
    expect(out[0]?.claim).toContain('GDP')
  })

  it('survives a response that is not the shape the API documents', async () => {
    for (const body of [null, {}, [], [1], [1, null]]) {
      expect(await worldbankEconomy.run(GERMANY, context(body))).toEqual([])
    }
  })

  it('reads the register passively, as §3 requires', () => {
    expect(worldbankEconomy.passive).toBe(true)
    expect(worldbankEconomy.hosts).toEqual(['api.worldbank.org'])
  })
})
