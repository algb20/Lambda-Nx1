import { SourceUnavailableError } from '../../fetch-guard'
import type { DataPortal } from './portals'

/**
 * Our own client for the CKAN Action API.
 *
 * Deliberately small and deliberately strict. CKAN is a wide API; we use three
 * actions and nothing else, because every additional action is another shape to
 * keep honest across thirty different deployments running six different CKAN
 * versions:
 *
 *   - `package_search`      — the search itself, and the dataset *count*.
 *   - `organization_list`   — the publishers inside a portal.
 *   - `status_show`         — a cheap liveness probe that returns the version.
 *
 * ## Why nothing here defaults
 *
 * A CKAN record may omit almost any field, and the temptation is to fill the
 * gaps: an untitled dataset gets its `name`, a dataset with no modification
 * date gets "now", an unlicensed dataset gets the portal's licence. Each of
 * those is a small invention, and the invented value is indistinguishable from
 * a measured one three layers later. So a missing field stays `null` and the
 * interface says "not stated". The one exception is `title`, which falls back
 * to the URL slug because CKAN guarantees `name` and a dataset with no display
 * text at all cannot be rendered — and even that is marked.
 */

export type GuardedFetch = (url: string, init?: RequestInit) => Promise<Response>

/** A dataset, normalized across CKAN versions. */
export interface CkanDataset {
  /** Stable within a portal; not globally unique, so always paired with it. */
  id: string
  /** The URL slug. CKAN guarantees it. */
  name: string
  title: string
  /** True when `title` had to fall back to the slug — never silently. */
  titleFromSlug: boolean
  notes: string | null
  /** The organization that owns it — the actual *publisher*. */
  organization: string | null
  organizationId: string | null
  /**
   * The dataset's own licence, not the portal's. Null means the record did not
   * state one, which is a finding rather than a default.
   */
  licenceId: string | null
  licenceTitle: string | null
  /** ISO 8601, or null if the portal published no modification time. */
  modifiedAt: string | null
  tags: string[]
  /** Distribution formats present (CSV, GeoJSON, API…), upper-cased, deduped. */
  formats: string[]
  resourceCount: number
  /** A human-openable page on the portal. */
  url: string
  portalKey: string
  portalName: string
  country: string
}

export interface CkanSearchResult {
  portalKey: string
  /** The portal's own total for the query — its figure, not our estimate. */
  total: number
  datasets: CkanDataset[]
}

/** What a portal reported about itself. Every field is measured or null. */
export interface PortalMeasurement {
  portalKey: string
  /** Datasets the portal reports holding. Null when it would not say. */
  datasets: number | null
  /** Organizations — the publishers inside it. Null when it would not say. */
  organizations: number | null
  /** The CKAN version it runs, when `status_show` is exposed. */
  ckanVersion: string | null
  measuredAt: string
}

interface CkanEnvelope<T> {
  success?: boolean
  result?: T
  error?: { message?: string; __type?: string }
}

interface RawPackage {
  id?: string
  name?: string
  title?: string
  notes?: string | null
  license_id?: string | null
  license_title?: string | null
  metadata_modified?: string | null
  num_resources?: number
  organization?: { name?: string; title?: string; id?: string } | null
  tags?: Array<{ name?: string; display_name?: string }>
  resources?: Array<{ format?: string | null }>
}

interface RawSearch {
  count?: number
  results?: RawPackage[]
}

/**
 * CKAN answers `200` with `{"success": false, "error": {...}}` for a rejected
 * query. Treating that as an empty result set is the exact failure this engine
 * refuses elsewhere — a portal that has stopped accepting our queries would
 * report healthy and contribute nothing forever.
 */
function unwrap<T>(portalKey: string, body: unknown): T {
  const env = body as CkanEnvelope<T> | null
  if (!env || typeof env !== 'object') {
    throw new SourceUnavailableError(`ckan:${portalKey}`, 200, 'response was not a CKAN envelope')
  }
  if (env.success === false || env.result === undefined) {
    const detail = env.error?.message ?? env.error?.__type ?? 'CKAN reported failure'
    throw new SourceUnavailableError(`ckan:${portalKey}`, 200, detail)
  }
  return env.result
}

