import { describe, expect, it } from 'vitest'
import {
  BREAKING_MAX_AGE_HOURS,
  DEFAULT_LIMITS,
  MIN_RARITY,
  assessBreaking,
  countBySource,
  diversify,
  familyOf,
  overflowSummary,
  rarityOf,
  rarityReason,
  type Rankable,
} from './significance'

const item = (sourceKey: string, category: string, severity = 0.75): Rankable => ({
  sourceKey,
  category,
  severity,
})

/** The measured failure: 34 NWS flood warnings and a handful of everything else. */
const realWorldRun: Rankable[] = [
  ...Array.from({ length: 34 }, () => item('nws_alerts', 'flood')),
  item('usgs_quakes', 'seismic', 1),
  item('usgs_quakes', 'seismic', 0.88),
  item('nasa_eonet', 'wildfire'),
  item('un_press', 'world', 0.5),
  item('cisa_kev', 'cyber', 0.6),
]

describe('rarity — how unusual a publisher being heard from is', () => {
  it('gives full weight to a source that spoke once', () => {
    expect(rarityOf(1)).toBe(1)
    expect(rarityOf(0)).toBe(1)
  })

  it('lowers weight as a publisher floods the run', () => {
    expect(rarityOf(2)).toBeLessThan(rarityOf(1))
    expect(rarityOf(34)).toBeLessThan(rarityOf(4))
  })

  /**
   * The floor has to sit below the range publishers actually occupy. At 0.35 it
   * did not: `1/(1+log₂4)` is already 0.333, so every source sending four or
   * more events scored the same and NWS at 34 tied with a source at 4 — the
   * correction was silently doing nothing across the whole real range.
   */
  it('stays discriminating across the range publishers actually occupy', () => {
    const range = [1, 2, 4, 8, 16, 34]
    for (let i = 1; i < range.length; i++) {
      expect(rarityOf(range[i]), `${range[i]} vs ${range[i - 1]}`).toBeLessThan(
        rarityOf(range[i - 1]),
      )
    }
  })

  /**
   * The floor is what keeps this a correction rather than a suppression. USGS
   * sending forty tremors must not bury the genuine M7.7 among them.
   */
  it('never falls below the floor, however prolific the source', () => {
    for (const n of [50, 500, 100_000]) {
      expect(rarityOf(n), `${n} events`).toBeGreaterThanOrEqual(MIN_RARITY)
    }
  })

  it('flattens out, so 40 and 44 are not meaningfully different', () => {
    expect(Math.abs(rarityOf(40) - rarityOf(44))).toBeLessThan(0.02)
  })

  it('counts what each source contributed', () => {
    const counts = countBySource(realWorldRun)
    expect(counts.get('nws_alerts')).toBe(34)
    expect(counts.get('un_press')).toBe(1)
  })

  /** A bare number tells a reader nothing about why a row sits where it does. */
  it('explains itself in words rather than a score', () => {
    expect(rarityReason('un_press', 1)).toContain('only report')
    expect(rarityReason('nws_alerts', 34)).toContain('one of 34')
    expect(rarityReason('nws_alerts', 34)).toContain('routine volume')
  })
})

