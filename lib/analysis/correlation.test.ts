import { describe, expect, it } from 'vitest'
import {
  correlationDistance,
  correlationNetwork,
  logReturns,
  pearson,
  stdDev,
  type PriceSeries,
} from './correlation'

/**
 * A deterministic pseudo-series with a known shape.
 *
 * Not `Math.random()` — the charter forbids it, and it would also make a
 * failing assertion unreproducible. A sine at an irrational-ish step gives a
 * series with real variance and no repeating period inside the sample.
 */
function wave(n: number, phase: number, step = 0.37): number[] {
  const out: number[] = []
  let price = 100
  for (let i = 0; i < n; i++) {
    price *= 1 + 0.01 * Math.sin(i * step + phase)
    out.push(price)
  }
  return out
}

/** The same wave with an independent second component mixed in. */
function mixed(n: number, phase: number, mix: number): number[] {
  const out: number[] = []
  let price = 100
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 0.37 + phase)
    const b = Math.sin(i * 1.13 + phase * 2)
    price *= 1 + 0.01 * ((1 - mix) * a + mix * b)
    out.push(price)
  }
  return out
}

describe('log returns', () => {
  /**
   * Compared closely rather than exactly, and that is the honest assertion:
   * `11/10` and `1100/1000` are not the same double. The property being tested
   * is scale invariance, not bit equality, and demanding the latter would be a
   * test that fails for a reason unrelated to anything it claims to check.
   */
  it('removes the level, so two series differing only by scale return the same', () => {
    const a = logReturns([10, 11, 12.1])!
    const b = logReturns([1000, 1100, 1210])!
    expect(a).toHaveLength(b.length)
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12))
  })

  /**
   * The important refusal. A zero or negative price has no logarithm, and the
   * tempting fix — skip that point — silently produces one return covering two
   * periods while every other covers one.
   */
  it('refuses the whole series rather than bridging a bad price', () => {
    expect(logReturns([10, 0, 12])).toBeNull()
    expect(logReturns([10, -1, 12])).toBeNull()
    expect(logReturns([10, Number.NaN, 12])).toBeNull()
  })

  it('has one fewer value than it has prices', () => {
    expect(logReturns([1, 2, 3, 4])).toHaveLength(3)
  })
})

describe('pearson', () => {
  it('is 1 for a series against itself', () => {
    expect(pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1, 12)
  })

  it('is −1 against its own negation', () => {
    expect(pearson([1, 2, 3, 4, 5], [-1, -2, -3, -4, -5])).toBeCloseTo(-1, 12)
  })

  it('is 0 when one side does not move', () => {
    expect(pearson([1, 2, 3], [7, 7, 7])).toBe(0)
  })

  it('matches a hand-computed case', () => {
    // x = [1,2,3] → dx = [−1,0,1], Σdx² = 2
    // y = [2,4,7] → mean 13/3, dy = [−7/3,−1/3,8/3], Σdy² = 38/3
    // Σdxdy = 7/3 + 0 + 8/3 = 5  →  r = 5 / √(2 · 38/3) = 0.993399…
    expect(pearson([1, 2, 3], [2, 4, 7])).toBeCloseTo(0.9933992678, 9)
  })
})