async function action<T>(
  fetchFn: GuardedFetch,
  portal: DataPortal,
  name: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${portal.base.replace(/\/+$/, '')}/api/3/action/${name}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))

  let res: Response
  try {
    res = await fetchFn(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (err) {
    // A transport failure is not an empty catalogue. Naming the portal matters:
    // with thirty of them, "fetch failed" tells an operator nothing.
    throw new SourceUnavailableError(
      `ckan:${portal.key}`,
      null,
      err instanceof Error ? err.message : 'request failed',
    )
  }
  if (!res.ok) throw new SourceUnavailableError(`ckan:${portal.key}`, res.status)

  let body: unknown
  try {
    body = await res.json()
  } catch {
    // Portals behind a login wall or a CDN error page answer 200 with HTML.
    throw new SourceUnavailableError(`ckan:${portal.key}`, res.status, 'response was not JSON')
  }
  return unwrap<T>(portal.key, body)
}

/** A dataset's page on its own portal — where a reader goes to check us. */
function datasetUrl(portal: DataPortal, slug: string): string {
  return `${portal.base.replace(/\/+$/, '')}/dataset/${encodeURIComponent(slug)}`
}

/**
 * Only accept a timestamp CKAN actually parsed as one.
 *
 * Portals emit `metadata_modified` in several shapes, and a handful emit the
 * empty string. `Date.parse` of the empty string is NaN, which would become
 * `Invalid Date` and then the string "Invalid Date" in the interface.
 */
function isoOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = Date.parse(raw)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString()
}

function normalize(portal: DataPortal, pkg: RawPackage): CkanDataset | null {
  const name = typeof pkg.name === 'string' ? pkg.name.trim() : ''
  // Without a slug there is no page to link to, and a finding nobody can check
  // is not a finding. Dropping it is correct; inventing a URL is not.
  if (!name) return null

  const rawTitle = typeof pkg.title === 'string' ? pkg.title.trim() : ''
  const formats = [
    ...new Set(
      (pkg.resources ?? [])
        .map((r) => (typeof r.format === 'string' ? r.format.trim().toUpperCase() : ''))
        .filter(Boolean),
    ),
  ].sort()

  return {
    id: typeof pkg.id === 'string' && pkg.id ? pkg.id : name,
    name,
    title: rawTitle || name.replace(/[-_]+/g, ' '),
    titleFromSlug: rawTitle === '',
    notes: typeof pkg.notes === 'string' && pkg.notes.trim() ? pkg.notes.trim() : null,
    organization: pkg.organization?.title?.trim() || pkg.organization?.name?.trim() || null,
    organizationId: pkg.organization?.id ?? null,
    licenceId: typeof pkg.license_id === 'string' && pkg.license_id ? pkg.license_id : null,
    licenceTitle:
      typeof pkg.license_title === 'string' && pkg.license_title.trim()
        ? pkg.license_title.trim()
        : null,
    modifiedAt: isoOrNull(pkg.metadata_modified),
    tags: [
      ...new Set(
        (pkg.tags ?? [])
          .map((t) => (t.display_name ?? t.name ?? '').trim())
          .filter(Boolean),
      ),
    ],
    formats,
    resourceCount:
      typeof pkg.num_resources === 'number' ? pkg.num_resources : (pkg.resources?.length ?? 0),
    url: datasetUrl(portal, name),
    portalKey: portal.key,
    portalName: portal.name,
    country: portal.country,
  }
}

/** CKAN rejects very large `rows`; 50 is inside every deployment's limit. */
export const MAX_ROWS = 50

export async function searchPortal(
  fetchFn: GuardedFetch,
  portal: DataPortal,
  query: string,
  rows = 10,
): Promise<CkanSearchResult> {
  const q = query.trim()
  // A blank query against `package_search` returns the portal's entire front
  // page, which is not a search result and would flood a federated sweep.
  if (!q) return { portalKey: portal.key, total: 0, datasets: [] }

  const raw = await action<RawSearch>(fetchFn, portal, 'package_search', {
    q,
    rows: Math.max(1, Math.min(MAX_ROWS, rows)),
  })

  const datasets = (raw.results ?? [])
    .map((pkg) => normalize(portal, pkg))
    .filter((d): d is CkanDataset => d !== null)

  return {
    portalKey: portal.key,
    total: typeof raw.count === 'number' ? raw.count : datasets.length,
    datasets,
  }
}

/**
 * Ask a portal how big it is.
 *
 * Three calls, each allowed to fail on its own: a portal that exposes
 * `package_search` but hides `status_show` is common, and losing the dataset
 * count because the version probe 404'd would be absurd. What cannot be
 * measured stays null — the registry's whole point is that reach is measured,
 * never estimated.
 */
export async function measurePortal(
  fetchFn: GuardedFetch,
  portal: DataPortal,
): Promise<PortalMeasurement> {
  const measuredAt = new Date().toISOString()

  const datasets = await action<RawSearch>(fetchFn, portal, 'package_search', { rows: 0 })
    .then((r) => (typeof r.count === 'number' ? r.count : null))
    .catch(() => null)

  const organizations = await action<string[]>(fetchFn, portal, 'organization_list')
    .then((r) => (Array.isArray(r) ? r.length : null))
    .catch(() => null)

  const ckanVersion = await action<{ ckan_version?: string }>(fetchFn, portal, 'status_show')
    .then((r) => (typeof r.ckan_version === 'string' ? r.ckan_version : null))
    .catch(() => null)

  return { portalKey: portal.key, datasets, organizations, ckanVersion, measuredAt }
}
