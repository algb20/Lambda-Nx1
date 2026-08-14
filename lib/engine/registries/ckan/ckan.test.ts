import { describe, expect, it } from 'vitest'
import {
  PORTALS,
  activePortals,
  independentPortals,
  portalHosts,
  federatedSearch,
  measureFederation,
  searchPortal,
  measurePortal,
  type DataPortal,
  type GuardedFetch,
} from './index'
import { buildOpenDataSource } from '../../sources/opendata'
import { Registry } from '../../registry'

/**
 * A CKAN deployment in a test, answering exactly as the real ones do —
 * including the two ways they lie: `200 {"success": false}` and a `200` HTML
 * error page. Both of those were the bugs this client was written to survive,
 * so both are exercised rather than described.
 */
function stubPortal(
  responses: Record<string, unknown>,
  options: { htmlFor?: string[]; status?: number; throwFor?: string[] } = {},
): GuardedFetch {
  return async (url: string) => {
    const action = new URL(url).pathname.split('/').pop() ?? ''
    if (options.throwFor?.includes(action)) throw new Error('socket hang up')
    if (options.htmlFor?.includes(action)) {
      return new Response('<html>503 Service Unavailable</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }
    const body = responses[action]
    if (body === undefined) {
      return new Response('not found', { status: options.status ?? 404 })
    }
    return new Response(JSON.stringify(body), {
      status: options.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

const testPortal: DataPortal = {
  key: 'test_portal',
  name: 'Test Portal',
  operator: 'Test Operator',
  base: 'https://portal.example/data',
  country: 'ZZ',
  metadataLicence: {
    id: 'CC0-1.0',
    name: 'Public domain',
    commercialUse: true,
    storage: true,
    redistribute: true,
  },
}

function searchBody(results: unknown[], count = results.length) {
  return { success: true, result: { count, results } }
}

const fullPackage = {
  id: 'abc-123',
  name: 'flood-risk-map',
  title: 'Flood Risk Map',
  notes: 'National flood risk zones.',
  license_id: 'cc-by',
  license_title: 'Creative Commons Attribution',
  metadata_modified: '2026-03-04T10:00:00',
  num_resources: 3,
  organization: { id: 'org-1', name: 'env-agency', title: 'Environment Agency' },
  tags: [{ name: 'flood' }, { display_name: 'Hydrology' }, { name: 'flood' }],
  resources: [{ format: 'csv' }, { format: 'GeoJSON' }, { format: 'csv' }],
}

describe('the portal registry', () => {
  it('gives every portal a parseable API base', () => {
    for (const p of PORTALS) {
      expect(() => new URL(p.base), `${p.key} has an unparseable base`).not.toThrow()
    }
  })

  it('uses https everywhere — a catalogue read over http can be rewritten in transit', () => {
    const insecure = PORTALS.filter((p) => !p.base.startsWith('https://'))
    expect(insecure.map((p) => p.key)).toEqual([])
  })

  it('never carries a trailing slash on a base, which would double up the action path', () => {
    expect(PORTALS.filter((p) => p.base.endsWith('/')).map((p) => p.key)).toEqual([])
  })

  it('keys every portal uniquely', () => {
    expect(new Set(PORTALS.map((p) => p.key)).size).toBe(PORTALS.length)
  })

  it('explains every portal it has switched off, so nobody has to guess why', () => {
    for (const p of PORTALS.filter((x) => x.enabled === false)) {
      expect(p.note, `${p.key} is disabled with no reason given`).toBeTruthy()
    }
  })

  it('only points `harvests` at portals that exist in the registry', () => {
    const keys = new Set(PORTALS.map((p) => p.key))
    for (const p of PORTALS) {
      for (const h of p.harvests ?? []) {
        expect(keys.has(h), `${p.key} harvests unknown portal ${h}`).toBe(true)
      }
    }
  })

  it('allow-lists every portal host, including the disabled ones', () => {
    const hosts = portalHosts()
    for (const p of PORTALS) {
      expect(hosts).toContain(new URL(p.base).hostname.toLowerCase())
    }
  })

  it('drops a harvester from the independent set when its origins are present', () => {
    const origin: DataPortal = { ...testPortal, key: 'origin' }
    const harvester: DataPortal = { ...testPortal, key: 'harvester', harvests: ['origin'] }
    const independent = independentPortals([origin, harvester])
    expect(independent.map((p) => p.key)).toEqual(['origin'])
  })

  it('keeps a harvester when the portals it harvests are not being queried', () => {
    const harvester: DataPortal = { ...testPortal, key: 'harvester', harvests: ['absent'] }
    expect(independentPortals([harvester]).map((p) => p.key)).toEqual(['harvester'])
  })

  it('has portals to query', () => {
    expect(activePortals().length).toBeGreaterThan(5)
  })

  it('reaches beyond the rich world — the coverage every comparable platform is thin on', () => {
    const countries = new Set(activePortals().map((p) => p.country))
    for (const expected of ['BR', 'MX', 'CL', 'AR', 'JP']) {
      expect(countries, `no active portal for ${expected}`).toContain(expected)
    }
    // Africa is reached through the pan-African catalogue rather than per country.
    expect(activePortals().some((p) => p.key === 'africa_open_data')).toBe(true)
  })
})

describe('the CKAN client', () => {
  it('normalizes a full package without inventing anything', async () => {
    const fetchFn = stubPortal({ package_search: searchBody([fullPackage], 412) })
    const result = await searchPortal(fetchFn, testPortal, 'flood')

    expect(result.total).toBe(412)
    expect(result.datasets).toHaveLength(1)
    const d = result.datasets[0]
    expect(d.title).toBe('Flood Risk Map')
    expect(d.titleFromSlug).toBe(false)
    expect(d.organization).toBe('Environment Agency')
    expect(d.licenceId).toBe('cc-by')
    expect(d.modifiedAt).toBe('2026-03-04T10:00:00.000Z')
    expect(d.formats).toEqual(['CSV', 'GEOJSON'])
    expect(d.tags).toEqual(['flood', 'Hydrology'])
    expect(d.url).toBe('https://portal.example/data/dataset/flood-risk-map')
    expect(d.portalKey).toBe('test_portal')
  })

  it('leaves a missing licence null rather than borrowing the portal’s', async () => {
    const fetchFn = stubPortal({
      package_search: searchBody([{ name: 'unlicensed', title: 'Unlicensed' }]),
    })
    const [d] = (await searchPortal(fetchFn, testPortal, 'x')).datasets
    expect(d.licenceId).toBeNull()
    expect(d.licenceTitle).toBeNull()
  })

  it('leaves a missing modification date null rather than defaulting it to now', async () => {
    const fetchFn = stubPortal({
      package_search: searchBody([{ name: 'undated', title: 'Undated' }]),
    })
    const [d] = (await searchPortal(fetchFn, testPortal, 'x')).datasets
    expect(d.modifiedAt).toBeNull()
  })

  it('refuses an empty-string date instead of rendering “Invalid Date”', async () => {
    const fetchFn = stubPortal({
      package_search: searchBody([{ name: 'blank', metadata_modified: '' }]),
    })
    const [d] = (await searchPortal(fetchFn, testPortal, 'x')).datasets
    expect(d.modifiedAt).toBeNull()
  })

  it('marks a title it had to build from the slug', async () => {
    const fetchFn = stubPortal({ package_search: searchBody([{ name: 'air_quality-2026' }]) })
    const [d] = (await searchPortal(fetchFn, testPortal, 'x')).datasets
    expect(d.title).toBe('air quality 2026')
    expect(d.titleFromSlug).toBe(true)
  })

  it('drops a record with no slug rather than linking somewhere that does not exist', async () => {
    const fetchFn = stubPortal({
      package_search: searchBody([{ title: 'No slug' }, fullPackage]),
    })
    const result = await searchPortal(fetchFn, testPortal, 'x')
    expect(result.datasets.map((d) => d.name)).toEqual(['flood-risk-map'])
  })

  it('treats `success: false` as a failure, not as an empty catalogue', async () => {
    const fetchFn = stubPortal({
      package_search: { success: false, error: { message: 'Search index unavailable' } },
    })
    await expect(searchPortal(fetchFn, testPortal, 'x')).rejects.toThrow(
      /Search index unavailable/,
    )
  })

  it('treats a 200 HTML error page as a failure, not as an empty catalogue', async () => {
    const fetchFn = stubPortal({ package_search: {} }, { htmlFor: ['package_search'] })
    await expect(searchPortal(fetchFn, testPortal, 'x')).rejects.toThrow(/not JSON/)
  })

  it('names the portal in a transport failure — “fetch failed” tells an operator nothing', async () => {
    const fetchFn = stubPortal({}, { throwFor: ['package_search'] })
    await expect(searchPortal(fetchFn, testPortal, 'x')).rejects.toThrow(/ckan:test_portal/)
  })

  it('does not query at all for a blank term, which would return the whole front page', async () => {
    let called = false
    const fetchFn: GuardedFetch = async () => {
      called = true
      return new Response('{}')
    }
    const result = await searchPortal(fetchFn, testPortal, '   ')
    expect(called).toBe(false)
    expect(result.datasets).toEqual([])
  })

  it('caps rows at what every CKAN deployment accepts', async () => {
    let asked = ''
    const fetchFn: GuardedFetch = async (url) => {
      asked = new URL(url).searchParams.get('rows') ?? ''
      return new Response(JSON.stringify(searchBody([])))
    }
    await searchPortal(fetchFn, testPortal, 'flood', 5000)
    expect(Number(asked)).toBeLessThanOrEqual(50)
  })

  it('measures what it can and leaves the rest null instead of guessing', async () => {
    const fetchFn = stubPortal({
      package_search: searchBody([], 12_345),
      organization_list: { success: true, result: ['a', 'b', 'c'] },
      // status_show deliberately absent — common, and must not lose the counts.
    })
    const m = await measurePortal(fetchFn, testPortal)
    expect(m.datasets).toBe(12_345)
    expect(m.organizations).toBe(3)
    expect(m.ckanVersion).toBeNull()
  })
})

describe('the federation', () => {
  const portalA: DataPortal = { ...testPortal, key: 'a', base: 'https://a.example' }
  const portalB: DataPortal = { ...testPortal, key: 'b', base: 'https://b.example' }

  function routed(map: Record<string, GuardedFetch>): GuardedFetch {
    return (url, init) => {
      const host = new URL(url).hostname
      const fn = map[host]
      if (!fn) throw new Error(`no stub for ${host}`)
      return fn(url, init)
    }
  }

  it('reports a dead portal as failed instead of as an empty result', async () => {
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([fullPackage]) }),
        'b.example': stubPortal({}, { throwFor: ['package_search'] }),
      }),
      'flood',
      { portals: [portalA, portalB] },
    )

    expect(found.summary.portalsOk).toBe(1)
    expect(found.summary.portalsFailed).toBe(1)
    const dead = found.health.find((h) => h.portalKey === 'b')
    expect(dead?.status).toBe('failed')
    expect(dead?.error).toMatch(/ckan:b/)
  })

  it('separates “answered with nothing” from “did not answer”', async () => {
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([]) }),
        'b.example': stubPortal({}, { throwFor: ['package_search'] }),
      }),
      'flood',
      { portals: [portalA, portalB] },
    )
    expect(found.health.find((h) => h.portalKey === 'a')?.status).toBe('empty')
    expect(found.health.find((h) => h.portalKey === 'b')?.status).toBe('failed')
  })

  it('counts a harvested copy once, and keeps the origin’s record', async () => {
    const harvester: DataPortal = { ...portalB, harvests: ['a'] }
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([fullPackage]) }),
        'b.example': stubPortal({
          package_search: searchBody([
            { ...fullPackage, id: 'harvested-copy', title: 'Carte des risques' },
          ]),
        }),
      }),
      'flood',
      { portals: [portalA, harvester] },
    )

    expect(found.datasets).toHaveLength(1)
    expect(found.duplicatesRemoved).toBe(1)
    expect(found.datasets[0].portalKey).toBe('a')
  })

  it('keeps two genuinely different datasets that happen to share a slug', async () => {
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([fullPackage]) }),
        'b.example': stubPortal({
          package_search: searchBody([
            {
              ...fullPackage,
              organization: { id: 'org-2', name: 'stats', title: 'Statistics Office' },
            },
          ]),
        }),
      }),
      'flood',
      { portals: [portalA, portalB] },
    )
    expect(found.datasets).toHaveLength(2)
    expect(found.duplicatesRemoved).toBe(0)
  })

  it('does not let one slow portal decide the response time', async () => {
    const slow: GuardedFetch = () => new Promise(() => {})
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([fullPackage]) }),
        'b.example': slow,
      }),
      'flood',
      { portals: [portalA, portalB], timeoutMs: 50 },
    )
    expect(found.datasets).toHaveLength(1)
    expect(found.health.find((h) => h.portalKey === 'b')?.error).toMatch(/no answer within/)
  })

  it('reports the haystack and the find as different numbers', async () => {
    const found = await federatedSearch(
      routed({
        'a.example': stubPortal({ package_search: searchBody([fullPackage], 9_000) }),
        'b.example': stubPortal({ package_search: searchBody([], 4_000) }),
      }),
      'flood',
      { portals: [portalA, portalB] },
    )
    expect(found.summary.matchesAcrossPortals).toBe(13_000)
    expect(found.datasets).toHaveLength(1)
    expect(found.summary.publishers).toBe(1)
  })

  it('measures reach from what portals reported, counting nothing it could not measure', async () => {
    const reach = await measureFederation(
      routed({
        'a.example': stubPortal({
          package_search: searchBody([], 1_000),
          organization_list: { success: true, result: ['x', 'y'] },
        }),
        'b.example': stubPortal({}, { throwFor: ['package_search', 'organization_list', 'status_show'] }),
      }),
      [portalA, portalB],
    )
    expect(reach.datasets).toBe(1_000)
    expect(reach.publishers).toBe(2)
    expect(reach.measured).toBe(1)
    expect(reach.independentPortals).toBe(2)
  })
})

