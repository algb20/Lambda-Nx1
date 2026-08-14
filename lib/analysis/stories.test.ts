import { describe, expect, it } from 'vitest'
import {
  MERGE_THRESHOLD,
  MIN_BATCH_FOR_IDF,
  analyseStories,
  buildScorer,
  clusterStories,
  containment,
  similarity,
  storyOrder,
  termWeights,
  tokenize,
  type Story,
} from './stories'
import type { Evidence } from '../engine/types'

function ev(over: Partial<Evidence> & { claim: string }): Evidence {
  return {
    sourceKey: 'gdelt',
    retrievedAt: '2026-08-14T12:00:00.000Z',
    publishedAt: '2026-08-14T11:00:00.000Z',
    confidence: 'possible',
    admiralty: { source: 'C', info: 3 },
    ...over,
  }
}

describe('tokenizing', () => {
  it('keeps non-Latin scripts, which an ASCII word-boundary would erase', () => {
    // The failure this guards against is invisible and total: reduced to no
    // tokens, every Arabic headline would merge with every other one.
    expect(tokenize('زلزال قوي يضرب طوكيو').length).toBeGreaterThan(2)
    expect(tokenize('東京で強い地震').length).toBeGreaterThan(0)
    expect(tokenize('Séisme majeur à Tōkyō')).toContain('séisme')
  })

  it('drops punctuation without joining the words on either side', () => {
    expect(tokenize('M7.4 — Tokyo, Japan')).toEqual(['m7', 'tokyo', 'japan'])
  })
})

describe('term weighting', () => {
  it('gives a word in every report no weight at all', () => {
    const docs = [new Set(['the', 'flood']), new Set(['the', 'fire']), new Set(['the', 'quake'])]
    expect(termWeights(docs).get('the')).toBe(0)
    expect(termWeights(docs).get('flood')!).toBeGreaterThan(0)
  })

  it('weighs a rare word above a common one', () => {
    const docs = [
      new Set(['report', 'tohoku']),
      new Set(['report', 'lisbon']),
      new Set(['report', 'cairo']),
      new Set(['report', 'tohoku']),
    ]
    const w = termWeights(docs)
    expect(w.get('tohoku')!).toBeGreaterThan(w.get('report')!)
  })
})

describe('choosing a measure for the batch', () => {
  const small = [new Set(['a']), new Set(['b']), new Set(['c'])]
  const large = Array.from({ length: MIN_BATCH_FOR_IDF }, (_, i) => new Set([`t${i}`]))

  it('does not use batch statistics when there is no batch to speak of', () => {
    expect(buildScorer(small).strategy).toBe('containment')
  })

  it('uses inverse document frequency once the batch can support it', () => {
    expect(buildScorer(large).strategy).toBe('idf')
  })
})

describe('containment — the small-batch measure', () => {
  const universal = new Set<string>()

  it('scores two reports of one event above the merge threshold', () => {
    const a = new Set(['magnitude', 'earthquake', 'tohoku', 'japan'])
    const b = new Set(['strong', 'quake', 'tohoku', 'japan', 'coast'])
    expect(containment(a, b, universal)).toBeGreaterThanOrEqual(MERGE_THRESHOLD)
  })

  it('scores unrelated reports at nothing', () => {
    const a = new Set(['magnitude', 'earthquake', 'tohoku', 'japan'])
    const c = new Set(['parliament', 'budget', 'vote', 'ottawa'])
    expect(containment(a, c, universal)).toBe(0)
  })

  it('does not punish a short wire flash for being short', () => {
    // Dividing by the union would score this low exactly when merging matters
    // most: the terse report is the one that most needs placing in a story.
    const flash = new Set(['tohoku', 'quake'])
    const long = new Set(['tohoku', 'quake', 'magnitude', 'coast', 'tsunami', 'warning'])
    expect(containment(flash, long, universal)).toBe(1)
  })

  it('refuses to merge on words every report in the batch shares', () => {
    const a = new Set(['officials', 'said'])
    const b = new Set(['officials', 'said'])
    expect(containment(a, b, new Set(['officials', 'said']))).toBe(0)
  })
})