describe('Mantegna distance', () => {
  it('is 0 for perfect agreement, √2 for none, 2 for perfect opposition', () => {
    expect(correlationDistance(1)).toBeCloseTo(0, 12)
    expect(correlationDistance(0)).toBeCloseTo(Math.SQRT2, 12)
    expect(correlationDistance(-1)).toBeCloseTo(2, 12)
  })

  /**
   * The property the whole tree rests on, and the reason `1 − r` was not used:
   * a spanning tree over a non-metric is a picture of nothing.
   *
   * The triple has to be one a real correlation matrix can produce. My first
   * attempt used r(a,b) = r(b,c) = 0.9 with r(a,c) = 0.5, and the assertion
   * failed — correctly. A correlation matrix must be positive semi-definite,
   * and with two legs at 0.9 the third cannot fall below 2(0.9²) − 1 = 0.62.
   * The failing triple was not a hard case for the metric; it was a matrix that
   * cannot exist. At the boundary the inequality holds, and `1 − r` still
   * breaks — which is the whole point.
   */
  it('satisfies the triangle inequality on a case where 1 − r does not', () => {
    const dab = correlationDistance(0.9)
    const dbc = correlationDistance(0.9)
    const dac = correlationDistance(0.62)
    expect(dab + dbc).toBeGreaterThanOrEqual(dac)
    // The same, realisable triple breaks the naive 1 − r.
    expect(1 - 0.9 + (1 - 0.9)).toBeLessThan(1 - 0.62)
  })

  /**
   * And the same property over a matrix actually computed from series, rather
   * than three numbers chosen by hand — which is where the hand-chosen triple
   * went wrong.
   */
  it('holds across every triple of a computed matrix', () => {
    const series = [0, 0.4, 1.1, 2.3, 3.0, 4.4].map((p) => logReturns(wave(120, p))!)
    const d = (i: number, j: number) => correlationDistance(pearson(series[i], series[j]))
    for (let i = 0; i < series.length; i++) {
      for (let j = 0; j < series.length; j++) {
        for (let k = 0; k < series.length; k++) {
          // A floating-point epsilon, because equality is reachable when two
          // assets are identical and the sum then ties the direct distance.
          expect(d(i, j) + d(j, k)).toBeGreaterThanOrEqual(d(i, k) - 1e-12)
        }
      }
    }
  })

  it('does not produce NaN when a correlation lands just outside [−1, 1]', () => {
    expect(Number.isFinite(correlationDistance(1.0000000002))).toBe(true)
    expect(Number.isFinite(correlationDistance(-1.0000000002))).toBe(true)
  })
})

describe('standard deviation', () => {
  it('is 0 for a constant series', () => {
    expect(stdDev([3, 3, 3, 3])).toBe(0)
  })

  it('matches a hand-computed population value', () => {
    // [2,4,4,4,5,5,7,9] has population σ = 2.
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 12)
  })
})

