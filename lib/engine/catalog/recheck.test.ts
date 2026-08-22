import { describe, expect, it } from 'vitest'
import {
  judgeProbe,
  MAX_ITEM_AGE_DAYS,
  orphanedEntries,
  probeOrder,
  recheckable,
  recheckQuarantine,
  summarise,
  type Recheck,
} from './recheck'

const NOW = Date.parse('2026-08-22T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/**
 * Every case below was observed on 2026-08-22, when the quarantine was
 * re-probed by hand for the first time in eight days. Eight of fifty-one
 * answered `200`; six were genuinely back and two were not. The two are why
 * this judgement exists as its own tested function rather than as `res.ok`.
 */
describe('a status code is not a release', () => {
  it('releases a source that answers with recent items', () => {
    // `sec_litigation`: 25 items, newest one day old.
    const { verdict, detail } = judgeProbe({ status: 200, items: 25, newestAt: daysAgo(1) }, NOW)
    expect(verdict).toBe('recovered')
    expect(detail).toContain('25 items')
  })

  /**
   * The measured trap. `thedailystar_bd` answers 200 with ten well-formed items
   * whose newest is dated 2022 — and it answered exactly that way on the day it
   * was quarantined as `frozen`. Releasing on the status code would have put
   * four-year-old reporting back on a live board looking like today's.
   */
  it('refuses a feed that answers perfectly and stopped publishing', () => {
    const { verdict, detail } = judgeProbe({ status: 200, items: 10, newestAt: daysAgo(1492) }, NOW)
    expect(verdict).toBe('answers-but-stale')
    expect(detail, 'the number that decided it belongs in the line').toContain('1492 days old')
  })

  /** `saws_south_africa`: a valid page, and no feed anywhere in it. */
  it('refuses a body that parses to nothing', () => {
    expect(judgeProbe({ status: 200, items: 0, newestAt: null }, NOW).verdict).toBe('answers-but-empty')
  })

  it('refuses a body that will not parse at all', () => {
    // A 200 that is not the document fails the parser rather than the request,
    // so nothing upstream would otherwise call it a failure.
    const { verdict, detail } = judgeProbe({ status: 200, items: null, newestAt: null }, NOW)
    expect(verdict).toBe('answers-but-empty')
    expect(detail).toContain('would not parse')
  })

  /**
   * Items with no dates cannot be told apart from an archive. Guessing in the
   * optimistic direction is precisely how a frozen feed gets released.
   */
  it('refuses items that carry no date, rather than assuming they are new', () => {
    const { verdict, detail } = judgeProbe({ status: 200, items: 12, newestAt: null }, NOW)
    expect(verdict).toBe('answers-but-stale')
    expect(detail).toContain('freshness unknowable')
  })

  it('refuses an unreadable date rather than treating it as absent', () => {
    expect(judgeProbe({ status: 200, items: 3, newestAt: 'not a date' }, NOW).verdict).toBe(
      'answers-but-stale',
    )
  })

  it('holds the line exactly where the constant says', () => {
    expect(judgeProbe({ status: 200, items: 1, newestAt: daysAgo(MAX_ITEM_AGE_DAYS) }, NOW).verdict).toBe(
      'recovered',
    )
    expect(
      judgeProbe({ status: 200, items: 1, newestAt: daysAgo(MAX_ITEM_AGE_DAYS + 1) }, NOW).verdict,
    ).toBe('answers-but-stale')
  })

  it('reports a refusal as a refusal, with the status', () => {
    expect(judgeProbe({ status: 403, items: null, newestAt: null }, NOW)).toEqual({
      verdict: 'still-refused',
      detail: 'provider answered 403',
    })
    expect(judgeProbe({ status: 0, items: null, newestAt: null }, NOW).detail).toBe('no response at all')
  })
})

describe('what there is to re-probe', () => {
  it('probes only quarantined keys the catalogue still holds', () => {
    const list = recheckable()
    expect(list.length).toBeGreaterThan(0)
    for (const { entry, source } of list) expect(source.key).toBe(entry.key)
  })

  /**
   * An entry pointing at nothing withholds nothing, and is a small lie about
   * the size of the problem. Two existed before they were removed.
   */
  it('names quarantine entries with no catalogue record rather than skipping them', () => {
    expect(Array.isArray(orphanedEntries())).toBe(true)
  })
})

/**
 * A budget without a rotation is the bug this project keeps finding in its own
 * work: a job that runs, reports, and never touches most of what it claims to
 * cover. Under a 45-second budget and a 43-entry list, a run that always starts
 * at index 0 asks the same handful every day and the tail is never probed at
 * all — the source at the end of the list stays quarantined forever, no matter
 * how long ago it came back.
 */
describe('every entry gets its turn', () => {
  const list = ['a', 'b', 'c', 'd', 'e']
  const onDay = (n: number) => new Date(n * 86_400_000 + 3_600_000)

  it('starts somewhere new each day and covers the whole list', () => {
    const seen = new Set<string>()
    for (let day = 0; day < list.length; day++) seen.add(probeOrder(list, onDay(day))[0])
    expect(seen.size, 'a fixed start means the tail is never reached').toBe(list.length)
  })

  it('keeps every entry exactly once, only rotated', () => {
    for (let day = 0; day < 12; day++) {
      expect([...probeOrder(list, onDay(day))].sort()).toEqual([...list].sort())
    }
  })

  it('is stable within a day, so a retry does not reshuffle', () => {
    expect(probeOrder(list, new Date(5 * 86_400_000 + 60_000))).toEqual(
      probeOrder(list, new Date(5 * 86_400_000 + 80_000_00)),
    )
  })

  it('survives an empty list', () => {
    expect(probeOrder([], onDay(3))).toEqual([])
  })
})

describe('the budget stops the run rather than the runtime', () => {
  /**
   * The route deploys under a 60-second function budget. A run killed by the
   * runtime returns nothing at all, so the day's probing is spent and nobody
   * learns anything from it — which is strictly worse than stopping early and
   * saying what was not reached.
   */
  it('stops when the budget is spent and names what it did not reach', async () => {
    let clock = 0
    const report = await recheckQuarantine({
      // Each probe costs 10s of the fake clock; the budget allows two.
      fetchImpl: (async () => {
        clock += 10_000
        return new Response('', { status: 503 })
      }) as unknown as typeof fetch,
      pauseMs: 0,
      budgetMs: 25_000,
      now: () => clock,
    })
    expect(report.checked).toBe(3)
    expect(report.skipped.length).toBeGreaterThan(0)
    expect(report.checked + report.skipped.length).toBe(recheckable().length)
    expect(report.advice, 'a truncated run that does not say so is a lie by omission').toContain(
      'not reached',
    )
  })

  it('probes every entry when there is time for all of them', async () => {
    const report = await recheckQuarantine({
      fetchImpl: (async () => new Response('', { status: 403 })) as unknown as typeof fetch,
      pauseMs: 0,
      now: () => 0,
    })
    expect(report.checked).toBe(recheckable().length)
    expect(report.skipped).toEqual([])
    expect(report.others.every((r) => r.verdict === 'still-refused')).toBe(true)
  })
})

describe('the report tells a reader what to do', () => {
  const rec = (key: string, verdict: Recheck['verdict']): Recheck => ({
    key,
    was: { reason: 'bot-blocked', status: 403, observedOn: '2026-08-14' },
    now: { status: 200, items: 5, newestAt: daysAgo(1) },
    verdict,
    detail: 'measured',
  })

  /**
   * A job that runs daily and usually finds nothing is a job whose output stops
   * being read after the first week unless it says, in one line, whether
   * anything happened.
   */
  it('names the sources to release when something came back', () => {
    const r = summarise([rec('bls_us', 'recovered'), rec('iea_news', 'still-refused')], [], 43)
    expect(r.recovered).toHaveLength(1)
    expect(r.others).toHaveLength(1)
    expect(r.advice).toContain('bls_us')
    expect(r.advice).toContain('release')
  })

  it('points at the tidying when nothing recovered but entries are stale', () => {
    const r = summarise([rec('iea_news', 'still-refused')], ['sec_edgar_filings'], 43)
    expect(r.advice).toContain('sec_edgar_filings')
  })

  it('says plainly that the picture is accurate when it is', () => {
    const r = summarise([rec('iea_news', 'still-refused')], [], 43)
    expect(r.advice).toContain('accurate picture')
  })

  it('always says something', () => {
    for (const r of [summarise([], [], 0), summarise([rec('a', 'recovered')], ['b'], 1)]) {
      expect(r.advice.length).toBeGreaterThan(20)
    }
  })
})
