import { describe, it, expect } from 'vitest'
import {
  CATALOG,
  activeSources,
  catalogHosts,
  catalogSummary,
  coverageReport,
  independentCoverage,
  usableCatalog,
  catalogAttributions,
  SOURCE_FAMILIES,
  livePublisherReach,
  plannedPublisherReach,
} from './index'
import { independenceGroup, sourceHost } from './types'
import { licenceProblem, partitionByLicence, LAMBDA_USAGE, nonCommercial, needsAgreement, PUBLIC_DOMAIN } from './licence'

/**
 * The catalogue is data, so its failure modes are data failures: a duplicate
 * key that silently shadows a source, a licence transcribed in the permissive
 * direction, a rating that flatters an aggregator, an independence group that
 * lets one wire pose as a consensus.
 *
 * None of those throw. All of them corrupt the confidence numbers the whole
 * product rests on, which is why they are checked here rather than trusted.
 */
describe('catalogue integrity', () => {
  it('has no duplicate keys', () => {
    // A duplicate does not error — the second entry simply shadows the first,
    // and the source that vanished is the one nobody notices missing.
    const seen = new Map<string, number>()
    for (const s of CATALOG) seen.set(s.key, (seen.get(s.key) ?? 0) + 1)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
    expect(dupes).toEqual([])
  })

  it('gives every source a resolvable https host', () => {
    for (const s of CATALOG) {
      expect(sourceHost(s), s.key).not.toBe('')
      expect(s.url.startsWith('https://'), `${s.key}: ${s.url}`).toBe(true)
    }
  })

  it('gives every source a publisher, a licence and a rate limit', () => {
    for (const s of CATALOG) {
      expect(s.publisher.length, s.key).toBeGreaterThan(2)
      expect(s.licence.id.length, s.key).toBeGreaterThan(0)
      // Zero would mean "hammer freely", which is how a provider bans us.
      expect(s.minIntervalSec, s.key).toBeGreaterThan(0)
    }
  })

  it('declares at least one topic per source', () => {
    for (const s of CATALOG) expect(s.topics.length, s.key).toBeGreaterThan(0)
  })

  it('requires a key variable for every source that is not keyless', () => {
    // A keyed source with no declared variable can never be configured, so it
    // would sit in the catalogue looking like coverage and never run.
    for (const s of CATALOG.filter((x) => !x.keyless)) {
      expect(s.keyEnv, s.key).toBeTruthy()
    }
  })

  it('is overwhelmingly keyless, which is the charter position', () => {
    const keyless = CATALOG.filter((s) => s.keyless).length
    expect(keyless / CATALOG.length).toBeGreaterThan(0.9)
  })
})

describe('Admiralty ratings are assigned by who publishes, not by convenience', () => {
  it('rates aggregators no higher than C', () => {
    // An index over everyone else's reporting is breadth, never authority.
    for (const key of ['afp_via_gdelt', 'wikipedia_current']) {
      const s = CATALOG.find((x) => x.key === key)
      expect(s, key).toBeDefined()
      expect(['C', 'D', 'E', 'F'], key).toContain(s!.admiralty)
    }
  })

  it('rates preprints below peer-reviewed journals', () => {
    const arxiv = CATALOG.find((s) => s.key === 'arxiv_cs')!
    const nature = CATALOG.find((s) => s.key === 'nature_news')!
    expect(arxiv.admiralty > nature.admiralty).toBe(true) // 'C' > 'A'
  })

  it('rates official instrument publishers as A', () => {
    for (const key of ['usgs_quakes_hour', 'nws_alerts', 'cisa_kev', 'who_don']) {
      expect(CATALOG.find((s) => s.key === key)?.admiralty, key).toBe('A')
    }
  })
})

