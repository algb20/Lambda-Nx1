import { describe, expect, it } from 'vitest'
import { explainFederation, investigateOpenData, openDataCoverage } from './open-data'
import type { FederatedSearch } from '../engine/registries/ckan'

/**
 * The explanation is the deliverable here.
 *
 * Every comparable platform renders "no results" identically whether it looked
 * and found nothing or could not look at all. For a catalogue federation that
 * distinction decides whether an analyst writes "no such record exists" into a
 * report — so it is tested as behaviour, not left to the interface.
 */
function result(over: Partial<FederatedSearch['summary']> = {}, over2: Partial<FederatedSearch> = {}): FederatedSearch {
  return {
    query: 'flood',
    datasets: [],
    duplicatesRemoved: 0,
    health: [],
    summary: {
      portalsQueried: 10,
      portalsOk: 0,
      portalsEmpty: 10,
      portalsFailed: 0,
      matchesAcrossPortals: 0,
      publishers: 0,
      countries: 0,
      ...over,
    },
    ...over2,
  }
}

const dataset = {
  id: 'a',
  name: 'flood-risk-map',
  title: 'Flood Risk Map',
  titleFromSlug: false,
  notes: null,
  organization: 'Environment Agency',
  organizationId: 'org-1',
  licenceId: 'cc-by',
  licenceTitle: 'CC-BY',
  modifiedAt: '2026-03-04T10:00:00.000Z',
  tags: [],
  formats: ['CSV'],
  resourceCount: 1,
  url: 'https://portal.example/dataset/flood-risk-map',
  portalKey: 'a',
  portalName: 'Portal A',
  country: 'ZZ',
}

describe('explaining an open-data search', () => {
  it('calls a total outage an outage, never an absence of records', () => {
    const text = explainFederation(result({ portalsFailed: 10, portalsEmpty: 0 }), 10)
    expect(text).toMatch(/outage on our side/)
    expect(text).toMatch(/not evidence that no such record exists/)
  })

  it('calls a complete, empty search a real finding', () => {
    const text = explainFederation(result(), 10)
    expect(text).toMatch(/Every portal answered/)
    expect(text).toMatch(/real finding/)
  })

  it('refuses to call a partial search a finding', () => {
    const text = explainFederation(result({ portalsEmpty: 7, portalsFailed: 3 }), 10)
    expect(text).toMatch(/3 of 10 could not be reached/)
    expect(text).toMatch(/incomplete/)
    expect(text).not.toMatch(/real finding/)
  })

  it('separates the haystack from what came back', () => {
    const text = explainFederation(
      result(
        { portalsOk: 2, portalsEmpty: 8, matchesAcrossPortals: 41_300, publishers: 1 },
        { datasets: [dataset] },
      ),
      10,
    )
    expect(text).toMatch(/^1 dataset from 1 publisher across 2 catalogues\./)
    expect(text).toMatch(/41,300 matches in total/)
  })

  it('says when a republished copy was merged away, rather than silently dropping it', () => {
    const text = explainFederation(
      result({ portalsOk: 2, portalsEmpty: 8, publishers: 1 }, { datasets: [dataset], duplicatesRemoved: 1 }),
      10,
    )
    expect(text).toMatch(/1 republished copy was merged into the originating catalogue/)
  })

  it('warns that coverage is partial even when it did find something', () => {
    const text = explainFederation(
      result({ portalsOk: 1, portalsEmpty: 6, portalsFailed: 3, publishers: 1 }, { datasets: [dataset] }),
      10,
    )
    expect(text).toMatch(/3 portals did not answer, so coverage is partial/)
  })
})

describe('the open-data gateway', () => {
  it('refuses a term too short to mean anything, before touching the network', async () => {
    await expect(investigateOpenData('ai')).rejects.toThrow(/at least three characters/)
  })

  it('can state its coverage without querying anything', () => {
    const coverage = openDataCoverage()
    expect(coverage.portals).toBeGreaterThan(5)
    expect(coverage.independentPortals).toBeGreaterThan(0)
    expect(coverage.independentPortals).toBeLessThanOrEqual(coverage.portals)
    expect(coverage.countries.length).toBeGreaterThan(5)
  })
})
