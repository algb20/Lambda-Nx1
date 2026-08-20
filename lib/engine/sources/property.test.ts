import { describe, expect, it, vi } from 'vitest'
import { euHousePrices, ukHousePrices, usHousing } from './property'
import type { SourceContext, SourceInput } from '../types'

const INPUT: SourceInput = { capability: 'property', value: '' }

function ctx(body: string, ok = true): SourceContext {
  return {
    fetch: vi.fn(async () => ({ ok, status: ok ? 200 : 503, text: async () => body, json: async () => JSON.parse(body) })),
  } as unknown as SourceContext
}

describe('United States — FRED housing', () => {
  const CSV = `observation_date,MORTGAGE30US
2026-08-06,6.71
2026-08-13,6.67
`

  it('reads the latest observation and the move that produced it', async () => {
    const out = await usHousing.run(INPUT, ctx(CSV))
    const first = out[0].data as { value: number; change: number; region: string; period: string }
    expect(first.value).toBe(6.67)
    expect(first.change).toBeCloseTo(((6.67 - 6.71) / 6.71) * 100, 6)
    expect(first.region).toBe('United States')
    expect(first.period).toBe('2026-08-13')
  })

  /**
   * The period is inside the claim, not beside it. A housing figure without its
   * date reads as today's and is routinely six months old — the single most
   * misleading thing this gateway could do.
   */
  it('puts the published period in the claim itself', async () => {
    const [first] = await usHousing.run(INPUT, ctx(CSV))
    expect(first.claim).toContain('2026-08-13')
  })

  /**
   * FRED writes `.` for a period with no observation. Reading it as zero would
   * draw a housing market that fell to nothing.
   */
  it('skips the no-observation marker rather than reading it as zero', async () => {
    const gaps = `observation_date,CSUSHPINSA
2026-04-01,334.0
2026-05-01,.
2026-06-01,335.1
`
    const [first] = await usHousing.run(INPUT, ctx(gaps))
    const d = first.data as { value: number; change: number }
    expect(d.value).toBe(335.1)
    expect(d.change).toBeCloseTo(((335.1 - 334.0) / 334.0) * 100, 6)
  })

  it('states no change rather than inventing one from a single observation', async () => {
    const single = `observation_date,HOUST
2026-07-01,1239
`
    const [first] = await usHousing.run(INPUT, ctx(single))
    expect((first.data as { change: number | null }).change).toBeNull()
  })

  it('grades the Federal Reserve publishing its own series as primary', async () => {
    const [first] = await usHousing.run(INPUT, ctx(CSV))
    expect(first.admiralty).toEqual({ source: 'A', info: 1 })
  })

  it('only ever reads FRED, and only reads', async () => {
    expect(usHousing.hosts).toEqual(['fred.stlouisfed.org'])
    expect(usHousing.passive).toBe(true)
  })

  /**
   * Six series at the 2000ms used for slower providers spends twelve seconds and
   * is killed by the orchestrator's deadline — losing the whole gateway to our
   * own politeness rather than to anything FRED did.
   */
  it('is spaced politely but inside the request budget', () => {
    expect(usHousing.minIntervalMs).toBeLessThanOrEqual(500)
    expect(usHousing.minIntervalMs).toBeGreaterThan(0)
  })
})

