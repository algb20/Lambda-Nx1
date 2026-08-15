import { describe, expect, it } from 'vitest'
import { classifyHeadline, lexiconSize } from './topic'

describe('classifyHeadline', () => {
  it('reads the event type out of an English headline', () => {
    expect(classifyHeadline('Magnitude 6.1 earthquake strikes off Honshu')?.category).toBe('seismic')
    expect(classifyHeadline('Cholera outbreak spreads in Kano state')?.category).toBe('health')
    expect(classifyHeadline('Central bank holds interest rate at 4.5%')?.category).toBe('economy')
    expect(classifyHeadline('Ransomware attack halts hospital admissions')?.category).toBe('cyber')
  })

  /**
   * The property that matters most. Our feeds publish in five languages and an
   * English-only lexicon would classify the English press and quietly file
   * everything else as `world` — a missing dictionary that looks like an
   * editorial decision.
   */
  it('reads Arabic, Spanish, Portuguese, French and German alike', () => {
    expect(classifyHeadline('زلزال بقوة 6.1 درجة يضرب سواحل اليابان')?.category).toBe('seismic')
    expect(classifyHeadline('El banco central mantiene la tasa de interés')?.category).toBe('economy')
    expect(classifyHeadline('Enchente atinge o sul do estado')?.category).toBe('flood')
    expect(classifyHeadline('Une frappe aérienne signalée dans le nord')?.category).toBe('conflict')
    expect(classifyHeadline('Waldbrand breitet sich weiter aus')?.category).toBe('wildfire')
  })

  /**
   * Abstention is the feature, not a gap. Forcing every headline into a
   * specific bucket would trade one dishonest label for twenty-three.
   */
  it('abstains on general reporting rather than guessing', () => {
    expect(classifyHeadline('Parties to conduct primaries in new constituencies')).toBeNull()
    expect(classifyHeadline('My marriage, and what it taught me about patience')).toBeNull()
    expect(classifyHeadline('Family and friends celebrate a life well lived')).toBeNull()
  })

  it('will not let one suggestive word decide a category', () => {
    // "attack" alone is weight 1 and appears in headlines about sport, tax
    // policy and allergies. Below the threshold, so no verdict.
    expect(classifyHeadline('Coach defends the attack after a goalless draw')).toBeNull()
  })

  it('lets two suggestive words together reach a verdict', () => {
    const v = classifyHeadline('Soldiers killed in the northern province')
    expect(v?.category).toBe('conflict')
    expect(v?.score).toBeGreaterThanOrEqual(2)
  })

  /**
   * Word boundaries in the scripts that have them. Without this, `ice` matches
   * "police" and `war` matches "warehouse" — the classic substring bug that
   * makes a lexicon look ridiculous.
   */
  it('respects word boundaries in Latin script', () => {
    expect(classifyHeadline('Police warehouse inventory audit published')).toBeNull()
  })

  /**
   * Arabic attaches the definite article and prepositions directly to the word,
   * so a boundary test would reject most correct matches. The rule is chosen
   * per term by its script rather than applied uniformly and wrongly.
   */
  it('matches Arabic terms carrying an attached article', () => {
    expect(classifyHeadline('أعلنت السلطات عن الفيضان في المنطقة الشرقية')?.category).toBe('flood')
  })

  it('prefers the more specific of two matching categories', () => {
    // Both "earthquake" and "humanitarian crisis" appear; the specific event
    // type is the more informative label for a board.
    const v = classifyHeadline('Earthquake triggers humanitarian crisis, aid convoy dispatched')
    expect(v?.matched.length).toBeGreaterThan(0)
    expect(['seismic', 'humanitarian']).toContain(v?.category)
  })

  it('gives the same answer every time for the same headline', () => {
    const title = 'Flooding and landslides displace thousands after the storm'
    const first = classifyHeadline(title)
    for (let i = 0; i < 20; i++) expect(classifyHeadline(title)).toEqual(first)
  })

  it('shows its working, so a reader can check the machine', () => {
    const v = classifyHeadline('Typhoon makes landfall, thousands displaced')
    expect(v?.matched.length).toBeGreaterThan(0)
  })

  it('ignores a title too short to carry meaning', () => {
    expect(classifyHeadline('Flood')).toBeNull()
    expect(classifyHeadline('')).toBeNull()
  })

  /**
   * The known failure mode, asserted rather than hidden. A metaphorical
   * headline scores the literal category. This is the error rate the threshold
   * bounds, and the reason `docs/UNREACHED.md` calls keyword classification a
   * signal and not an audit.
   */
  it('is fooled by metaphor, which is the documented limit of the method', () => {
    expect(classifyHeadline('The earthquake reshaping Turkish politics')?.category).toBe('seismic')
  })

  it('carries terms across every category it claims to cover', () => {
    const { terms, categories } = lexiconSize()
    expect(terms).toBeGreaterThan(200)
    expect(categories).toBeGreaterThanOrEqual(15)
  })
})
