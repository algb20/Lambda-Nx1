/**
 * The correlation constellation — what moves with what, drawn from real series.
 *
 * ## What it is
 *
 * A hundred assets, seven days of hourly closes each, turned into the structure
 * that connects them: a correlation matrix on log returns, Mantegna's metric
 * distance, a minimum spanning tree over that distance, and average-linkage
 * clusters. Then a deterministic 3D layout, so the same market always draws the
 * same shape.
 *
 * The maths lives in `lib/analysis/correlation` and the placement in
 * `lib/graph/layout`; both are tested on their own. This module is the wiring:
 * ask the engine for series, build the network, attach what a reader needs to
 * judge it.
 *
 * ## What it says about itself, and why every one of these is on screen
 *
 * A correlation network is the easiest chart in finance to publish
 * dishonestly — it looks authoritative whatever went into it. So the report
 * carries, and the surface shows:
 *
 * - **`observations`** — how many returns each pair was computed from. A
 *   network over nine points and one over a hundred and sixty-seven look
 *   identical and are not the same claim.
 * - **`windowHours`** — what period this is a statement about. Seven days is
 *   seven days, not "the market".
 * - **`dropped`** — every asset excluded, with the reason and the measurement
 *   that caused it. Stablecoins leave here by the dozen and their absence would
 *   otherwise look like an oversight.
 * - **`sourcesOk` / `sourcesFailed`** — whether the picture is the whole board
 *   or the part of it that answered.
 *
 * ## Why crypto first, and what comes after
 *
 * Because the series are real, aligned, free and keyless today: one CoinGecko
 * request returns 168 hourly closes for a hundred assets. Equities, commodities
 * and FX have no comparable keyless series in this engine yet — the board reads
 * quotes for those, not histories. Adding them means either a provider that
 * publishes free history or our own accumulated archive, and both are real work
 * rather than a parameter. The class is therefore stated on the report rather
 * than implied, so the day a second class arrives nothing has to be renamed.
 */
import { collect } from '../engine/orchestrator'
import { registry } from '../engine/registry'
import { registerMarketSeries } from '../engine/sources'
import type { MarketSeriesPoint } from '../engine/sources/market-series'
import {
  correlationNetwork,
  type DroppedSeries,
  type PriceSeries,
} from '../analysis/correlation'
import {
  boundingRadius,
  layoutGraph,
  radiusPercentile,
  type LayoutEdge,
  type LayoutNode,
} from '../graph/layout'

/**
 * How many clusters to cut the hierarchy into.
 *
 * Ten, chosen by running it against the live board rather than by taste. At six
 * the picture was one group of 87 and five strays; at fourteen it was 67 plus
 * nine clusters of exactly one, which is not a grouping. Ten separates the four
 * groups that are actually there — the crypto beta cluster, the gold-backed
 * tokens, the dollar stablecoins and the tokenised treasuries — without
 * shattering the remainder into singletons.
 */
export const CLUSTER_COUNT = 10

/**
 * Scales the layout's rest lengths. Mantegna distance runs 0…2; multiplying by
 * this puts a tightly correlated pair about one unit apart and an opposed pair
 * about eight, which is a readable spread at the camera distance the renderer
 * uses.
 */
const LAYOUT_SCALE = 4

export interface ConstellationNode {
  key: string
  symbol: string
  name: string
  price: number
  change24h: number | null
  marketCap: number | null
  rank: number | null
  cluster: number
  /** Mean correlation against every other surviving asset — hub or stray. */
  meanCorrelation: number
  /** How many tree edges touch it. A hub in the asset tree is a real finding. */
  degree: number
  x: number
  y: number
  z: number
  sourceUrl?: string
}

export interface ConstellationEdge {
  a: string
  b: string
  r: number
  distance: number
}

export interface ConstellationCluster {
  index: number
  /** Named after its most-connected member, which is what a reader recognises. */
  label: string
  members: number
  /** Mean correlation *within* the cluster — how tight the group actually is. */
  cohesion: number
}

