import type { CkanDataset, GuardedFetch, PortalMeasurement } from './client'
import { measurePortal, searchPortal } from './client'
import type { DataPortal } from './portals'
import { PORTALS, activePortals, independentPortals, portalHosts } from './portals'

export * from './portals'
export * from './client'

/**
 * The federation: one query, every open-data catalogue we can reach.
 *
 * ## Why this is not just `Promise.all`
 *
 * Thirty portals, several of them on hosting that is slow by any standard,
 * queried on behalf of one user pressing one button. Three things have to be
 * true at once, and only the first is obvious:
 *
 *  1. **One slow portal must not decide the response time.** Every portal runs
 *     against its own deadline and a portal that misses it is reported late,
 *     not waited for.
 *  2. **One dead portal must not look like an empty search.** Per-portal health
 *     is carried out with the results, in the same three states the world-events
 *     board uses — `ok`, `empty`, `failed` — because the difference between "no
 *     datasets exist" and "we could not ask" is the difference between an
 *     answer and a silence.
 *  3. **A harvested duplicate must not count twice.** `data.europa.eu` and a
 *     national portal returning the same dataset is one dataset from one
 *     origin. Fusion counts origins everywhere else in this engine; it counts
 *     them here too.
 */

export type PortalStatus = 'ok' | 'empty' | 'failed'

export interface PortalHealth {
  portalKey: string
  portalName: string
  country: string
  status: PortalStatus
  /** Datasets this portal contributed, before cross-portal deduplication. */
  count: number
  /** The portal's own total for the query, which is usually far larger. */
  total: number
  error: string | null
  ms: number
}

export interface FederatedSearch {
  query: string
  datasets: CkanDataset[]
  /** How many were dropped as the same dataset seen through another portal. */
  duplicatesRemoved: number
  health: PortalHealth[]
  summary: {
    portalsQueried: number
    portalsOk: number
    portalsEmpty: number
    portalsFailed: number
    /** Sum of each portal's own total — the size of the haystack, not the find. */
    matchesAcrossPortals: number
    /** Distinct publishing organizations behind the returned datasets. */
    publishers: number
    countries: number
  }
}

/** Portals are slow; the sweep is not allowed to be. */
export const PORTAL_TIMEOUT_MS = 8_000

/** Enough parallelism to be quick, few enough sockets to be polite. */
export const MAX_CONCURRENCY = 6

/**
 * Run `worker` over `items`, at most `limit` at a time.
 *
 * Written out rather than pulled in: a dependency for twelve lines of queueing
 * is a supply-chain risk we take on for no benefit, and the ordering guarantee
 * (results align with inputs) is one we rely on when zipping health to portals.
 */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * A deadline that rejects rather than hangs.
 *
 * `AbortSignal` would be cleaner, but the guarded fetch owns the request init
 * and threading a signal through it would let a source pass arbitrary options
 * into the guardrail — a hole in the passive guarantee for the sake of tidiness.
 */
