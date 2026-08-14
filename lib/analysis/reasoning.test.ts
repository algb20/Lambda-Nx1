import { describe, expect, it } from 'vitest'
import {
  explainReading,
  findDisagreements,
  groupClaims,
  quantities,
  readCorroboration,
  readEvidence,
  readSourceMix,
  readTime,
  resolveOrigin,
  sourceClassOf,
} from './reasoning'
import type { Evidence } from '../engine/types'

/** A fixed clock, so every age in this file is an assertable number. */
const NOW = Date.parse('2026-08-14T12:00:00.000Z')

function at(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 3_600_000).toISOString()
}

function ev(over: Partial<Evidence> & { claim: string }): Evidence {
  return {
    sourceKey: 'gdelt',
    sourceUrl: 'https://example.org/a',
    retrievedAt: at(0),
    publishedAt: at(2),
    confidence: 'possible',
    admiralty: { source: 'C', info: 3 },
    ...over,
  }
}

describe('origins', () => {
  it('prefers the independence group the source declared on the evidence', () => {
    // The catalogue puts it there and the world pipeline carries it through:
    // fifteen outlets arriving via one index are one origin, not fifteen.
    const e = ev({ claim: 'x', sourceKey: 'gdelt_a', data: { independence: 'gdelt' } })
    expect(resolveOrigin(e)).toBe('gdelt')
  })

  it('falls back to a caller-supplied group table, then to the source key', () => {
    expect(resolveOrigin(ev({ claim: 'x', sourceKey: 'usgs' }), { usgs: 'seismic-net' })).toBe(
      'seismic-net',
    )
    expect(resolveOrigin(ev({ claim: 'x', sourceKey: 'usgs' }))).toBe('usgs')
  })
})

