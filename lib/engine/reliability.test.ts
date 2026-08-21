import { describe, expect, it } from 'vitest'
import {
  AVAILABILITY_FLOOR,
  DAYS_TO_DECLARE_DEAD,
  MIN_RUNS_TO_JUDGE,
  auditCatalogue,
  observedReliability,
  selfAudit,
  todayKey,
  type SourceDay,
} from './reliability'
import type { CatalogSource } from './catalog/types'
import { PUBLIC_DOMAIN } from './catalog/licence'

const TODAY = '2026-08-14'
const NOW = Date.parse(`${TODAY}T12:00:00Z`)

/** `n` days of identical observations, ending `endingDaysAgo` before today. */
function run(
  sourceKey: string,
  n: number,
  per: { ok?: number; empty?: number; failed?: number; items?: number },
  endingDaysAgo = 0,
): SourceDay[] {
  return Array.from({ length: n }, (_, i) => {
    const offset = endingDaysAgo + (n - 1 - i)
    const day = new Date(Date.parse(`${TODAY}T00:00:00Z`) - offset * 86_400_000)
      .toISOString()
      .slice(0, 10)
    return {
      sourceKey,
      day,
      ok: per.ok ?? 0,
      empty: per.empty ?? 0,
      failed: per.failed ?? 0,
      items: per.items ?? 0,
    }
  })
}

function source(over: Partial<CatalogSource> = {}): CatalogSource {
  return {
    key: 'jma_quakes',
    name: 'JMA — seismic',
    publisher: 'Japan Meteorological Agency',
    url: 'https://example.jp/feed.xml',
    kind: 'rss',
    discipline: 'geoint',
    topics: ['earthquake'],
    coverage: ['JP'],
    admiralty: 'A',
    independence: 'jma',
    licence: PUBLIC_DOMAIN,
    minIntervalSec: 300,
    keyless: true,
    ...over,
  }
}

describe('the earned record', () => {
  it('says nothing at all about a source it has barely seen', () => {
    // One bad afternoon must not cost a national agency its rating.
    const records = observedReliability(run('jma_quakes', 3, { ok: 1, items: 4 }), TODAY)
    expect(records[0].state).toBe('unproven')
    expect(records[0].reason).toMatch(/too few to judge/)
  })

  it('calls a source healthy when it answers and carries something', () => {
    const records = observedReliability(
      run('jma_quakes', MIN_RUNS_TO_JUDGE, { ok: 1, items: 6 }),
      TODAY,
    )
    expect(records[0].state).toBe('healthy')
    expect(records[0].availability).toBe(1)
    expect(records[0].yield).toBe(1)
    expect(records[0].itemsPerRun).toBe(6)
  })

  it('keeps availability and yield apart, because they fail independently', () => {
    // The bug this guards: a feed answering 200 with nothing showed green while
    // the globe was a bare sphere.
    const records = observedReliability(
      run('quiet_feed', MIN_RUNS_TO_JUDGE, { empty: 1, items: 0 }),
      TODAY,
    )
    expect(records[0].availability).toBe(1)
    expect(records[0].yield).toBe(0)
    expect(records[0].state).not.toBe('healthy')
  })

  it('calls a reachable feed that almost never carries anything silent, not healthy', () => {
    // Silent is the state between healthy and dead: it *does* still produce, so
    // it is not dead, and it produces so rarely that calling it healthy would
    // hide a coverage gap behind a green light.
    const records = observedReliability(
      [
        ...run('quiet_feed', MIN_RUNS_TO_JUDGE, { empty: 1 }),
        ...run('quiet_feed', 1, { ok: 1, items: 1 }, 3),
      ],
      TODAY,
    )
    expect(records[0].availability).toBe(1)
    expect(records[0].state).toBe('silent')
    expect(records[0].reason).toMatch(/coverage gap and never health/)
  })

  it('calls a source that has never produced anything in a month of runs dead', () => {
    const records = observedReliability(
      run('never_worked', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 5),
      TODAY,
    )
    expect(records[0].state).toBe('dead')
    expect(records[0].lastProductiveDay).toBeNull()
    expect(records[0].reason).toMatch(/never been a source/)
  })

  it('calls an unreachable feed degraded, and names it a transport problem', () => {
    const records = observedReliability(
      [
        ...run('flaky', 10, { ok: 1, items: 3 }),
        ...run('flaky', 10, { failed: 1 }, 10),
      ],
      TODAY,
    )
    expect(records[0].availability).toBeLessThan(AVAILABILITY_FLOOR)
    expect(records[0].state).toBe('degraded')
    expect(records[0].reason).toMatch(/transport problem/)
  })

  it('calls a long-silent source dead, and says when it last carried anything', () => {
    const records = observedReliability(
      run('retired', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 5),
      TODAY,
    )
    expect(records[0].state).toBe('dead')
    expect(records[0].quietDays).toBeGreaterThanOrEqual(DAYS_TO_DECLARE_DEAD)
  })

  it('does not condemn a weekly feed for being weekly', () => {
    // The Smithsonian volcanism report and several statistics releases publish
    // once a week; a shorter threshold would kill them for working correctly.
    const weekly = [
      ...run('weekly', MIN_RUNS_TO_JUDGE, { empty: 1 }, 8),
      ...run('weekly', 1, { ok: 1, items: 5 }, 6),
    ]
    expect(observedReliability(weekly, TODAY)[0].state).not.toBe('dead')
  })

  it('measures silence from today, not from the last row it happens to hold', () => {
    // A source that fell out of the sweep is as invisible as one that stopped
    // producing; treating the gap as zero would preserve its record forever.
    const stale = run('forgotten', MIN_RUNS_TO_JUDGE, { ok: 1, items: 2 }, 60)
    const record = observedReliability(stale, TODAY)[0]
    expect(record.quietDays).toBeGreaterThan(DAYS_TO_DECLARE_DEAD)
    expect(record.state).toBe('dead')
  })

  it('orders the least available first, because that is what needs reading', () => {
    const records = observedReliability(
      [
        ...run('good', MIN_RUNS_TO_JUDGE, { ok: 1, items: 3 }),
        ...run('bad', MIN_RUNS_TO_JUDGE, { failed: 1 }),
      ],
      TODAY,
    )
    expect(records[0].sourceKey).toBe('bad')
  })
})