describe('independence groups', () => {
  it('defaults a source to its own group', () => {
    const solo = CATALOG.find((s) => !s.independence)!
    expect(independenceGroup(solo)).toBe(solo.key)
  })

  it('groups feeds that share one upstream', () => {
    // The three USGS quake feeds are one seismic network, not three.
    const usgs = CATALOG.filter((s) => s.key.startsWith('usgs_quakes'))
    expect(usgs.length).toBeGreaterThan(1)
    expect(new Set(usgs.map(independenceGroup)).size).toBe(1)
  })

  it('keeps genuinely separate networks separate', () => {
    // USGS and EMSC solve independently. If they shared a group, their
    // agreement — the most valuable corroboration in seismology — would count
    // for nothing.
    const usgs = CATALOG.find((s) => s.key === 'usgs_quakes_hour')!
    const emsc = CATALOG.find((s) => s.key === 'emsc_quakes')!
    expect(independenceGroup(usgs)).not.toBe(independenceGroup(emsc))
  })

  it('counts corroboration by origin, not by outlet', () => {
    // The number that belongs in a confidence score.
    const bySource = CATALOG.filter((s) => s.topics.includes('earthquake')).length
    const byOrigin = independentCoverage('earthquake')
    expect(byOrigin).toBeLessThan(bySource)
    expect(byOrigin).toBeGreaterThan(1)
  })
})

describe('the licence registry refuses what it must', () => {
  it('states Lambda is commercial, storing and redistributing', () => {
    // A permissive posture here would let every source through and turn this
    // registry into paperwork.
    expect(LAMBDA_USAGE).toEqual({ commercial: true, storing: true, redistributing: true })
  })

  it('rejects a non-commercial licence for this product', () => {
    expect(licenceProblem(nonCommercial('Research use only'))).toBe('commercial')
  })

  it('rejects a source needing a prior agreement', () => {
    expect(licenceProblem(needsAgreement('OpenSky', 'https://opensky-network.org/about/terms-of-use'))).toBe(
      'commercial',
    )
  })

  it('accepts public-domain government work', () => {
    expect(licenceProblem(PUBLIC_DOMAIN)).toBeNull()
  })

  it('returns the excluded sources with reasons rather than dropping them', () => {
    // A source we cannot use is a real fact about our coverage: somebody should
    // be able to see that a licence, not a bug, is why a region is thin.
    const blocked = {
      ...CATALOG[0],
      key: 'blocked_example',
      licence: nonCommercial('Academic use only', 'https://example.org/terms'),
    }
    const { usable, excluded } = partitionByLicence([...CATALOG, blocked])
    expect(usable.find((s) => s.key === 'blocked_example')).toBeUndefined()

    const reason = excluded.find((e) => e.source.key === 'blocked_example')?.reason
    expect(reason).toContain('commercial')
    // The terms URL travels with the refusal, so the remedy is one click away.
    expect(reason).toContain('example.org/terms')
  })

  it('actually excludes a real source whose terms we do not satisfy', () => {
    // OpenSky is genuinely useful aviation data and its terms require a prior
    // agreement for commercial REST use. It stays in the catalogue so the gap
    // and its remedy are both recorded — and it stays out of the build.
    const { usable, excluded } = usableCatalog()
    expect(usable.find((s) => s.key === 'opensky_states')).toBeUndefined()
    const opensky = excluded.find((e) => e.source.key === 'opensky_states')
    expect(opensky?.reason).toContain('opensky-network.org')
  })

  it('lets nothing unusable into the active set', () => {
    for (const s of activeSources()) expect(licenceProblem(s.licence), s.key).toBeNull()
  })

  it('collects the attribution lines we are obliged to show', () => {
    const lines = catalogAttributions()
    expect(lines.length).toBeGreaterThan(5)
    // An obligation nobody can see is an obligation being breached.
    expect(lines.some((l) => l.includes('OCHA') || l.includes('EMSC'))).toBe(true)
  })
})

describe('active sources', () => {
  it('skips a keyed source when its variable is unset', () => {
    // Otherwise it fails every request and reports as a provider outage —
    // hiding a configuration gap behind a health alarm.
    const keyed = CATALOG.filter((s) => !s.keyless)
    const active = activeSources()
    for (const s of keyed) {
      if (!process.env[s.keyEnv!]) expect(active.find((a) => a.key === s.key), s.key).toBeUndefined()
    }
  })

  it('skips sources explicitly disabled', () => {
    const disabled = CATALOG.filter((s) => s.enabled === false)
    expect(disabled.length).toBeGreaterThan(0)
    for (const s of disabled) expect(activeSources().find((a) => a.key === s.key), s.key).toBeUndefined()
  })
})