describe('the open-data engine source', () => {
  const portalA: DataPortal = { ...testPortal, key: 'a', base: 'https://a.example' }

  it('registers through the guardrail as a passive source', () => {
    const registry = new Registry()
    expect(() => registry.register(buildOpenDataSource())).not.toThrow()
    expect(registry.sourcesFor('open_data').map((s) => s.key)).toEqual(['ckan_federation'])
  })

  it('allow-lists every portal host, so switching a portal on needs no second edit', () => {
    const registry = new Registry()
    registry.register(buildOpenDataSource())
    for (const p of PORTALS) {
      expect(registry.guardrail.isAllowed(new URL(p.base).hostname)).toBe(true)
    }
  })

  it('states only that the record exists — never anything about its contents', async () => {
    const source = buildOpenDataSource([portalA])
    const evidence = await source.run(
      { capability: 'open_data', value: 'flood' },
      { fetch: stubPortal({ package_search: searchBody([fullPackage]) }) },
    )
    expect(evidence).toHaveLength(1)
    expect(evidence[0].claim).toContain('Environment Agency publishes')
    expect(evidence[0].claim).toContain('last updated 2026-03-04')
    expect(evidence[0].admiralty).toEqual({ source: 'A', info: 2 })
    expect(evidence[0].sourceUrl).toBe('https://a.example/dataset/flood-risk-map')
    expect(evidence[0].entity).toEqual({ type: 'organization', value: 'Environment Agency' })
  })

  it('says so plainly when a portal published no update date', async () => {
    const source = buildOpenDataSource([portalA])
    const evidence = await source.run(
      { capability: 'open_data', value: 'flood' },
      {
        fetch: stubPortal({
          package_search: searchBody([{ name: 'undated', title: 'Undated series' }]),
        }),
      },
    )
    expect(evidence[0].claim).toContain('last update not stated')
  })

  it('rates a civil-society aggregator below a government record-holder', async () => {
    const aggregator: DataPortal = { ...testPortal, key: 'africa_open_data', base: 'https://a.example' }
    const source = buildOpenDataSource([aggregator])
    const evidence = await source.run(
      { capability: 'open_data', value: 'flood' },
      { fetch: stubPortal({ package_search: searchBody([fullPackage]) }) },
    )
    expect(evidence[0].admiralty).toEqual({ source: 'B', info: 2 })
  })

  it('throws when every portal is down, rather than reporting an empty world', async () => {
    const source = buildOpenDataSource([portalA])
    await expect(
      source.run(
        { capability: 'open_data', value: 'flood' },
        { fetch: stubPortal({}, { throwFor: ['package_search'] }) },
      ),
    ).rejects.toThrow(/unreachable/)
  })

  it('declines a term too short to mean anything, without calling anyone', async () => {
    const source = buildOpenDataSource([portalA])
    let called = false
    const evidence = await source.run(
      { capability: 'open_data', value: 'ai' },
      {
        fetch: async () => {
          called = true
          return new Response('{}')
        },
      },
    )
    expect(evidence).toEqual([])
    expect(called).toBe(false)
  })
})

/**
 * Against the real portals. Off by default: this reaches thirty government
 * servers, and a test suite that does that on every run is a test suite that
 * gets disabled. Run with `RUN_LIVE=1` and open egress.
 */
describe.runIf(process.env.RUN_LIVE === '1')('CKAN federation — LIVE', () => {
  it('finds flood datasets across several national catalogues', async () => {
    const fetchFn: GuardedFetch = (url, init) => fetch(url, init)
    const found = await federatedSearch(fetchFn, 'flood', { rowsPerPortal: 5, timeoutMs: 15_000 })

    expect(found.summary.portalsOk).toBeGreaterThan(0)
    expect(found.datasets.length).toBeGreaterThan(0)
    for (const d of found.datasets) {
      expect(d.url).toMatch(/^https:\/\//)
      expect(d.portalKey).toBeTruthy()
    }
  }, 90_000)

  it('measures reach from the portals themselves', async () => {
    const fetchFn: GuardedFetch = (url, init) => fetch(url, init)
    const reach = await measureFederation(fetchFn)
    expect(reach.measured).toBeGreaterThan(0)
    expect(reach.datasets).toBeGreaterThan(0)
  }, 120_000)
})