export interface ConstellationReport {
  generatedAt: string
  /** Which market this is. One today; the field exists so a second needs no rename. */
  assetClass: 'crypto'
  nodes: ConstellationNode[]
  edges: ConstellationEdge[]
  clusters: ConstellationCluster[]
  /** Furthest node from the centre — the whole extent, strays included. */
  radius: number
  /**
   * The radius holding nine nodes in ten — what a camera should actually frame.
   *
   * Measured on the live board: the outermost asset sat at 10.5 while half sat
   * inside 3.5. Framing the maximum shrinks the body of the market to a fifth
   * of the screen so two strays can stay inside the edge. They are still drawn
   * and one zoom step away.
   */
  frameRadius: number
  method: {
    observations: number
    windowHours: number
    intervalHours: number
    /** Named so the surface can cite it rather than assert authority. */
    distance: 'mantegna'
    structure: 'minimum-spanning-tree'
    clustering: 'average-linkage'
  }
  dropped: DroppedSeries[]
  /**
   * How much of the market sits in its largest group.
   *
   * This is a finding, not a diagnostic. In crypto one factor dominates — on a
   * live run, 81 of 99 assets fell into a single cluster — and a reader looking
   * at a picture with one huge blob in it deserves to be told that this is what
   * the market is, rather than left to conclude the clustering failed. On a
   * board with genuine sector structure the same number would be small, and
   * that too would be the finding.
   */
  concentration: { largestCluster: number; share: number }
  /**
   * Why a source did not answer, in its own words.
   *
   * Added because the deployed site returned `sourcesFailed: 1` and nothing
   * else — an empty constellation with no reason, which is indistinguishable
   * from a market with no structure in it. A count of failures without their
   * causes is the same silence this project keeps finding and removing: the
   * product reporting a shape when the truth is "I was refused".
   */
  failures: Array<{ source: string; error: string }>
  summary: {
    assetsRead: number
    assetsUsed: number
    sourcesOk: number
    sourcesFailed: number
  }
}

/** Empty rather than absent: the surface must be able to say what it found. */
function emptyReport(generatedAt: string, summary: ConstellationReport['summary']): ConstellationReport {
  return {
    generatedAt,
    assetClass: 'crypto',
    nodes: [],
    edges: [],
    clusters: [],
    radius: 0,
    frameRadius: 0,
    method: {
      observations: 0,
      windowHours: 0,
      intervalHours: 1,
      distance: 'mantegna',
      structure: 'minimum-spanning-tree',
      clustering: 'average-linkage',
    },
    dropped: [],
    concentration: { largestCluster: 0, share: 0 },
    failures: [],
    summary,
  }
}