describe('weighted similarity — the large-batch measure', () => {
  /** A realistic board: boilerplate everywhere, one event reported twice. */
  const headlines = [
    'officials said the ministry will review the policy next month',
    'officials said the committee rejected the proposal on wednesday',
    'officials said talks over the fishing quota continue in brussels',
    'officials said the audit found no irregularities in the accounts',
    'officials said the new rail line opens to passengers in spring',
    'officials said the currency intervention was a one-off measure',
    'strong earthquake strikes tohoku japan officials said',
    'tohoku japan earthquake prompts tsunami advisory officials said',
  ]
  const docs = headlines.map((h) => new Set(tokenize(h)))
  const weights = termWeights(docs)

  it('gives the boilerplate almost no weight and the place name most of it', () => {
    expect(weights.get('officials')).toBe(0)
    expect(weights.get('said')).toBe(0)
    expect(weights.get('tohoku')!).toBeGreaterThan(1)
  })

  it('merges the two reports of one event', () => {
    expect(similarity(docs[6], docs[7], weights)).toBeGreaterThanOrEqual(MERGE_THRESHOLD)
  })

  it('keeps two unrelated stories that share only boilerplate apart', () => {
    expect(similarity(docs[0], docs[1], weights)).toBeLessThan(MERGE_THRESHOLD)
    expect(similarity(docs[2], docs[3], weights)).toBeLessThan(MERGE_THRESHOLD)
  })

  it('scores nothing when the shorter report is all boilerplate', () => {
    const allCommon = new Set(['officials', 'said'])
    expect(similarity(allCommon, docs[0], weights)).toBe(0)
  })
})