describe('claim grouping', () => {
  it('separates corroboration from repetition', () => {
    // The distinction the rest of the field erases: three reports through one
    // wire look exactly like three confirmations on every competing feed.
    const evidence = [
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu', sourceKey: 'wire', data: { independence: 'wire' } }),
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu region', sourceKey: 'outlet_a', data: { independence: 'wire' } }),
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu today', sourceKey: 'outlet_b', data: { independence: 'wire' } }),
      ev({ claim: 'Central bank holds its policy rate unchanged', sourceKey: 'imf' }),
    ]
    const groups = groupClaims(evidence)
    const quake = groups.find((g) => g.refs.includes(0)) as (typeof groups)[number]
    expect(quake.refs).toEqual([0, 1, 2])
    expect(quake.origins).toEqual(['wire'])
    expect(quake.support).toBe('repeated')
    expect(quake.reading).toMatch(/repetition, not corroboration/i)
  })

  it('calls two genuinely independent origins corroborated', () => {
    const groups = groupClaims([
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu', sourceKey: 'usgs' }),
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu region', sourceKey: 'emsc' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].support).toBe('corroborated')
    expect(groups[0].origins).toEqual(['emsc', 'usgs'])
  })

  it('keeps unrelated claims apart', () => {
    const groups = groupClaims([
      ev({ claim: 'Nameserver ns1.example.net serves the zone', sourceKey: 'doh_dns' }),
      ev({ claim: 'Company registered in Delaware in 1998', sourceKey: 'opencorporates' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.support === 'single')).toBe(true)
  })

  it('does not let a claim from 2019 corroborate the same claim from today', () => {
    // Same words, different moments: an A record seven years ago says nothing
    // about the one resolving now.
    const groups = groupClaims([
      ev({ claim: 'A record resolves to 203.0.113.10', sourceKey: 'doh_dns', publishedAt: at(2) }),
      ev({
        claim: 'A record resolves to 203.0.113.10',
        sourceKey: 'wayback',
        publishedAt: at(24 * 365 * 7),
      }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('every ref points at a real row, so nothing the reading says is unattributable', () => {
    const evidence = [
      ev({ claim: 'Alpha claim about the port authority' }),
      ev({ claim: 'Beta claim about the shipping register' }),
      ev({ claim: 'Gamma claim about the customs filing' }),
    ]
    const refs = groupClaims(evidence).flatMap((g) => g.refs).sort()
    expect(refs).toEqual([0, 1, 2])
  })
})

describe('corroboration reading', () => {
  it('reports the share of the picture nothing independent supports', () => {
    const groups = groupClaims([
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu', sourceKey: 'usgs' }),
      ev({ claim: 'Magnitude 6.1 earthquake strikes northern Honshu region', sourceKey: 'emsc' }),
      ev({ claim: 'Port of Sendai suspends all container operations', sourceKey: 'wire' }),
    ])
    const reading = readCorroboration(groups)
    expect(reading.corroborated).toBe(1)
    expect(reading.single).toBe(1)
    expect(reading.uncorroboratedShare).toBeCloseTo(0.5)
    // Corroborated claims sort first: a reader who stops early reads the
    // strongest support, not the weakest.
    expect(reading.groups[0].support).toBe('corroborated')
  })
})

describe('quantity extraction', () => {
  it('keeps the word on both sides, because English uses both', () => {
    // "magnitude 6.1" puts the unit in front and "12 dead" puts it behind;
    // keeping one side would fail silently on half of all claims.
    expect(quantities('Magnitude 6.1 earthquake')).toEqual([
      { value: 6.1, before: 'magnitude', after: 'earthquake' },
    ])
    expect(quantities('leaves 12 dead')).toEqual([{ value: 12, before: 'leaves', after: 'dead' }])
  })

  it('reads thousands separators as one number', () => {
    expect(quantities('1,200 dead')).toEqual([{ value: 1200, before: null, after: 'dead' }])
  })

  it('drops a bare year, which is a date wearing a number’s clothes', () => {
    // Otherwise "registered in 2019" vs "registered in 2021" is reported as a
    // disagreement about how much, when it is a disagreement about when.
    expect(quantities('registered 2019').some((q) => q.value === 2019)).toBe(false)
  })

  it('drops a number whose only neighbours are function words', () => {
    expect(quantities('arrived in 3')).toEqual([])
  })
})

describe('disagreement detection', () => {
  function disagreements(evidence: Evidence[]) {
    return findDisagreements(evidence, groupClaims(evidence))
  }

  it('finds two origins stating different numbers for the same quantity', () => {
    const found = disagreements([
      ev({ claim: 'Flooding in Sindh leaves 12 dead, officials say', sourceKey: 'reliefweb' }),
      ev({ claim: 'Flooding in Sindh leaves 40 dead, officials say', sourceKey: 'gdelt' }),
    ])
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('quantity')
    expect(found[0].subject).toBe('dead')
    expect(found[0].refs).toEqual([0, 1])
    expect(found[0].origins.sort()).toEqual(['gdelt', 'reliefweb'])
  })

  it('compares two phrasings of the same measurement', () => {
    // The reason both neighbours are kept: one agency writes "magnitude 6.1
    // earthquake" and the other "earthquake of magnitude 5.2", and a
    // single-sided key would never put the two numbers side by side.
    const found = disagreements([
      ev({ claim: 'Magnitude 6.1 earthquake recorded off northern Honshu', sourceKey: 'usgs' }),
      ev({ claim: 'Earthquake of magnitude 5.2 recorded off northern Honshu', sourceKey: 'emsc' }),
    ])
    expect(found.filter((f) => f.kind === 'quantity')).toHaveLength(1)
    expect(found[0].subject).toBe('magnitude')
  })

  it('reports one quantity disagreement per claim, not one per pairing', () => {
    // Twelve reports of one flood would otherwise produce sixty pairings of the
    // same dispute and bury every other finding underneath them.
    const found = disagreements([
      ev({ claim: 'Flooding in Sindh leaves 12 dead, officials say', sourceKey: 'a' }),
      ev({ claim: 'Flooding in Sindh leaves 40 dead, officials say', sourceKey: 'b' }),
      ev({ claim: 'Flooding in Sindh leaves 60 dead, officials say', sourceKey: 'c' }),
      ev({ claim: 'Central bank holds its policy rate unchanged', sourceKey: 'imf' }),
    ])
    const quantity = found.filter((f) => f.kind === 'quantity')
    expect(quantity).toHaveLength(1)
    // And it is the widest one — the reader sees the full extent of the spread.
    expect(quantity[0].detail).toMatch(/12 and 60/)
  })

  it('treats different precisions of one measurement as agreement, not conflict', () => {
    // Two agencies solving one quake to 6.10 and 6.14 are agreeing.
    expect(
      disagreements([
        ev({ claim: 'Earthquake of magnitude 6.10 recorded off Honshu', sourceKey: 'usgs' }),
        ev({ claim: 'Earthquake of magnitude 6.14 recorded off Honshu', sourceKey: 'emsc' }),
      ]),
    ).toEqual([])
  })

  it('never reports one origin correcting its own bulletin as a contradiction', () => {
    // A feed revising its own figure is a source doing its job.
    expect(
      disagreements([
        ev({ claim: 'Flooding in Sindh leaves 12 dead, officials say', sourceKey: 'a', data: { independence: 'reliefweb' } }),
        ev({ claim: 'Flooding in Sindh leaves 40 dead, officials say', sourceKey: 'b', data: { independence: 'reliefweb' } }),
      ]),
    ).toEqual([])
  })

  it('finds one origin denying what another asserts', () => {
    const found = disagreements([
      ev({ claim: 'Ministry confirms the tanker was detained at the terminal', sourceKey: 'reuters_like' }),
      ev({ claim: 'Ministry says the tanker was not detained at the terminal', sourceKey: 'ministry' }),
    ])
    expect(found.some((f) => f.kind === 'polarity')).toBe(true)
  })

  it('finds two origins placing the same claim in different places', () => {
    const found = disagreements([
      ev({
        claim: 'Strong earthquake reported near the coastal city',
        sourceKey: 'usgs',
        data: { lat: 38.3, lon: 142.4 },
      }),
      ev({
        claim: 'Strong earthquake reported near the coastal city area',
        sourceKey: 'emsc',
        data: { lat: 34.0, lon: 139.0 },
      }),
    ])
    expect(found.some((f) => f.kind === 'location')).toBe(true)
    expect(found.find((f) => f.kind === 'location')?.detail).toMatch(/km apart/)
  })

  it('does not compare numbers across unrelated claims', () => {
    // "12 dead" and "40 dead" in two different events are two facts, not a
    // dispute — the restriction to one claim group is what prevents that.
    expect(
      disagreements([
        ev({ claim: 'Flooding in Sindh leaves 12 dead' }),
        ev({ claim: 'Bus crash in Peru leaves 40 dead' }),
      ]).filter((f) => f.kind === 'quantity'),
    ).toEqual([])
  })
})

describe('temporal reading', () => {
  it('counts an undated finding as un-ageable and never as fresh', () => {
    // The default every other feed applies — publication time falls back to
    // retrieval time — turns a five-year-old report into breaking news.
    const reading = readTime([ev({ claim: 'undated claim', publishedAt: null })], NOW)
    expect(reading.undated).toEqual([0])
    expect(reading.fresh).toEqual([])
    expect(reading.newestPublishedAt).toBeNull()
    expect(reading.reading).toMatch(/cannot be aged/)
  })

  it('bands the dated evidence and reports how far back the picture reaches', () => {
    const reading = readTime(
      [
        ev({ claim: 'today', publishedAt: at(3) }),
        ev({ claim: 'this week', publishedAt: at(72) }),
        ev({ claim: 'last year', publishedAt: at(24 * 400) }),
      ],
      NOW,
    )
    expect(reading.fresh).toEqual([0])
    expect(reading.recent).toEqual([1])
    expect(reading.stale).toEqual([2])
    expect(reading.newestAgeHours).toBeCloseTo(3)
    expect(reading.spanHours).toBeCloseTo(24 * 400 - 3)
  })

  it('flags a source dated after we retrieved it as a clock fault', () => {
    const reading = readTime(
      [ev({ claim: 'from the future', retrievedAt: at(5), publishedAt: at(0) })],
      NOW,
    )
    expect(reading.impossible).toEqual([0])
    expect(reading.reading).toMatch(/one of the two timestamps is wrong/)
  })
})

describe('source mix', () => {
  it('classifies by Admiralty letter', () => {
    expect(sourceClassOf(ev({ claim: 'x', admiralty: { source: 'A', info: 1 } }))).toBe('instrument')
    expect(sourceClassOf(ev({ claim: 'x', admiralty: { source: 'B', info: 2 } }))).toBe('official')
    expect(sourceClassOf(ev({ claim: 'x', admiralty: { source: 'C', info: 3 } }))).toBe('reporting')
    expect(sourceClassOf(ev({ claim: 'x', admiralty: undefined }))).toBe('unrated')
  })

  it('names a picture built entirely on press reporting', () => {
    const mix = readSourceMix([
      ev({ claim: 'a', sourceKey: 'x' }),
      ev({ claim: 'b', sourceKey: 'y' }),
      ev({ claim: 'c', sourceKey: 'z' }),
    ])
    expect(mix.monoculture).toBe('reporting')
    expect(mix.reading).toMatch(/Nothing here was measured/)
  })

  it('does not call three findings a monoculture when one is measured', () => {
    const mix = readSourceMix([
      ev({ claim: 'a', sourceKey: 'x' }),
      ev({ claim: 'b', sourceKey: 'y' }),
      ev({ claim: 'c', sourceKey: 'usgs', admiralty: { source: 'A', info: 1 } }),
    ])
    expect(mix.monoculture).toBeNull()
    expect(mix.byClass.instrument.refs).toEqual([2])
  })

  it('names the origin that would take most of the picture with it', () => {
    const mix = readSourceMix([
      ev({ claim: 'a', sourceKey: 'gdelt' }),
      ev({ claim: 'b', sourceKey: 'gdelt' }),
      ev({ claim: 'c', sourceKey: 'gdelt' }),
      ev({ claim: 'd', sourceKey: 'usgs' }),
    ])
    expect(mix.dominant?.origin).toBe('gdelt')
    expect(mix.reading).toMatch(/75% of it/)
  })

  it('says nothing about dominance when there is only one origin to be dominant over', () => {
    const mix = readSourceMix([ev({ claim: 'a', sourceKey: 'only' }), ev({ claim: 'b', sourceKey: 'only' })])
    expect(mix.dominant).toBeNull()
    expect(mix.reading).toMatch(/one origin/)
  })
})

describe('readEvidence', () => {
  const world: Evidence[] = [
    ev({
      claim: 'Magnitude 6.1 earthquake strikes off northern Honshu',
      sourceKey: 'usgs',
      admiralty: { source: 'A', info: 1 },
      confidence: 'confirmed',
      publishedAt: at(1),
      data: { lat: 38.3, lon: 142.4, magnitude: 6.1 },
    }),
    ev({
      claim: 'Magnitude 6.1 earthquake strikes off northern Honshu coast',
      sourceKey: 'emsc',
      admiralty: { source: 'A', info: 2 },
      confidence: 'confirmed',
      publishedAt: at(1),
      data: { lat: 38.35, lon: 142.5, magnitude: 6.1 },
    }),
    ev({
      claim: 'Sendai port suspends container operations after the quake',
      sourceKey: 'gdelt',
      publishedAt: at(2),
    }),
  ]

  it('is deterministic: the same evidence and clock give the same reading', () => {
    // The property that makes it arguable. A reading nobody can reproduce is a
    // reading nobody can check.
    const a = readEvidence(world, { now: NOW })
    const b = readEvidence(world, { now: NOW })
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b))
  })

  it('needs no key, no network and no model', () => {
    const reading = readEvidence(world, { now: NOW })
    expect(reading.findings).toBe(3)
    expect(reading.corroboration.corroborated).toBe(1)
    expect(reading.sourceMix.origins).toEqual(['emsc', 'gdelt', 'usgs'])
    expect(reading.bottomLine.length).toBeGreaterThan(2)
  })

  it('grades a contested picture as contested, however much of it there is', () => {
    const reading = readEvidence(
      [
        ev({ claim: 'Flooding in Sindh leaves 12 dead, officials say', sourceKey: 'reliefweb' }),
        ev({ claim: 'Flooding in Sindh leaves 40 dead, officials say', sourceKey: 'gdelt' }),
        ev({ claim: 'Flooding in Sindh leaves 12 dead, officials report', sourceKey: 'wfp' }),
      ],
      { now: NOW },
    )
    expect(reading.strength).toBe('contested')
    expect(reading.gaps[0].kind).toBe('contested')
  })

  it('grades a one-origin picture thin no matter how many rows it has', () => {
    const reading = readEvidence(
      Array.from({ length: 12 }, (_, i) => ev({ claim: `Report number ${i} about the terminal`, sourceKey: 'wire' })),
      { now: NOW },
    )
    expect(reading.strength).toBe('thin')
    expect(reading.gaps.some((g) => g.kind === 'single-origin')).toBe(true)
  })

  it('treats an empty result as a gap in our coverage, never as a finding about the subject', () => {
    // Absence of evidence is not evidence of absence — the one sentence this
    // module must never get wrong.
    const reading = readEvidence([], { now: NOW })
    expect(reading.findings).toBe(0)
    expect(reading.gaps[0].kind).toBe('nothing-collected')
    expect(reading.bottomLine.join(' ')).toMatch(/not about the subject/)
  })

  it('survives malformed rows rather than throwing at the user', () => {
    const reading = readEvidence(
      [
        ev({ claim: '   ' }),
        { claim: 'real claim about the register', sourceKey: 's', retrievedAt: at(1), confidence: 'possible' },
      ],
      { now: NOW },
    )
    expect(reading.findings).toBe(1)
  })

  it('every gap names a passive check and never suggests touching a target', () => {
    // Charter §3: the analyst may only ever send a reader to another public
    // record. A suggestion to probe would breach the platform's guarantee.
    const reading = readEvidence(world, { now: NOW })
    for (const gap of reading.gaps) {
      expect(gap.check.length, gap.kind).toBeGreaterThan(20)
      expect(gap.check, gap.kind).not.toMatch(/scan|probe|port|nmap|connect to|contact the target/i)
    }
  })

  it('points every gap at rows that exist', () => {
    const reading = readEvidence(world, { now: NOW })
    for (const gap of reading.gaps) {
      for (const ref of gap.refs) {
        expect(world[ref], `${gap.kind} ref ${ref}`).toBeDefined()
      }
    }
  })

  it('adds no claim that is not in the evidence', () => {
    // The statements it surfaces are the sources' own sentences, never ours.
    const reading = readEvidence(world, { now: NOW })
    const claims = world.map((e) => e.claim)
    for (const group of reading.corroboration.groups) {
      expect(claims).toContain(group.statement)
    }
  })
})

describe('explainReading', () => {
  it('renders the whole reading, gaps included, without an interface', () => {
    const text = explainReading(
      readEvidence([ev({ claim: 'A single ungraded report about the filing', publishedAt: null })], {
        now: NOW,
      }),
    )
    expect(text).toMatch(/^Reading: /)
    expect(text).toMatch(/What to check:/)
  })
})