describe('coverage reporting', () => {
  it('sorts the thinnest coverage first, because that is the blind spot', () => {
    const report = coverageReport()
    expect(report.length).toBeGreaterThan(10)
    for (let i = 1; i < report.length; i++) {
      expect(report[i].independent).toBeGreaterThanOrEqual(report[i - 1].independent)
    }
  })

  it('never reports more independent origins than sources', () => {
    for (const row of coverageReport()) {
      expect(row.independent, row.topic).toBeLessThanOrEqual(row.sources)
    }
  })
})

describe('catalogue scale', () => {
  it('reads from many distinct hosts', () => {
    // One host serving everything would mean a single point of failure
    // wearing the costume of breadth.
    expect(catalogHosts().length).toBeGreaterThan(30)
  })

  it('summarises itself honestly', () => {
    const s = catalogSummary()
    expect(s.integrations.total).toBe(CATALOG.length)
    expect(s.integrations.active).toBeLessThanOrEqual(s.integrations.usable)
    expect(s.integrations.usable).toBeLessThanOrEqual(s.integrations.total)
    expect(s.independentOrigins).toBeLessThanOrEqual(s.integrations.total)
    expect(s.disciplines).toBeGreaterThanOrEqual(5)
  })

  it('never exposes one field that conflates integrations with reach', () => {
    // The whole point of the shape: a caller cannot accidentally print
    // "1,000,000 sources" from a number that counts providers we built.
    const s = catalogSummary() as Record<string, unknown>
    expect(s.sources).toBeUndefined()
    expect(s.total).toBeUndefined()
  })

  it('keeps reach far above integrations and origins far below', () => {
    const s = catalogSummary()
    expect(s.reach.live).toBeGreaterThan(s.integrations.total)
    expect(s.independentOrigins).toBeLessThanOrEqual(s.integrations.total)
  })
})

/**
 * Source families are where a competitor's "one million sources" figure comes
 * from, and where ours does too. The difference has to be that ours is
 * auditable: every reach estimate names the provider's own published basis, so
 * a reader can check it instead of believing it.
 */
describe('source families', () => {
  it('gives every family an auditable basis for its reach', () => {
    for (const f of SOURCE_FAMILIES) {
      expect(f.publishers, f.key).toBeGreaterThan(0)
      // A reach number nobody can check is marketing.
      expect(f.basis.length, f.key).toBeGreaterThan(40)
      expect(f.endpoint.startsWith('https://'), f.key).toBe(true)
    }
  })

  it('marks each family live or planned, and never overstates the live reach', () => {
    const live = SOURCE_FAMILIES.filter((f) => f.status === 'live')
    expect(live.length).toBeGreaterThan(0)
    expect(livePublisherReach()).toBeLessThan(plannedPublisherReach())
  })

  it('reaches beyond a million publishers once the planned families land', () => {
    // The standing target. Stated as reach, which is what it is.
    expect(plannedPublisherReach()).toBeGreaterThan(1_000_000)
  })

  it('carries a licence on every family, checked by the same registry', () => {
    // A family is a source too: reach does not exempt it from the terms.
    for (const f of SOURCE_FAMILIES) expect(f.licence.id.length, f.key).toBeGreaterThan(0)
  })

  it('flags share-alike families, which carry obligations onto derived data', () => {
    // ODbL and CC-BY-SA are usable but not free of consequence, and a note is
    // what stops that consequence being discovered after shipping.
    const shareAlike = SOURCE_FAMILIES.filter((f) => f.licence.id.includes('SA') || f.licence.id.includes('ODbL'))
    for (const f of shareAlike) expect(f.note, f.key).toBeTruthy()
  })
})
