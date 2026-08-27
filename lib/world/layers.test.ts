import { describe, expect, it } from 'vitest'
import { allLayers, hiddenCount, onlyLayer, toggleLayer } from './layers'
import { CATEGORY_META, type EventCategory } from '@/lib/modules/world-events-shared'

/** A run carrying three of the catalogue's kinds. */
const PRESENT: EventCategory[] = ['seismic', 'flood', 'cyber']
const CATALOGUE = Object.keys(CATEGORY_META) as EventCategory[]

describe('isolating one layer', () => {
  it('mutes the others', () => {
    expect(onlyLayer(PRESENT, 'seismic')).toEqual(['flood', 'cyber'])
  })

  it('leaves the kept category visible', () => {
    expect(onlyLayer(PRESENT, 'seismic')).not.toContain('seismic')
  })

  /**
   * The edge this module exists for.
   *
   * Muting the whole catalogue is the obvious implementation and produces a
   * rail claiming twenty-three hidden layers on a run that carried three — the
   * reader is told the map is heavily filtered at the moment it is showing
   * everything that arrived.
   */
  it('mutes only what this run carried, never the whole catalogue', () => {
    const muted = onlyLayer(PRESENT, 'seismic')
    expect(muted).toHaveLength(PRESENT.length - 1)
    expect(muted.length).toBeLessThan(CATALOGUE.length - 1)
    for (const c of muted) expect(PRESENT).toContain(c)
  })

  it('mutes nothing when the run carried one category', () => {
    expect(onlyLayer(['seismic'], 'seismic')).toEqual([])
  })

  it('is idempotent — isolating the same layer twice changes nothing', () => {
    const once = onlyLayer(PRESENT, 'flood')
    expect(onlyLayer(PRESENT, 'flood')).toEqual(once)
  })
})

describe('restoring every layer', () => {
  it('empties the muted set', () => {
    expect(allLayers()).toEqual([])
  })
})

describe('toggling one layer', () => {
  it('hides a visible category', () => {
    expect(toggleLayer([], 'seismic')).toEqual(['seismic'])
  })

  it('reveals a hidden one', () => {
    expect(toggleLayer(['seismic', 'flood'], 'seismic')).toEqual(['flood'])
  })

  it('does not disturb the rest', () => {
    expect(toggleLayer(['flood'], 'cyber')).toEqual(['flood', 'cyber'])
  })

  it('never returns the same array, so React sees the change', () => {
    const muted: EventCategory[] = ['flood']
    expect(toggleLayer(muted, 'cyber')).not.toBe(muted)
    expect(toggleLayer(muted, 'flood')).not.toBe(muted)
  })
})

describe('counting what is hidden', () => {
  it('counts the muted categories that are actually on screen', () => {
    expect(hiddenCount(PRESENT, ['seismic', 'flood'])).toBe(2)
  })

  /**
   * Preferences persist across runs; the world does not. A category muted
   * yesterday that reports nothing today is not something to offer to restore —
   * there is nothing behind it to reveal.
   */
  it('ignores a mute left over from a run that carried that category', () => {
    expect(hiddenCount(PRESENT, ['volcano', 'tsunami'])).toBe(0)
  })

  it('counts nothing when nothing is muted', () => {
    expect(hiddenCount(PRESENT, [])).toBe(0)
  })

  it('agrees with isolate: one visible means the rest are counted hidden', () => {
    const muted = onlyLayer(PRESENT, 'seismic')
    expect(hiddenCount(PRESENT, muted)).toBe(PRESENT.length - 1)
  })
})
