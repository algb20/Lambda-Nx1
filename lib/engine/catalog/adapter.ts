import type { Evidence, Source, SourceContext } from '../types'
import { parseFeed } from '../feedxml'
import { publicationTime } from '../observed'
import type { CatalogSource } from './types'

/**
 * One adapter, every catalogue source.
 *
 * The engine's per-source modules exist for sources with real logic — a WHOIS
 * pivot, a certificate-log query, a chain scan. Everything else is a URL that
 * returns one of four shapes we already know how to read, and writing those by
 * hand is what caps a platform at a few dozen sources. This function turns a
 * catalogue record into a working `Source`, so adding a feed costs a record.
 *
 * Three rules hold for every source it produces, and they are the reason this
 * is a shared adapter rather than a code generator:
 *
 *  1. **The rating comes from the catalogue, not the response.** A source is
 *     graded by who publishes it, decided before any request is made. Nothing
 *     a provider returns can promote it.
 *  2. **Nothing is invented.** A record with no usable title is dropped rather
 *     than given a placeholder; a missing timestamp stays missing rather than
 *     defaulting to now, which would make stale data look live.
 *  3. **Only what the feed published is kept.** The link is carried; the page
 *     behind it is never fetched. A syndication feed licenses the headline, the
 *     summary and the link — not the article — and the difference between
 *     reading a feed and crawling a site is the difference between a licence we
 *     have and one we do not.
 */