describe('the network refuses what it cannot honestly measure', () => {
  const long = (phase: number) => wave(80, phase)

  it('drops a series too short to correlate, and names it', () => {
    const net = correlationNetwork(
      [
        { key: 'a', label: 'A', prices: long(0) },
        { key: 'b', label: 'B', prices: long(1) },
        { key: 'short', label: 'Short', prices: [1, 2, 3, 4, 5] },
      ],
      { minObservations: 30 },
    )
    expect(net.keys).toEqual(['a', 'b'])
    expect(net.dropped).toEqual([
      { key: 'short', label: 'Short', reason: 'too-short', measured: 4 },
    ])
  })

  /**
   * The common case, not the edge case: every stablecoin on a crypto board is
   * flat, and Pearson on a flat series divides by roughly zero.
   */
  it('drops a flat series — a stablecoin is not an uncorrelated asset', () => {
    const flat = new Array(80).fill(1)
    const net = correlationNetwork([
      { key: 'a', label: 'A', prices: long(0) },
      { key: 'b', label: 'B', prices: long(1) },
      { key: 'usdt', label: 'Tether', prices: flat },
    ])
    expect(net.keys).not.toContain('usdt')
    const drop = net.dropped.find((d) => d.key === 'usdt')
    expect(drop?.reason).toBe('flat')
    expect(drop?.measured).toBe(0)
  })

  it('drops a series with a non-positive price and names why', () => {
    const broken = long(0).slice()
    broken[40] = 0
    const net = correlationNetwork([
      { key: 'a', label: 'A', prices: long(0) },
      { key: 'b', label: 'B', prices: long(1) },
      { key: 'broken', label: 'Broken', prices: broken },
    ])
    expect(net.dropped.find((d) => d.key === 'broken')?.reason).toBe('non-finite')
  })

  it('returns an empty network rather than throwing when nothing survives', () => {
    const net = correlationNetwork([{ key: 'x', label: 'X', prices: [1, 2] }])
    expect(net.keys).toEqual([])
    expect(net.edges).toEqual([])
    expect(net.observations).toBe(0)
    expect(net.dropped).toHaveLength(1)
  })

  /**
   * The rule that a live board corrected. Aligning to the *shortest* is the
   * obvious choice and the expensive one: measured against CoinGecko, ninety-
   * nine assets returned 168 hourly closes and one newly-listed asset returned
   * 127. Truncating to the shortest would have cost all ninety-nine a quarter
   * of the window to keep one.
   */
  it('aligns to the window most series share, not to the shortest', () => {
    const net = correlationNetwork([
      { key: 'a', label: 'A', prices: wave(120, 0) },
      { key: 'b', label: 'B', prices: wave(120, 1) },
      { key: 'c', label: 'C', prices: wave(120, 2) },
      { key: 'new', label: 'Newly listed', prices: wave(60, 3) },
    ])
    expect(net.observations).toBe(119)
    expect(net.keys).toEqual(['a', 'b', 'c'])
  })

  /**
   * And the one that pays for it is named, with the reason distinguishing it
   * from a series that was unusable in the first place.
   */
  it('names the series it dropped for being a shorter window', () => {
    const net = correlationNetwork([
      { key: 'a', label: 'A', prices: wave(120, 0) },
      { key: 'b', label: 'B', prices: wave(120, 1) },
      { key: 'new', label: 'Newly listed', prices: wave(60, 3) },
    ])
    expect(net.dropped).toEqual([
      { key: 'new', label: 'Newly listed', reason: 'short-window', measured: 59 },
    ])
  })

  /**
   * A tie in how many series share each length goes to the longer window —
   * more observations for the same number of assets.
   */
  it('breaks a tie in favour of the longer window', () => {
    const net = correlationNetwork([
      { key: 'a', label: 'A', prices: wave(120, 0) },
      { key: 'b', label: 'B', prices: wave(120, 1) },
      { key: 'c', label: 'C', prices: wave(80, 2) },
      { key: 'd', label: 'D', prices: wave(80, 3) },
    ])
    expect(net.observations).toBe(119)
    expect(net.keys).toEqual(['a', 'b'])
  })
})

describe('the asset tree', () => {
  const series = (): PriceSeries[] => [
    // Two tight pairs plus a stray, which is the structure a market has.
    { key: 'a1', label: 'A1', prices: mixed(120, 0, 0.05) },
    { key: 'a2', label: 'A2', prices: mixed(120, 0.02, 0.05) },
    { key: 'b1', label: 'B1', prices: mixed(120, 3.1, 0.05) },
    { key: 'b2', label: 'B2', prices: mixed(120, 3.12, 0.05) },
    { key: 'c1', label: 'C1', prices: mixed(120, 1.6, 0.9) },
  ]

  it('connects every asset with exactly n − 1 edges', () => {
    const net = correlationNetwork(series())
    expect(net.keys).toHaveLength(5)
    expect(net.edges).toHaveLength(4)
    const touched = new Set(net.edges.flatMap((e) => [e.a, e.b]))
    expect(touched.size).toBe(5)
  })

  it('has no cycle — every edge introduces exactly one new node', () => {
    const net = correlationNetwork(series())
    const seen = new Set<string>()
    for (const e of net.edges) {
      const fresh = [e.a, e.b].filter((k) => !seen.has(k))
      // The first edge introduces two; every later edge introduces one.
      expect(fresh.length).toBe(seen.size === 0 ? 2 : 1)
      seen.add(e.a)
      seen.add(e.b)
    }
  })

  it('prefers the closest pairs — the tightest pair is joined directly', () => {
    const net = correlationNetwork(series())
    const joined = (x: string, y: string) =>
      net.edges.some((e) => (e.a === x && e.b === y) || (e.a === y && e.b === x))
    expect(joined('a1', 'a2')).toBe(true)
    expect(joined('b1', 'b2')).toBe(true)
  })

  it('carries the correlation and the distance on every edge', () => {
    for (const e of correlationNetwork(series()).edges) {
      expect(e.r).toBeGreaterThanOrEqual(-1)
      expect(e.r).toBeLessThanOrEqual(1)
      expect(e.distance).toBeCloseTo(correlationDistance(e.r), 12)
    }
  })

  /**
   * The picture must not reshuffle between two identical loads, so nothing in
   * here may depend on iteration order or input order.
   */
  it('is identical across runs and independent of input order', () => {
    const forward = correlationNetwork(series())
    const backward = correlationNetwork([...series()].reverse())
    const normalise = (edges: typeof forward.edges) =>
      edges
        .map((e) => (e.a < e.b ? `${e.a}~${e.b}` : `${e.b}~${e.a}`))
        .sort()
    expect(normalise(backward.edges)).toEqual(normalise(forward.edges))
    expect(backward.cluster).toEqual(forward.cluster)
  })
})