describe('auditing the catalogue against what we observed', () => {
  it('reports a load-bearing source that has died, and does not tell you to delete it', () => {
    const records = observedReliability(
      run('jma_quakes', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 3),
      TODAY,
    )
    const findings = auditCatalogue([source()], records)
    const dead = findings.find((f) => f.kind === 'declared-dead')!
    expect(dead.severity).toBe('high')
    // A dead endpoint is usually a moved one, and the record holds the licence
    // and independence group that deleting it would lose.
    expect(dead.remedy).toMatch(/enabled: false/)
  })

  it('names the disagreement between a rating we declared and a record it earned', () => {
    const records = observedReliability(
      [
        ...run('jma_quakes', 5, { ok: 1, items: 2 }),
        ...run('jma_quakes', 15, { failed: 1 }, 5),
      ],
      TODAY,
    )
    const finding = auditCatalogue([source()], records).find((f) => f.kind === 'rating-unearned')
    expect(finding).toBeTruthy()
    expect(finding!.detail).toMatch(/Declared A, but answered only/)
    expect(finding!.severity).toBe('high')
  })

  it('does not raise an unearned-rating finding against a source it cannot yet judge', () => {
    const records = observedReliability(run('jma_quakes', 3, { failed: 1 }), TODAY)
    expect(auditCatalogue([source()], records).some((f) => f.kind === 'rating-unearned')).toBe(false)
  })

  it('notices an enabled source the sweep has never run', () => {
    const finding = auditCatalogue([source()], []).find((f) => f.kind === 'never-observed')
    expect(finding).toBeTruthy()
    expect(finding!.detail).toMatch(/no record of ever having run it/)
  })

  it('ignores a source that is switched off on purpose', () => {
    expect(auditCatalogue([source({ enabled: false })], [])).toEqual([])
  })

  it('counts a topic’s origins over the sources that still work', () => {
    // Four origins of which three are dead is one origin, and a topic reported
    // as covered four ways would be a lie in exactly the direction that matters.
    const sources = [
      source({ key: 'a', independence: 'a', topics: ['flood'] }),
      source({ key: 'b', independence: 'b', topics: ['flood'] }),
      source({ key: 'c', independence: 'c', topics: ['flood'] }),
      source({ key: 'd', independence: 'd', topics: ['flood'] }),
    ]
    const records = observedReliability(
      [
        ...run('a', MIN_RUNS_TO_JUDGE, { ok: 1, items: 2 }),
        ...run('b', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 2),
        ...run('c', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 2),
        ...run('d', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 2),
      ],
      TODAY,
    )
    const thin = auditCatalogue(sources, records).find((f) => f.kind === 'thin-topic')
    expect(thin).toBeTruthy()
    expect(thin!.detail).toMatch(/1 working independent origin\b/)
    expect(thin!.severity).toBe('high')
  })

  it('counts republishers of one wire as one origin when judging a topic', () => {
    const sources = [
      source({ key: 'a', independence: 'wire', topics: ['news'] }),
      source({ key: 'b', independence: 'wire', topics: ['news'] }),
      source({ key: 'c', independence: 'wire', topics: ['news'] }),
    ]
    const records = observedReliability(
      ['a', 'b', 'c'].flatMap((k) => run(k, MIN_RUNS_TO_JUDGE, { ok: 1, items: 2 })),
      TODAY,
    )
    const thin = auditCatalogue(sources, records).find((f) => f.kind === 'thin-topic')
    expect(thin!.detail).toMatch(/1 working independent origin\b/)
  })

  it('puts what misleads a reader most at the top', () => {
    const records = observedReliability(
      run('jma_quakes', MIN_RUNS_TO_JUDGE, { empty: 1 }, DAYS_TO_DECLARE_DEAD + 3),
      TODAY,
    )
    const findings = auditCatalogue([source()], records)
    expect(findings[0].severity).toBe('high')
  })
})