describe('clustering reports into stories', () => {
  const quake = [
    ev({
      claim: 'Magnitude 7.4 earthquake strikes off Tohoku coast, Japan',
      sourceKey: 'usgs_quakes',
      admiralty: { source: 'A', info: 1 },
      publishedAt: '2026-08-14T09:00:00.000Z',
      data: { country: 'Japan' },
    }),
    ev({
      claim: 'Strong quake shakes Tohoku, Japan — tsunami advisory issued',
      sourceKey: 'gdelt',
      publishedAt: '2026-08-14T09:12:00.000Z',
      data: { domain: 'reuters.com', country: 'Japan' },
    }),
    ev({
      claim: 'Tohoku Japan quake prompts tsunami advisory along the coast',
      sourceKey: 'gdelt',
      publishedAt: '2026-08-14T09:20:00.000Z',
      data: { domain: 'bbc.co.uk', country: 'Japan' },
    }),
  ]
  const unrelated = ev({
    claim: 'Parliament approves budget after overnight vote in Ottawa',
    sourceKey: 'gdelt',
    publishedAt: '2026-08-14T08:00:00.000Z',
    data: { domain: 'cbc.ca', country: 'Canada' },
  })

  it('collapses one event reported four times into one story', () => {
    const stories = clusterStories([...quake, unrelated])
    expect(stories).toHaveLength(2)
    const main = stories.find((s) => s.reports.length === 3)!
    expect(main.reports).toHaveLength(3)
  })

  it('counts origins, not outlets — two outlets behind one index is one origin', () => {
    const stories = clusterStories([...quake, unrelated])
    const main = stories.find((s) => s.reports.length === 3)!
    // usgs_quakes + gdelt = 2 origins, although three mastheads are involved.
    expect(main.independentOrigins).toBe(2)
    expect(main.outlets).toBe(2)
  })

  it('takes its headline from the best-rated report, never inventing one', () => {
    const stories = clusterStories([...quake, unrelated])
    const main = stories.find((s) => s.reports.length === 3)!
    expect(main.headline).toBe('Magnitude 7.4 earthquake strikes off Tohoku coast, Japan')
  })

  it('reports when the story broke and when it was last updated', () => {
    const stories = clusterStories([...quake, unrelated])
    const main = stories.find((s) => s.reports.length === 3)!
    expect(main.firstReportedAt).toBe('2026-08-14T09:00:00.000Z')
    expect(main.lastReportedAt).toBe('2026-08-14T09:20:00.000Z')
  })

  it('calls an instrument reading confirmed, not merely corroborated', () => {
    const stories = clusterStories([...quake, unrelated])
    const main = stories.find((s) => s.reports.length === 3)!
    expect(main.grade).toBe('confirmed')
    expect(main.gradeReason).toMatch(/the record, not a report of it/)
  })

  it('calls a single-origin story what it is, however many outlets carried it', () => {
    const oneOrigin = [
      ev({ claim: 'Bank raises rate to four percent, governor says', data: { domain: 'ft.com' } }),
      ev({ claim: 'Rate raised to four percent by bank governor', data: { domain: 'wsj.com' } }),
    ]
    const [story] = clusterStories(oneOrigin)
    expect(story.independentOrigins).toBe(1)
    expect(story.outlets).toBe(2)
    expect(story.grade).toBe('unverified')
    expect(story.gradeReason).toMatch(/lead, not a fact/)
  })

  it('grades two independent origins as corroborated, and names them', () => {
    const two = [
      ev({ claim: 'Cholera outbreak declared in northern province', sourceKey: 'reliefweb', admiralty: { source: 'B', info: 2 } }),
      ev({ claim: 'Northern province declares cholera outbreak', sourceKey: 'gdelt' }),
    ]
    const [story] = clusterStories(two)
    expect(story.grade).toBe('corroborated')
    expect(story.gradeReason).toContain('reliefweb')
    expect(story.gradeReason).toContain('gdelt')
  })

  it('folds a wire and its republishers into one origin when told they share one', () => {
    const syndicated = [
      ev({ claim: 'Ceasefire agreed after two days of talks', sourceKey: 'outlet_a' }),
      ev({ claim: 'Two days of talks end in ceasefire agreement', sourceKey: 'outlet_b' }),
    ]
    const [story] = clusterStories(syndicated, {
      groups: { outlet_a: 'reuters-wire', outlet_b: 'reuters-wire' },
    })
    expect(story.independentOrigins).toBe(1)
    expect(story.grade).not.toBe('corroborated')
  })

  it('keeps identical wording apart when the reports are days apart', () => {
    const now = ev({ claim: 'Volcano erupts on the island, ash cloud rises', publishedAt: '2026-08-14T09:00:00.000Z' })
    const old = ev({ claim: 'Volcano erupts on the island, ash cloud rises', publishedAt: '2026-08-01T09:00:00.000Z' })
    expect(clusterStories([now, old])).toHaveLength(2)
  })

  it('does not strand an undated report — it has no time to be excluded by', () => {
    const dated = ev({ claim: 'Floods displace thousands in the delta region', publishedAt: '2026-08-14T09:00:00.000Z' })
    const undated = ev({ claim: 'Thousands displaced by delta region floods', sourceKey: 'wikipedia_itn', publishedAt: null })
    expect(clusterStories([dated, undated])).toHaveLength(1)
  })

  it('gives a story the same id across runs so the interface does not remount', () => {
    const a = clusterStories(quake)[0]
    const b = clusterStories([...quake].reverse())[0]
    expect(a.id).toBe(b.id)
    expect(a.id).toMatch(/^s_/)
  })

  it('gives different stories different ids', () => {
    const stories = clusterStories([...quake, unrelated])
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length)
  })

  it('ignores an empty claim rather than clustering on nothing', () => {
    expect(clusterStories([ev({ claim: '   ' })])).toEqual([])
  })

  it('returns nothing for nothing', () => {
    expect(clusterStories([])).toEqual([])
  })
})