describe('diversity — the fix for one publisher owning the board', () => {
  /**
   * The regression this whole module exists for. Before it, 17 of the top 20
   * rows were `nws_alerts`.
   */
  it('stops one publisher from filling the list', () => {
    const { taken } = diversify(realWorldRun, 20)
    const nws = taken.filter((t) => t.sourceKey === 'nws_alerts').length
    expect(nws).toBeLessThanOrEqual(DEFAULT_LIMITS.maxPerSource + realWorldRun.length - 20)
    // And the sources that were being drowned are now present.
    expect(taken.some((t) => t.sourceKey === 'un_press')).toBe(true)
    expect(taken.some((t) => t.sourceKey === 'cisa_kev')).toBe(true)
  })

  it('caps a single category too, not only a single source', () => {
    const manyFloods = Array.from({ length: 30 }, (_, i) => item(`src_${i}`, 'flood'))
    const { taken, diversified } = diversify([...manyFloods, item('a', 'cyber'), item('b', 'world')], 8)
    const earned = taken.slice(0, diversified)
    expect(earned.filter((t) => t.category === 'flood').length).toBeLessThanOrEqual(
      DEFAULT_LIMITS.maxPerCategory,
    )
  })

  it('keeps the highest-ranked item whatever the caps', () => {
    const { taken } = diversify(realWorldRun, 20)
    expect(taken[0]).toBe(realWorldRun[0])
  })

  /**
   * Dropping held-back events silently would be hiding real ones — a different
   * failure from the one being fixed.
   */
  it('returns what was held back rather than discarding it', () => {
    const { taken, overflow } = diversify(realWorldRun, 10)
    expect(taken.length + overflow.length).toBe(realWorldRun.length)
  })

  /** A list of four when twenty were asked for is its own defect. */
  it('backfills from the overflow rather than returning a short list', () => {
    const oneSource = Array.from({ length: 20 }, () => item('nws_alerts', 'flood'))
    const { taken } = diversify(oneSource, 12)
    expect(taken).toHaveLength(12)
  })

  it('returns everything when there is less than the limit', () => {
    const { taken, overflow } = diversify([item('a', 'x'), item('b', 'y')], 20)
    expect(taken).toHaveLength(2)
    expect(overflow).toHaveLength(0)
  })

  it('handles an empty list without inventing rows', () => {
    expect(diversify([], 10)).toEqual({ taken: [], overflow: [], diversified: 0 })
  })

  /**
   * The failure the `diversified` count exists to expose. The first version
   * backfilled silently and thereby undid the caps it had just applied — eight
   * hazard rows under a cap of seven, with nothing in the output saying so.
   */
  it('reports how many earned their place, so backfill is never silent', () => {
    const oneFamily = Array.from({ length: 30 }, (_, i) => item(`src_${i}`, 'flood'))
    const { taken, diversified } = diversify(oneFamily, 20)
    expect(taken).toHaveLength(20)
    // Only the capped few earned it; the rest are filling space, and it shows.
    expect(diversified).toBeLessThan(20)
    expect(diversified).toBeLessThanOrEqual(DEFAULT_LIMITS.maxPerFamily)
  })

  it('marks the whole list as earned when the caps were never reached', () => {
    const varied = [item('a', 'cyber'), item('b', 'economy'), item('c', 'world')]
    const { taken, diversified } = diversify(varied, 20)
    expect(diversified).toBe(taken.length)
  })

  it('respects caps a caller tightens', () => {
    const { taken, diversified } = diversify(realWorldRun, 20, {
      maxPerSource: 1,
      maxPerCategory: 1,
      maxPerFamily: 1,
    })
    // Everything that earned its place under caps of one must be unique.
    const earned = taken.slice(0, diversified)
    expect(new Set(earned.map((t) => t.sourceKey)).size).toBe(earned.length)
  })

  /**
   * The second measured failure, after the per-source cap was already in.
   *
   * The board read: three earthquakes, three floods, three wildfires, a
   * volcano. Every one is a separate category, so every one got its own
   * allowance — and the board was still almost entirely natural hazards. To a
   * reader those are one kind of thing, and the complaint was "the news is all
   * weather", not "too much NWS".
   */
  it('treats every natural hazard as one family, not eight categories', () => {
    const hazards = [
      ...Array.from({ length: 6 }, (_, i) => item(`quake_${i}`, 'seismic')),
      ...Array.from({ length: 6 }, (_, i) => item(`flood_${i}`, 'flood')),
      ...Array.from({ length: 6 }, (_, i) => item(`fire_${i}`, 'wildfire')),
      ...Array.from({ length: 6 }, (_, i) => item(`storm_${i}`, 'storm')),
    ]
    const rest = [
      item('un_press', 'world', 0.5),
      item('cisa_kev', 'cyber', 0.6),
      item('fed', 'economy', 0.5),
      item('ripe', 'infrastructure', 0.4),
    ]
    const { taken, diversified } = diversify([...hazards, ...rest], 12)
    const earned = taken.slice(0, diversified)
    const hazardRows = earned.filter((t) => familyOf(t.category) === 'hazard').length
    expect(hazardRows).toBeLessThanOrEqual(DEFAULT_LIMITS.maxPerFamily)
    // And everything that was being crowded out is now on the board.
    for (const other of rest) expect(taken).toContain(other)
  })

  it('knows which family each category belongs to', () => {
    expect(familyOf('seismic')).toBe('hazard')
    expect(familyOf('flood')).toBe('hazard')
    expect(familyOf('wildfire')).toBe('hazard')
    expect(familyOf('conflict')).toBe('security')
    expect(familyOf('economy')).toBe('economy')
  })

  /** An unmapped category must not silently join someone else's allowance. */
  it('gives an unknown category its own family rather than a shared one', () => {
    expect(familyOf('something-new')).toBe('something-new')
  })
})