describe('European Union — Eurostat', () => {
  /**
   * JSON-stat: values live in a flat object keyed by a position computed across
   * every dimension, so reading it needs the dimension order and sizes. Getting
   * the stride wrong silently attributes Germany's number to Belgium, which is
   * why this is tested against the real response shape rather than assumed.
   */
  const JSONSTAT = JSON.stringify({
    id: ['freq', 'purchase', 'unit', 'geo', 'time'],
    size: [1, 1, 1, 4, 1],
    dimension: {
      geo: {
        category: {
          index: { EU27_2020: 0, EA21: 1, DE: 2, FR: 3 },
          label: {
            EU27_2020: 'European Union - 27 countries (from 2020)',
            EA21: 'Euro area – 21 countries (from 2026)',
            DE: 'Germany',
            FR: 'France',
          },
        },
      },
      time: { category: { index: { '2026-Q1': 0 } } },
    },
    value: { '0': 166.63, '1': 158.36, '2': 153.4, '3': 126.67 },
  })

  it('attributes each value to the right country', async () => {
    const out = await euHousePrices.run(INPUT, ctx(JSONSTAT))
    const byRegion = new Map(out.map((e) => [(e.data as { region: string }).region, (e.data as { value: number }).value]))
    expect(byRegion.get('Germany')).toBe(153.4)
    expect(byRegion.get('France')).toBe(126.67)
  })

  /**
   * Eurostat's own labels carry their footnotes — precise, and unreadable at the
   * width of a table row.
   */
  it('gives the two aggregates a name a person can read', async () => {
    const out = await euHousePrices.run(INPUT, ctx(JSONSTAT))
    const regions = out.map((e) => (e.data as { region: string }).region)
    expect(regions).toContain('European Union')
    expect(regions).toContain('Euro area')
    expect(regions.some((r) => r.includes('countries'))).toBe(false)
  })

  /**
   * Eurostat publishes seven aggregates so a researcher can compare across
   * decades of changing membership. A reader gets six near-identical rows
   * differing in the first decimal and learns nothing from any of them.
   */
  it('drops the superseded memberships', async () => {
    const withOld = JSON.parse(JSONSTAT) as Record<string, unknown>
    const dim = withOld.dimension as { geo: { category: { index: Record<string, number>; label: Record<string, string> } } }
    dim.geo.category.index = { EU27_2020: 0, EU28: 1, EA19: 2, DE: 3 }
    dim.geo.category.label = { EU27_2020: 'EU27', EU28: 'EU28', EA19: 'EA19', DE: 'Germany' }
    const out = await euHousePrices.run(INPUT, ctx(JSON.stringify(withOld)))
    expect(out).toHaveLength(2)
  })

  it('returns nothing for a body that is not JSON-stat, rather than inventing rows', async () => {
    expect(await euHousePrices.run(INPUT, ctx('{"error":"nope"}'))).toEqual([])
  })

  /**
   * One period was requested, so there is nothing to difference against. A
   * change computed here would be a number with no meaning.
   */
  it('states no change when only one period was asked for', async () => {
    const [first] = await euHousePrices.run(INPUT, ctx(JSONSTAT))
    expect((first.data as { change: number | null }).change).toBeNull()
  })
})

describe('United Kingdom — HM Land Registry', () => {
  const UKHPI = JSON.stringify({
    result: { primaryTopic: { averagePrice: 272188, percentageAnnualChange: 2, salesVolume: 61234 } },
  })

  it('reads the average price and the registry’s own annual change', async () => {
    const out = await ukHousePrices.run(INPUT, ctx(UKHPI))
    const price = out.find((e) => (e.data as { class: string }).class === 'price')
    expect((price?.data as { value: number }).value).toBe(272188)
    expect((price?.data as { change: number }).change).toBe(2)
    expect((price?.data as { unit: string }).unit).toBe('GBP')
  })

  it('lists sales volume as activity, separately from price', async () => {
    const out = await ukHousePrices.run(INPUT, ctx(UKHPI))
    expect(out.map((e) => (e.data as { class: string }).class).sort()).toEqual(['activity', 'price'])
  })

  /**
   * The registry publishes a month roughly two months late, and does not
   * publish sales volume even then. A month that is short a figure must still
   * yield the figures it does have.
   */
  it('omits a figure the registry has not published yet rather than guessing it', async () => {
    const noSales = JSON.stringify({ result: { primaryTopic: { averagePrice: 272188 } } })
    const out = await ukHousePrices.run(INPUT, ctx(noSales))
    expect(out).toHaveLength(1)
    expect((out[0].data as { class: string }).class).toBe('price')
  })

  /**
   * The UK HPI runs about two months behind, so "this month" never exists. A
   * fixed offset would break silently the day the registry changed its
   * schedule; walking back until a month answers does not.
   */
  it('walks back through months until one has been published', async () => {
    let calls = 0
    const flaky = {
      fetch: vi.fn(async () => {
        calls++
        return calls < 3
          ? { ok: false, status: 404, text: async () => '', json: async () => ({}) }
          : { ok: true, status: 200, text: async () => UKHPI, json: async () => JSON.parse(UKHPI) }
      }),
    } as unknown as SourceContext
    const out = await ukHousePrices.run(INPUT, flaky)
    expect(out.length).toBeGreaterThan(0)
    expect(calls).toBe(3)
  })

  it('gives up rather than looping when nothing is published at all', async () => {
    const dead = {
      fetch: vi.fn(async () => ({ ok: false, status: 404, text: async () => '', json: async () => ({}) })),
    } as unknown as SourceContext
    expect(await ukHousePrices.run(INPUT, dead)).toEqual([])
  })

  it('only ever reads the registry, and only reads', () => {
    expect(ukHousePrices.hosts).toEqual(['landregistry.data.gov.uk'])
    expect(ukHousePrices.passive).toBe(true)
  })
})