describe('the audit as a whole', () => {
  it('says plainly when it has nothing to say', () => {
    const audit = selfAudit([], [], NOW)
    expect(audit.observedSources).toBe(0)
    expect(audit.headline).toMatch(/nothing to say about its own sources/)
  })

  it('reports its own state counts alongside the findings', () => {
    const audit = selfAudit(
      [source()],
      run('jma_quakes', MIN_RUNS_TO_JUDGE, { ok: 1, items: 4 }),
      NOW,
    )
    expect(audit.states.healthy).toBe(1)
    expect(audit.headline).toMatch(/1 of 1 sources measured: 1 healthy/)
  })

  it('says so when the catalogue and the observations agree', () => {
    const sources = [
      source({ key: 'a', independence: 'a' }),
      source({ key: 'b', independence: 'b' }),
      source({ key: 'c', independence: 'c' }),
    ]
    const audit = selfAudit(
      sources,
      ['a', 'b', 'c'].flatMap((k) => run(k, MIN_RUNS_TO_JUDGE, { ok: 1, items: 3 })),
      NOW,
    )
    expect(audit.findings).toEqual([])
    expect(audit.headline).toMatch(/Nothing in the catalogue contradicts what we have observed/)
  })

  it('stamps the day it was taken against, so a record is reproducible', () => {
    expect(todayKey(NOW)).toBe(TODAY)
    expect(selfAudit([], [], NOW).generatedAt).toBe(new Date(NOW).toISOString())
  })
})

describe('the headline never omits the only number that is non-zero', () => {
  /**
   * The live failure, exactly. A deployment whose health table had just been
   * created reported *"164 sources observed: 0 healthy, 0 degraded, 0 silent,
   * 0 dead"* — four zeroes, and no mention of the 164 sources that had simply
   * not been measured enough times to judge. Read one way that is a total
   * outage; read another it is a contradiction. It was neither, and the fifth
   * state said so all along.
   */
  it('says nothing has been measured yet, rather than listing four zeroes', () => {
    // One run is below MIN_RUNS_TO_JUDGE, so the source is `unproven`.
    const audit = selfAudit([source()], run('jma_quakes', 1, { ok: 1, items: 4 }), NOW)
    expect(audit.states.unproven).toBe(1)
    expect(audit.headline).not.toMatch(/0 healthy, 0 degraded/)
    expect(audit.headline).toMatch(/none measured yet/i)
  })

  it('counts the unmeasured separately from the measured', () => {
    const audit = selfAudit(
      [source(), source({ key: 'other', independence: 'other' })],
      [
        ...run('jma_quakes', MIN_RUNS_TO_JUDGE, { ok: 1, items: 4 }),
        ...run('other', 1, { ok: 1, items: 4 }),
      ],
      NOW,
    )
    // The total must not claim both were observed, because one was not.
    expect(audit.headline).toMatch(/1 of 2 sources measured/)
    expect(audit.headline).toMatch(/1 not yet measured/)
  })

  it('drops the "not yet measured" clause once everything is measured', () => {
    const audit = selfAudit([source()], run('jma_quakes', MIN_RUNS_TO_JUDGE, { ok: 1, items: 4 }), NOW)
    expect(audit.headline).not.toMatch(/not yet measured/)
  })
})