/** Follow a dotted path, tolerating array indices: `geometry.0.date`. */
function dig(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined
  let current = value
  for (const part of path.split('.')) {
    if (current == null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** GeoJSON, or a JSON payload shaped like it. */
function fromGeoJson(source: CatalogSource, body: unknown, retrievedAt: string): Evidence[] {
  const features = (dig(body, 'features') ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(features)) return []

  return features.flatMap((feature) => {
    const props = (feature.properties ?? {}) as Record<string, unknown>
    const claim = str(props.title) ?? str(props.place) ?? str(props.headline) ?? str(props.name)
    if (!claim) return []

    const coords = dig(feature, 'geometry.coordinates')
    const [lon, lat] = Array.isArray(coords) ? coords : [undefined, undefined]

    return [
      {
        claim,
        sourceKey: source.key,
        sourceUrl: str(props.url) ?? str(props.link) ?? source.url,
        retrievedAt,
        publishedAt: publicationTime(props.time ?? props.date ?? props.sent),
        admiralty: { source: source.admiralty, info: 2 },
        confidence: 'unconfirmed',
        data: {
          lat: num(lat),
          lon: num(lon),
          magnitude: num(props.mag ?? props.magnitude),
          topics: source.topics,
          publisher: source.publisher,
          independence: source.independence ?? source.key,
          raw: props,
        },
      } satisfies Evidence,
    ]
  })
}

/** Arbitrary JSON, guided by the record's `path` and `map`. */
function fromJson(source: CatalogSource, body: unknown, retrievedAt: string): Evidence[] {
  // A GeoJSON-shaped payload is read as GeoJSON even when declared `json`,
  // because several agencies serve `features` under a plain content type.
  if (!source.path && dig(body, 'features')) return fromGeoJson(source, body, retrievedAt)

  const rows = (source.path ? dig(body, source.path) : body) as unknown
  const list = Array.isArray(rows) ? rows : []
  const map = source.map ?? {}

  return list.flatMap((row) => {
    const claim =
      str(dig(row, map.title)) ??
      str(dig(row, 'title')) ??
      str(dig(row, 'name')) ??
      str(dig(row, 'headline'))
    if (!claim) return []

    return [
      {
        claim,
        sourceKey: source.key,
        sourceUrl: str(dig(row, map.url)) ?? str(dig(row, 'url')) ?? str(dig(row, 'link')) ?? source.url,
        retrievedAt,
        publishedAt: publicationTime(dig(row, map.time) ?? dig(row, 'time') ?? dig(row, 'date')),
        admiralty: { source: source.admiralty, info: 2 },
        confidence: 'unconfirmed',
        data: {
          lat: num(dig(row, map.lat)) ?? num(dig(row, 'lat')) ?? num(dig(row, 'latitude')),
          lon: num(dig(row, map.lon)) ?? num(dig(row, 'lon')) ?? num(dig(row, 'longitude')),
          magnitude: num(dig(row, map.magnitude)),
          summary: str(dig(row, map.summary)) ?? str(dig(row, 'summary')),
          topics: source.topics,
          publisher: source.publisher,
          independence: source.independence ?? source.key,
          raw: row,
        },
      } satisfies Evidence,
    ]
  })
}

/** RSS, RDF and Atom, through the parser the engine already owns. */
function fromFeed(source: CatalogSource, xml: string, retrievedAt: string): Evidence[] {
  return parseFeed(xml).flatMap((entry) => {
    if (!entry.title) return []
    return [
      {
        claim: entry.title,
        sourceKey: source.key,
        sourceUrl: entry.link ?? source.url,
        retrievedAt,
        // The feed parser already normalises `pubDate` / `updated` / `dc:date`;
        // it is re-checked here so that a feed publishing a date outside the
        // plausible range is treated exactly like a JSON source doing the same.
        publishedAt: publicationTime(entry.published),
        admiralty: { source: source.admiralty, info: 2 },
        confidence: 'unconfirmed',
        data: {
          // No coordinates: a syndication feed does not carry them, and
          // geocoding a headline would be inventing a location.
          lat: null,
          lon: null,
          summary: entry.summary,
          topics: source.topics,
          publisher: source.publisher,
          independence: source.independence ?? source.key,
        },
      } satisfies Evidence,
    ]
  })
}

/** How many items one source may contribute per run. */
const MAX_ITEMS_PER_SOURCE = 120

/**
 * Build a runnable engine source from a catalogue record.
 *
 * The returned source declares `passive: true` truthfully: it performs one
 * read-only GET against a published feed of a third-party *provider*, never
 * against an investigation subject, and the guardrail's host allowlist enforces
 * that independently of anything claimed here.
 */
export function catalogSource(entry: CatalogSource): Source {
  return {
    key: entry.key,
    capability: 'world_events',
    passive: true,
    // Declared from the record's own URL, so the guardrail's allowlist is
    // derived from the address the source will actually request. A hand-kept
    // second list would eventually disagree with the first, and the failure
    // would be either a source that cannot fetch or an allowlist wider than
    // the sources justify.
    hosts: [new URL(entry.url).hostname.toLowerCase()],
    minIntervalMs: entry.minIntervalSec * 1000,

    async run(_input, ctx: SourceContext): Promise<Evidence[]> {
      const res = await ctx.fetch(entry.url, {
        headers: {
          // Named honestly with a contact route. Providers block anonymous
          // scrapers and they are right to; a source that will not say who it
          // is has no standing to complain when it is throttled.
          'User-Agent': 'LambdaNX/1.0 (+https://github.com/algb20/Lambda-Nx1)',
          Accept:
            entry.kind === 'geojson' || entry.kind === 'json'
              ? 'application/json, application/geo+json;q=0.9, */*;q=0.5'
              : 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5',
        },
      })
      if (!res.ok) throw new Error(`${entry.key}: provider answered ${res.status}`)

      const evidence =
        entry.kind === 'geojson'
          ? fromGeoJson(entry, await res.json(), new Date().toISOString())
          : entry.kind === 'json'
            ? fromJson(entry, await res.json(), new Date().toISOString())
            : fromFeed(entry, await res.text(), new Date().toISOString())

      // A cap, not a filter: one source flooding a run would crowd out every
      // other, turning breadth into a single provider's view of the world.
      return evidence.slice(0, MAX_ITEMS_PER_SOURCE)
    },
  }
}
