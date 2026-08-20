import { describe, expect, it } from 'vitest'
import {
  NATURAL_HAZARD_CATEGORIES,
  hazardKind,
  isNaturalHazard,
  splitHazards,
} from './hazards'

/**
 * Thirteen of twenty-five categories are natural hazards, and they are the
 * highest-volume ones because the agencies publishing them are automated. That
 * is why they were felt as a wall of repeating weather rather than as
 * information.
 */
describe('the family', () => {
  it('gathers every natural hazard under one roof', () => {
    for (const c of ['seismic', 'volcano', 'tsunami', 'storm', 'flood', 'wildfire', 'drought']) {
      expect(isNaturalHazard(c)).toBe(true)
    }
  })

  /**
   * An industrial accident is a hazard and is not a natural one. Folding it in
   * would make the family mean "anything dangerous", which is not a category
   * anyone can reason about.
   */
  it('leaves the human categories out', () => {
    for (const c of ['manmade', 'conflict', 'cyber', 'economy', 'health', 'research']) {
      expect(isNaturalHazard(c)).toBe(false)
    }
  })

  it('is the thirteen we meant, not a moving target', () => {
    expect(NATURAL_HAZARD_CATEGORIES.size).toBe(13)
  })
})

describe('what happened versus what was warned about', () => {
  const at = (over: Partial<Parameters<typeof hazardKind>[0]> = {}) => ({
    title: 'Something',
    alertLevel: null,
    magnitude: null,
    ...over,
  })

  /** An agency setting an alert level is issuing a warning, by definition. */
  it('treats any agency alert level as a warning', () => {
    expect(hazardKind(at({ title: 'Cyclone Zena', alertLevel: 'Red' }))).toBe('warning')
    expect(hazardKind(at({ title: 'Anything at all', alertLevel: 'Green' }))).toBe('warning')
  })

  it('reads the publisher’s own wording', () => {
    expect(hazardKind(at({ title: 'Flood Warning issued August 20 at 1:06PM EDT' }))).toBe('warning')
    expect(hazardKind(at({ title: 'Severe Thunderstorm Watch for Ohio' }))).toBe('warning')
    expect(hazardKind(at({ title: 'Eastern North Pacific Tropical Weather Outlook' }))).toBe('warning')
  })

  /** Our readers get both languages; a split that only worked in one would be
   *  worse than none, because they would trust a division that was sometimes
   *  real. */
  it('reads Arabic warning wording too', () => {
    expect(hazardKind(at({ title: 'تحذير من ارتفاع درجات الحرارة في قبرص' }))).toBe('warning')
    expect(hazardKind(at({ title: 'إنذار بحدوث فيضانات' }))).toBe('warning')
    expect(hazardKind(at({ title: 'تنبيه من عواصف رعدية' }))).toBe('warning')
  })

  /** Nobody issues a magnitude to a population. */
  it('treats a measurement as an event', () => {
    expect(hazardKind(at({ title: 'M 6.9 - 15 km NNW of Pematangsiantar', magnitude: 6.9 }))).toBe(
      'event',
    )
    expect(hazardKind(at({ title: 'Water level 1.047 m at Providence' }))).toBe('event')
  })

  /**
   * The deliberate default. A real event hidden in a warnings list is a missed
   * event; a warning shown among events is merely untidy.
   */
  it('falls to event when nothing identifies it either way', () => {
    expect(hazardKind(at({ title: 'CENTRAL PERU' }))).toBe('event')
  })
})

describe('splitting a board', () => {
  it('returns both lists, never a filtered one', () => {
    const items = [
      { title: 'M 6.9 quake', alertLevel: null, magnitude: 6.9 },
      { title: 'Flood Warning issued', alertLevel: null, magnitude: null },
      { title: 'Cyclone', alertLevel: 'Red', magnitude: null },
      { title: 'Eruption at Etna', alertLevel: null, magnitude: null },
    ]
    const { events, warnings } = splitHazards(items)
    expect(events.map((e) => e.title)).toEqual(['M 6.9 quake', 'Eruption at Etna'])
    expect(warnings.map((e) => e.title)).toEqual(['Flood Warning issued', 'Cyclone'])
  })

  /**
   * A hazard surface must never hide a live warning from people who may be
   * under it, so nothing is dropped — only sorted.
   */
  it('loses nothing', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      title: i % 2 ? `Warning ${i}` : `M ${i}`,
      alertLevel: null,
      magnitude: null,
    }))
    const { events, warnings } = splitHazards(items)
    expect(events.length + warnings.length).toBe(50)
  })
})
