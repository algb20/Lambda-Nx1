import { describe, expect, it } from 'vitest'
import { buildTimeline } from '@/lib/analysis/timeline'
import {
  MAX_BRIEF_STORIES,
  assembleBrief,
  blindSpots,
  independenceTable,
  quietSources,
  toEvidence,
  worldEvidence,
} from './brief-shared'
import type { WorldEvent, WorldEventsReport } from './world-events-shared'
import type { AnalystVerdict } from '../ai/types'
import { analyseStories, clusterStories } from '../analysis/stories'

function event(over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: 'e1',
    title: 'Magnitude 7.4 earthquake strikes off Tohoku coast',
    category: 'seismic',
    categoryLabel: 'Earthquake',
    color: '#f97316',
    lat: 38.3,
    lon: 142.4,
    country: 'Japan',
    countryIso: 'JP',
    magnitude: 7.4,
    magnitudeUnit: 'Mw',
    severity: 0.98,
    alertLevel: null,
    at: '2026-08-14T11:35:00.000Z',
    observedAt: '2026-08-14T11:30:00.000Z',
    sourceKey: 'usgs_recent',
    sourceUrl: 'https://earthquake.usgs.gov/e1',
    independence: 'usgs',
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    ...over,
  }
}

function report(over: Partial<WorldEventsReport> = {}): WorldEventsReport {
  return {
    generatedAt: '2026-08-14T12:00:00.000Z',
    events: [event()],
    unplaceable: [],
    categories: [],
    regions: [],
    hotspots: [],
    timeline: buildTimeline([event()], { now: Date.parse('2026-08-14T12:00:00.000Z') }),
    sourceHealth: [
      { sourceKey: 'usgs_recent', status: 'ok', count: 1, error: null, ok: true },
      { sourceKey: 'gdacs', status: 'empty', count: 0, error: null, ok: true },
      { sourceKey: 'nws_alerts', status: 'failed', count: 0, error: 'timeout', ok: false },
    ],
    fused: [],
    fusion: { signals: 1, events: 1, corroborated: 0, contested: 0, duplicatesRemoved: 0 },
    coverage: [
      {
        region: 'africa',
        label: 'Africa',
        lat: 0,
        lon: 20,
        declared: 0,
        observed: 0,
        reports: 0,
        status: 'dark',
        explanation: 'Nothing in the catalogue covers this region, so silence says nothing.',
      },
      {
        region: 'asia-pacific',
        label: 'Asia Pacific',
        lat: 20,
        lon: 120,
        declared: 6,
        observed: 4,
        reports: 12,
        status: 'active',
        explanation: 'Well covered and reporting.',
      },
    ],
    coverageSummary: {
      dark: 1,
      thin: 0,
      quiet: 0,
      active: 1,
      trustworthyRegions: 1,
      totalRegions: 2,
    },
    summary: {
      total: 1,
      placed: 1,
      newestAt: '2026-08-14T11:35:00.000Z',
      sources: ['usgs_recent'],
      sourcesOk: 1,
      sourcesEmpty: 1,
      sourcesFailed: 1,
    },
    ...over,
  }
}

const verdict: AnalystVerdict = {
  summary: 'One measured event, from a single origin.',
  severity: 'info',
  keyPoints: [],
  nextSteps: [],
  needsVerification: [],
  confidenceCaveat: true,
  provider: 'deterministic',
  model: null,
  generatedAt: '2026-08-14T12:00:00.000Z',
  configured: true,
  reading: null,
}

describe('turning the world picture into evidence', () => {
  it('keeps the source-stated time apart from the time we read it', () => {
    // The defect this guards: collapsing the two made every item look as fresh
    // as the sweep that fetched it.
    const e = toEvidence(event())
    expect(e.publishedAt).toBe('2026-08-14T11:30:00.000Z')
    expect(e.retrievedAt).toBe('2026-08-14T11:35:00.000Z')
  })

  it('leaves publishedAt null when the source stated no time', () => {
    expect(toEvidence(event({ observedAt: null })).publishedAt).toBeNull()
  })

  it('carries the rating, the independence group and the coordinate through', () => {
    const e = toEvidence(event())
    expect(e.admiralty).toEqual({ source: 'A', info: 1 })
    const data = e.data as { independence: string | null; lat: number | null }
    expect(data.independence).toBe('usgs')
    expect(data.lat).toBe(38.3)
  })

  it('includes events with no location rather than dropping them', () => {
    // Excluding them would bias every count in the reading that follows.
    const r = report({ unplaceable: [event({ id: 'e2', lat: null, lon: null })] })
    expect(worldEvidence(r)).toHaveLength(2)
  })
})

describe('what the brief refuses to hide', () => {
  it('names the regions where an absence of events means nothing', () => {
    expect(blindSpots(report()).map((r) => r.region)).toEqual(['africa'])
  })

  it('names every feed that contributed nothing, failed or merely empty', () => {
    expect(quietSources(report()).map((s) => s.sourceKey)).toEqual(['gdacs', 'nws_alerts'])
  })

  it('builds the independence table from the report, so the brief and the map agree', () => {
    expect(independenceTable(report())).toEqual({ usgs_recent: 'usgs' })
  })
})

describe('assembling the brief', () => {
  const r = report()
  const findings = worldEvidence(r)
  const stories = clusterStories(findings, { groups: independenceTable(r) })
  const analysis = analyseStories(stories, findings.length)

  it('counts origins rather than feeds that answered', () => {
    const brief = assembleBrief(r, verdict, stories, analysis, findings)
    // Three feeds answered; one origin is behind the picture.
    expect(brief.picture.sourcesOk).toBe(1)
    expect(brief.picture.origins).toBe(1)
  })

  it('bounds the list of stories without touching the counts', () => {
    const many = Array.from({ length: MAX_BRIEF_STORIES + 5 }, (_, i) =>
      event({ id: `e${i}`, title: `Distinct incident number ${i} in a separate place` }),
    )
    const bigReport = report({ events: many })
    const bigFindings = worldEvidence(bigReport)
    const bigStories = clusterStories(bigFindings, { groups: independenceTable(bigReport) })
    const bigAnalysis = analyseStories(bigStories, bigFindings.length)
    const brief = assembleBrief(bigReport, verdict, bigStories, bigAnalysis, bigFindings)

    expect(brief.stories.length).toBeLessThanOrEqual(MAX_BRIEF_STORIES)
    // The list is bounded; the analysis behind it is not.
    expect(brief.storyAnalysis.stories).toBe(bigStories.length)
  })

  it('ships the evidence the reading was computed from, so every claim resolves', () => {
    const brief = assembleBrief(r, verdict, stories, analysis, findings)
    expect(brief.findings).toBe(findings)
  })

  it('carries the verdict, including whether a model produced it', () => {
    const brief = assembleBrief(r, verdict, stories, analysis, findings)
    expect(brief.verdict.model).toBeNull()
    expect(brief.verdict.configured).toBe(true)
  })
})