export async function constellation(): Promise<ConstellationReport> {
  registerMarketSeries()
  const generatedAt = new Date().toISOString()

  const collected = await collect(
    { capability: 'market_series', value: '' },
    { registry, mode: 'all' },
  )
  const sourcesOk = collected.results.filter((x) => x.ok).length
  const sourcesFailed = collected.results.filter((x) => !x.ok).length
  const failures = collected.results
    .filter((x) => !x.ok)
    .map((x) => ({ source: x.sourceKey, error: x.error ?? 'no reason given' }))

  const points: MarketSeriesPoint[] = []
  for (const e of collected.evidence) {
    const d = e.data as MarketSeriesPoint | undefined
    if (!d || typeof d.key !== 'string' || !Array.isArray(d.prices)) continue
    points.push(d)
  }

  if (points.length === 0) {
    return {
      ...emptyReport(generatedAt, { assetsRead: 0, assetsUsed: 0, sourcesOk, sourcesFailed }),
      failures,
    }
  }

  const series: PriceSeries[] = points.map((p) => ({
    key: p.key,
    label: `${p.name} (${p.symbol})`,
    prices: p.prices,
  }))

  const network = correlationNetwork(series, { clusters: CLUSTER_COUNT })

  if (network.keys.length === 0) {
    return {
      ...emptyReport(generatedAt, {
        assetsRead: points.length,
        assetsUsed: 0,
        sourcesOk,
        sourcesFailed,
      }),
      dropped: network.dropped,
      failures,
    }
  }

  const byKey = new Map(points.map((p) => [p.key, p]))
  const degree = new Map<string, number>()
  for (const e of network.edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1)
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1)
  }

  /**
   * Mass drives the layout's repulsion, and market capitalisation is the right
   * quantity: the assets everything else follows should sit near the centre of
   * the picture and push their neighbours out, which is what they do in the
   * market. The cube root compresses a range that spans six orders of magnitude
   * into something a force calculation can use without the largest asset
   * flinging every other off the screen.
   */
  const layoutNodes: LayoutNode[] = network.keys.map((key) => {
    const cap = byKey.get(key)?.marketCap ?? null
    return {
      key,
      cluster: network.cluster[key],
      mass: cap && cap > 0 ? Math.max(0.4, Math.min(3, Math.cbrt(cap) / 3000)) : 0.6,
    }
  })

  const layoutEdges: LayoutEdge[] = network.edges.map((e) => ({
    a: e.a,
    b: e.b,
    distance: e.distance,
  }))

  const positions = layoutGraph(layoutNodes, layoutEdges, { scale: LAYOUT_SCALE })

  const nodes: ConstellationNode[] = network.keys.map((key) => {
    const p = byKey.get(key)!
    const pos = positions[key] ?? { x: 0, y: 0, z: 0 }
    return {
      key,
      symbol: p.symbol,
      name: p.name,
      price: p.price,
      change24h: p.change24h,
      marketCap: p.marketCap,
      rank: p.rank,
      cluster: network.cluster[key],
      meanCorrelation: network.meanCorrelation[key] ?? 0,
      degree: degree.get(key) ?? 0,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      sourceUrl: `https://www.coingecko.com/en/coins/${key}`,
    }
  })

  /**
   * A cluster is named after its most-connected member, with its degree broken
   * by market rank and then by key. "The BTC group" is a thing a reader can
   * hold; "cluster 3" is not. Numbering stays available underneath, because the
   * name is a convenience and the index is the identity.
   */
  const clusters: ConstellationCluster[] = []
  for (let index = 0; index < CLUSTER_COUNT; index++) {
    const members = nodes.filter((n) => n.cluster === index)
    if (members.length === 0) continue
    const lead = [...members].sort(
      (a, b) =>
        b.degree - a.degree ||
        (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
        (a.key < b.key ? -1 : 1),
    )[0]
    /**
     * Cohesion is the mean of the tree edges *inside* the cluster. Using every
     * pair would flatter a large cluster, because a cluster of twenty contains
     * a hundred and ninety pairs most of which the tree rejected as too weak to
     * draw.
     */
    const inside = network.edges.filter(
      (e) => network.cluster[e.a] === index && network.cluster[e.b] === index,
    )
    clusters.push({
      index,
      label: lead.symbol,
      members: members.length,
      cohesion: inside.length === 0 ? 0 : inside.reduce((s, e) => s + e.r, 0) / inside.length,
    })
  }

  return {
    generatedAt,
    assetClass: 'crypto',
    nodes,
    edges: network.edges.map((e) => ({ a: e.a, b: e.b, r: e.r, distance: e.distance })),
    clusters,
    radius: boundingRadius(positions),
    frameRadius: radiusPercentile(positions, 0.9),
    method: {
      observations: network.observations,
      /**
       * The window is the observation count times the interval, not the seven
       * days the provider advertises: if a series came back short, the picture
       * covers less than a week and must say the number it actually covers.
       */
      windowHours: network.observations * (points[0]?.intervalHours ?? 1),
      intervalHours: points[0]?.intervalHours ?? 1,
      distance: 'mantegna',
      structure: 'minimum-spanning-tree',
      clustering: 'average-linkage',
    },
    dropped: network.dropped,
    failures,
    concentration: {
      largestCluster: clusters.reduce((max, c) => Math.max(max, c.members), 0),
      share:
        nodes.length === 0
          ? 0
          : clusters.reduce((max, c) => Math.max(max, c.members), 0) / nodes.length,
    },
    summary: {
      assetsRead: points.length,
      assetsUsed: network.keys.length,
      sourcesOk,
      sourcesFailed,
    },
  }
}