describe('clusters', () => {
  it('separates two tight groups rather than putting everything in one', () => {
    const net = correlationNetwork(
      [
        { key: 'a1', label: 'A1', prices: mixed(120, 0, 0.05) },
        { key: 'a2', label: 'A2', prices: mixed(120, 0.02, 0.05) },
        { key: 'a3', label: 'A3', prices: mixed(120, 0.04, 0.05) },
        { key: 'b1', label: 'B1', prices: mixed(120, 3.1, 0.05) },
        { key: 'b2', label: 'B2', prices: mixed(120, 3.12, 0.05) },
        { key: 'b3', label: 'B3', prices: mixed(120, 3.14, 0.05) },
      ],
      { clusters: 2 },
    )
    expect(net.cluster.a1).toBe(net.cluster.a2)
    expect(net.cluster.a2).toBe(net.cluster.a3)
    expect(net.cluster.b1).toBe(net.cluster.b2)
    expect(net.cluster.b2).toBe(net.cluster.b3)
    expect(net.cluster.a1).not.toBe(net.cluster.b1)
  })

  it('numbers clusters by their smallest key, so colours are stable', () => {
    const net = correlationNetwork(
      [
        { key: 'zz', label: 'Z', prices: mixed(120, 3.1, 0.05) },
        { key: 'aa', label: 'A', prices: mixed(120, 0, 0.05) },
      ],
      { clusters: 2 },
    )
    expect(net.cluster.aa).toBe(0)
    expect(net.cluster.zz).toBe(1)
  })

  it('never asks for more clusters than there are assets', () => {
    const net = correlationNetwork(
      [
        { key: 'a', label: 'A', prices: mixed(120, 0, 0.05) },
        { key: 'b', label: 'B', prices: mixed(120, 3.1, 0.05) },
      ],
      { clusters: 20 },
    )
    expect(new Set(Object.values(net.cluster)).size).toBe(2)
  })
})

describe('mean correlation', () => {
  it('is reported per asset, so a hub is distinguishable from a stray', () => {
    const net = correlationNetwork([
      { key: 'a1', label: 'A1', prices: mixed(120, 0, 0.05) },
      { key: 'a2', label: 'A2', prices: mixed(120, 0.02, 0.05) },
      { key: 'a3', label: 'A3', prices: mixed(120, 0.04, 0.05) },
      { key: 'lone', label: 'Lone', prices: mixed(120, 1.9, 0.95) },
    ])
    expect(net.meanCorrelation.a1).toBeGreaterThan(net.meanCorrelation.lone)
    for (const v of Object.values(net.meanCorrelation)) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