function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: no answer within ${ms}ms`)), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer)) as Promise<T>
}

/**
 * The identity of a dataset *across* portals.
 *
 * CKAN ids are per-deployment, so they cannot detect a harvested copy. The slug
 * plus the owning organization can: a harvester preserves both, and two genuinely
 * different datasets that share a slug almost never share a publisher. Title is
 * deliberately not used — harvesters translate it.
 */
function crossPortalKey(d: CkanDataset): string {
  return `${(d.organization ?? '·').toLowerCase()}::${d.name.toLowerCase()}`
}

/**
 * Which of two copies of one dataset to keep.
 *
 * The origin portal beats the harvester, because the origin is where the data
 * is maintained and where a correction lands first. `independentPortals()`
 * already tells us which is which, so rank is a lookup rather than a heuristic.
 */
function preferOrigin(portals: DataPortal[]): (a: CkanDataset, b: CkanDataset) => CkanDataset {
  const origins = new Set(independentPortals(portals).map((p) => p.key))
  return (a, b) => {
    const aOrigin = origins.has(a.portalKey)
    const bOrigin = origins.has(b.portalKey)
    if (aOrigin !== bOrigin) return aOrigin ? a : b
    // Same standing: the record the publisher touched most recently wins, and
    // a stated date beats no date — a copy with no timestamp is never fresher.
    const at = a.modifiedAt ? Date.parse(a.modifiedAt) : -Infinity
    const bt = b.modifiedAt ? Date.parse(b.modifiedAt) : -Infinity
    return bt > at ? b : a
  }
}

export async function federatedSearch(
  fetchFn: GuardedFetch,
  query: string,
  options: {
    portals?: DataPortal[]
    rowsPerPortal?: number
    timeoutMs?: number
    concurrency?: number
  } = {},
): Promise<FederatedSearch> {
  const portals = options.portals ?? activePortals()
  const rows = options.rowsPerPortal ?? 10
  const timeoutMs = options.timeoutMs ?? PORTAL_TIMEOUT_MS
  const concurrency = options.concurrency ?? MAX_CONCURRENCY

  const health: PortalHealth[] = []
  const collected: CkanDataset[] = []

  const outcomes = await mapWithLimit(portals, concurrency, async (portal) => {
    const started = Date.now()
    try {
      const result = await withDeadline(
        searchPortal(fetchFn, portal, query, rows),
        timeoutMs,
        portal.key,
      )
      return { portal, result, error: null as string | null, ms: Date.now() - started }
    } catch (err) {
      return {
        portal,
        result: null,
        error: err instanceof Error ? err.message : String(err),
        ms: Date.now() - started,
      }
    }
  })

  for (const o of outcomes) {
    if (o.result) {
      collected.push(...o.result.datasets)
      health.push({
        portalKey: o.portal.key,
        portalName: o.portal.name,
        country: o.portal.country,
        status: o.result.datasets.length > 0 ? 'ok' : 'empty',
        count: o.result.datasets.length,
        total: o.result.total,
        error: null,
        ms: o.ms,
      })
    } else {
      health.push({
        portalKey: o.portal.key,
        portalName: o.portal.name,
        country: o.portal.country,
        status: 'failed',
        count: 0,
        total: 0,
        error: o.error,
        ms: o.ms,
      })
    }
  }

  const pick = preferOrigin(portals)
  const byIdentity = new Map<string, CkanDataset>()
  for (const d of collected) {
    const key = crossPortalKey(d)
    const existing = byIdentity.get(key)
    byIdentity.set(key, existing ? pick(existing, d) : d)
  }
  const datasets = [...byIdentity.values()].sort((a, b) => {
    const at = a.modifiedAt ? Date.parse(a.modifiedAt) : -Infinity
    const bt = b.modifiedAt ? Date.parse(b.modifiedAt) : -Infinity
    if (at !== bt) return bt - at
    return a.title.localeCompare(b.title)
  })

  return {
    query: query.trim(),
    datasets,
    duplicatesRemoved: collected.length - datasets.length,
    health,
    summary: {
      portalsQueried: portals.length,
      portalsOk: health.filter((h) => h.status === 'ok').length,
      portalsEmpty: health.filter((h) => h.status === 'empty').length,
      portalsFailed: health.filter((h) => h.status === 'failed').length,
      matchesAcrossPortals: health.reduce((n, h) => n + h.total, 0),
      publishers: new Set(datasets.map((d) => d.organization).filter(Boolean)).size,
      countries: new Set(datasets.map((d) => d.country)).size,
    },
  }
}

export interface FederationReach {
  portals: number
  /** Portals that are not re-publications of another portal we already query. */
  independentPortals: number
  /** Portals that actually answered a measurement request. */
  measured: number
  /** Publishers — organizations inside the portals. Measured, never estimated. */
  publishers: number
  /** Datasets reachable. A work, not a publisher; reported separately for that reason. */
  datasets: number
  measurements: PortalMeasurement[]
}

/**
 * Measure the federation.
 *
 * This is what makes the reach figure auditable rather than advertised: the
 * number is whatever the portals themselves reported when last asked, and a
 * portal that did not answer contributes nothing instead of an estimate. Run it
 * from the reach script; it is deliberately not called on a page render, since
 * it costs three requests per portal.
 */
export async function measureFederation(
  fetchFn: GuardedFetch,
  portals = activePortals(),
  concurrency = MAX_CONCURRENCY,
): Promise<FederationReach> {
  const origins = independentPortals(portals)
  const measurements = await mapWithLimit(origins, concurrency, (portal) =>
    withDeadline(measurePortal(fetchFn, portal), PORTAL_TIMEOUT_MS * 2, portal.key).catch(
      (): PortalMeasurement => ({
        portalKey: portal.key,
        datasets: null,
        organizations: null,
        ckanVersion: null,
        measuredAt: new Date().toISOString(),
      }),
    ),
  )

  return {
    portals: portals.length,
    independentPortals: origins.length,
    measured: measurements.filter((m) => m.datasets !== null || m.organizations !== null).length,
    publishers: measurements.reduce((n, m) => n + (m.organizations ?? 0), 0),
    datasets: measurements.reduce((n, m) => n + (m.datasets ?? 0), 0),
    measurements,
  }
}

/** Every host the federation may contact. */
export const CKAN_HOSTS = portalHosts(PORTALS)