describe('saying what was held back', () => {
  it('names the publisher when the overflow is all one source', () => {
    const summary = overflowSummary(Array.from({ length: 24 }, () => item('nws_alerts', 'flood')))
    expect(summary).toContain('24 more from nws_alerts')
    expect(summary).toContain('one publisher does not fill the board')
  })

  it('names the biggest contributor when the overflow is mixed', () => {
    const summary = overflowSummary([
      ...Array.from({ length: 5 }, () => item('nws_alerts', 'flood')),
      item('other', 'cyber'),
    ])
    expect(summary).toContain('6 more')
    expect(summary).toContain('5 of them from nws_alerts')
  })

  it('says nothing when nothing was held back', () => {
    expect(overflowSummary([])).toBeNull()
  })
})

describe('what earns a breaking banner', () => {
  const base = {
    sourceKey: 'usgs_quakes',
    category: 'seismic',
    title: 'M 7.7',
    severity: 0.9,
    magnitude: 7.7,
    origins: 1,
    ageHours: 1,
  }

  it('breaks on a severe report from a publisher that rarely speaks', () => {
    const verdict = assessBreaking({ ...base, magnitude: null }, 2)
    expect(verdict.breaking).toBe(true)
    expect(verdict.reasons[0]).toContain('severe')
  })

  it('breaks on independent corroboration at a lower severity bar', () => {
    const verdict = assessBreaking({ ...base, severity: 0.45, magnitude: null, origins: 3 }, 30)
    expect(verdict.breaking).toBe(true)
    expect(verdict.reasons.join(' ')).toContain('3 independent origins')
  })

  it('breaks on a measurement far above the ordinary', () => {
    const verdict = assessBreaking({ ...base, severity: 0.2 }, 40)
    expect(verdict.breaking).toBe(true)
    expect(verdict.reasons.join(' ')).toContain('measured at 7.7')
  })

  it('names the scale, because a bare number is not a claim anyone can check', () => {
    const verdict = assessBreaking({ ...base, severity: 0.2, magnitudeUnit: 'Mww' }, 40)
    expect(verdict.reasons.join(' ')).toContain('measured at 7.7 Mww')
  })

  /**
   * Found in live output, not in review. Across 119 sources `magnitude` is not
   * one quantity — it is a moment magnitude here, an altitude in kilometres
   * there — and a single threshold written for earthquakes reported the
   * **International Space Station as breaking news because it was 429 km up**.
   */
  it('refuses to read a number on some other scale as an earthquake', () => {
    const iss = assessBreaking(
      {
        sourceKey: 'iss_position',
        category: 'space',
        title: 'International Space Station overhead',
        severity: 0,
        magnitude: 428.8,
        magnitudeUnit: 'km',
        origins: 1,
        ageHours: 0.1,
      },
      1,
    )
    expect(iss.breaking).toBe(false)
    expect(iss.reasons).toEqual([])
  })

  it('leaves a category with no stated alarm to qualify like anything else', () => {
    const gauge = assessBreaking(
      {
        sourceKey: 'noaa_coops_water',
        category: 'infrastructure',
        title: 'Water level 0.821 m',
        severity: 0,
        magnitude: 999,
        magnitudeUnit: 'm',
        origins: 1,
        ageHours: 0.5,
      },
      1,
    )
    expect(gauge.breaking).toBe(false)
  })

  /**
   * The whole reason the bar is high. A banner that fires on every county
   * warning is a banner nobody reads — and then it fails at the one moment it
   * matters.
   */
  it('does not break on routine high-severity volume', () => {
    const flood = {
      sourceKey: 'nws_alerts',
      category: 'flood',
      title: 'Flood Warning',
      severity: 0.75,
      magnitude: null,
      origins: 1,
      ageHours: 1,
    }
    expect(assessBreaking(flood, 34).breaking).toBe(false)
  })

  it('does not break on something old, however severe', () => {
    expect(assessBreaking({ ...base, ageHours: BREAKING_MAX_AGE_HOURS + 1 }, 1).breaking).toBe(false)
  })

  /** No usable time means we cannot claim it is happening now. */
  it('does not break on an event with no published time', () => {
    expect(assessBreaking({ ...base, ageHours: null }, 1).breaking).toBe(false)
  })

  it('gives a reason for every break, never a bare flag', () => {
    const verdict = assessBreaking(base, 1)
    expect(verdict.breaking).toBe(true)
    expect(verdict.reasons.length).toBeGreaterThan(0)
    for (const reason of verdict.reasons) expect(reason.length).toBeGreaterThan(10)
  })
})