describe('ordering a signals board', () => {
  const story = (over: Partial<Story>): Story => ({
    id: 's_x',
    headline: 'h',
    reports: [],
    independentOrigins: 1,
    outlets: 1,
    firstReportedAt: null,
    lastReportedAt: null,
    lastSeenAt: '2026-08-14T12:00:00.000Z',
    countries: [],
    bestSourceRating: 'C',
    grade: 'single-source',
    gradeReason: '',
    ...over,
  })

  it('puts a corroborated hour-old story above a single-source minute-old one', () => {
    // A board ordered purely by time leads with whatever a fast wire published
    // last, which is the wrong way round for anyone deciding from it.
    const fresh = story({ grade: 'single-source', lastReportedAt: '2026-08-14T11:59:00.000Z' })
    const solid = story({ grade: 'corroborated', independentOrigins: 3, lastReportedAt: '2026-08-14T11:00:00.000Z' })
    expect([fresh, solid].sort(storyOrder)[0]).toBe(solid)
  })

  it('breaks a tie on corroboration by how many origins reported it', () => {
    const two = story({ grade: 'corroborated', independentOrigins: 2 })
    const four = story({ grade: 'corroborated', independentOrigins: 4 })
    expect([two, four].sort(storyOrder)[0]).toBe(four)
  })

  it('does not treat an undated story as the newest', () => {
    const undated = story({ grade: 'corroborated', independentOrigins: 2, lastReportedAt: null })
    const dated = story({ grade: 'corroborated', independentOrigins: 2, lastReportedAt: '2026-08-14T10:00:00.000Z' })
    expect([undated, dated].sort(storyOrder)[0]).toBe(dated)
  })
})

describe('analysing the board', () => {
  it('says how much repetition it removed', () => {
    const stories = clusterStories([
      ev({ claim: 'Magnitude 7.4 earthquake strikes off Tohoku coast Japan', sourceKey: 'usgs_quakes', admiralty: { source: 'A', info: 1 } }),
      ev({ claim: 'Strong quake Tohoku Japan coast magnitude', sourceKey: 'gdelt' }),
      ev({ claim: 'Parliament approves budget after overnight vote Ottawa', sourceKey: 'gdelt' }),
    ])
    const a = analyseStories(stories, 3)
    expect(a.stories).toBe(2)
    expect(a.duplicatesCollapsed).toBe(1)
    expect(a.headline).toMatch(/2 distinct stories from 3 reports/)
    expect(a.headline).toMatch(/1 report was the same story seen again/)
  })

  it('states plainly how many stories nothing independent has confirmed', () => {
    const stories = clusterStories([ev({ claim: 'A single outlet reports an unusual troop movement' })])
    const a = analyseStories(stories, 1)
    expect(a.singleSource).toBe(1)
    expect(a.headline).toMatch(/rest on a single origin — leads, not facts/)
  })

  it('counts stories nobody dated, instead of pretending they are current', () => {
    const stories = clusterStories([
      ev({ claim: 'An undated entry about a border crossing', sourceKey: 'wikipedia_itn', publishedAt: null }),
    ])
    const a = analyseStories(stories, 1)
    expect(a.undated).toBe(1)
    expect(a.newestAt).toBeNull()
    expect(a.headline).toMatch(/carry no publication date/)
  })

  it('reports how far back the board reaches', () => {
    const stories = clusterStories([
      ev({ claim: 'Alpha incident at the northern crossing', publishedAt: '2026-08-14T09:00:00.000Z' }),
      ev({ claim: 'Beta unrelated matter concerning fisheries policy', publishedAt: '2026-08-13T09:00:00.000Z' }),
    ])
    const a = analyseStories(stories, 2)
    expect(a.oldestAt).toBe('2026-08-13T09:00:00.000Z')
    expect(a.newestAt).toBe('2026-08-14T09:00:00.000Z')
  })
})
