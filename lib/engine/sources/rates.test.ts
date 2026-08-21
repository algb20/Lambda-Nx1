import { describe, expect, it } from 'vitest'
import { readSdmx, readSdmxSeries } from './rates'

/**
 * The SDMX reader, against the shape the ECB actually returns.
 *
 * This fixture is not invented — it is the real response to a request for the
 * 2-year, 5-year and 10-year euro-area yields, reduced to the fields the reader
 * touches. The values are the ones the service returned on 2026-08-20.
 */
const CURVE_RESPONSE = {
  dataSets: [
    {
      series: {
        '0:0:0:0:0:0:0': { observations: { '0': [3.2782344774], '1': [3.279171221] } },
        '0:0:0:0:0:0:1': { observations: { '0': [2.7807523845], '1': [2.7913954426] } },
        '0:0:0:0:0:0:2': { observations: { '0': [2.9391624929], '1': [2.9343209849] } },
      },
    },
  ],
  structure: {
    dimensions: {
      series: [
        { values: [{ id: 'B' }] },
        { values: [{ id: 'U2' }] },
        { values: [{ id: 'EUR' }] },
        { values: [{ id: '4F' }] },
        { values: [{ id: 'G_N_A' }] },
        { values: [{ id: 'SV_C_YM' }] },
        // The order the API chose, which is NOT the order requested.
        { values: [{ id: 'SR_10Y' }, { id: 'SR_2Y' }, { id: 'SR_5Y' }] },
      ],
      observation: [{ values: [{ id: '2026-08-19' }, { id: '2026-08-20' }] }],
    },
  },
}

describe('readSdmxSeries', () => {
  /**
   * The mislabelling this exists to prevent. `SR_2Y+SR_5Y+SR_10Y` was requested
   * and `["SR_10Y","SR_2Y","SR_5Y"]` came back. Reading by position would print
   * the ten-year yield under the two-year's name — a number no reader could
   * check and every reader would act on.
   */
  it('names each series by the dimension the API returned, not by request order', () => {
    const series = readSdmxSeries(CURVE_RESPONSE)
    expect(series).toHaveLength(3)

    const tenYear = series.find((s) => s.ids.includes('SR_10Y'))
    const twoYear = series.find((s) => s.ids.includes('SR_2Y'))
    const fiveYear = series.find((s) => s.ids.includes('SR_5Y'))

    expect(tenYear?.points.at(-1)?.value).toBeCloseTo(3.279171221, 6)
    expect(twoYear?.points.at(-1)?.value).toBeCloseTo(2.7913954426, 6)
    expect(fiveYear?.points.at(-1)?.value).toBeCloseTo(2.9343209849, 6)
  })

  /**
   * Observations are keyed by position and the dates live in a parallel array.
   * A value read without that array is a number with no idea when it was true,
   * and an undated rate is not publishable.
   */
  it('attaches the real observation date to every value', () => {
    const twoYear = readSdmxSeries(CURVE_RESPONSE).find((s) => s.ids.includes('SR_2Y'))
    expect(twoYear?.points.map((p) => p.date)).toEqual(['2026-08-19', '2026-08-20'])
  })

  it('returns points in date order, so "latest" is the last one', () => {
    for (const s of readSdmxSeries(CURVE_RESPONSE)) {
      const dates = s.points.map((p) => p.date)
      expect([...dates].sort()).toEqual(dates)
    }
  })

  /**
   * A rate we cannot name or date is a rate we do not publish. Every one of
   * these must produce nothing rather than a plausible-looking wrong number.
   */
  it.each([
    ['null', null],
    ['a string', 'not sdmx'],
    ['an empty object', {}],
    ['a response with no observation dates', { dataSets: [{ series: { '0': { observations: { '0': [1] } } } }] }],
    ['a response with no series at all', { structure: { dimensions: { observation: [{ values: [] }] } } }],
  ])('returns nothing for %s', (_label, body) => {
    expect(readSdmxSeries(body)).toEqual([])
  })

  it('skips a value that is not a finite number rather than publishing it', () => {
    const withGap = {
      ...CURVE_RESPONSE,
      dataSets: [{ series: { '0:0:0:0:0:0:1': { observations: { '0': [null], '1': [2.79] } } } }],
    }
    const points = readSdmxSeries(withGap)[0]?.points ?? []
    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ date: '2026-08-20', value: 2.79 })
  })
})

describe('readSdmx — the single-series case', () => {
  it('reads a lone series, as the policy-rate endpoint returns', () => {
    const policy = {
      dataSets: [{ series: { '0:0:0:0:0:0': { observations: { '0': [2.4] } } } }],
      structure: {
        dimensions: {
          series: [{ values: [{ id: 'D' }] }],
          observation: [{ values: [{ id: '2026-08-21' }] }],
        },
      },
    }
    expect(readSdmx(policy)).toEqual([{ date: '2026-08-21', value: 2.4 }])
  })

  it('returns an empty list rather than throwing on a broken response', () => {
    expect(readSdmx(undefined)).toEqual([])
  })
})
