import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFS,
  MAX_HOME_GATEWAYS,
  PREFS_VERSION,
  parsePrefs,
  prefsEqual,
} from './schema'

/**
 * These are read from `localStorage` — a store the user can edit by hand, that
 * survives a deploy, and that will one day hold a shape this build has never
 * seen. Every one of these cases would otherwise be a white screen for a
 * stranger with no way back except clearing site data.
 */
describe('reading stored preferences', () => {
  it('returns defaults for nothing at all', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('not an object')).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(42)).toEqual(DEFAULT_PREFS)
  })

  it('keeps a valid blob intact', () => {
    const stored = {
      version: PREFS_VERSION,
      globe: {
        view: 'map',
        layer: 'coverage',
        muted: ['seismic', 'storm'],
        region: 'europe',
        windowHours: 24,
        panels: ['cyber', 'seismic'],
        panelSize: 'wide',
      },
      homeGateways: ['courts', 'resources'],
    }
    const prefs = parsePrefs(stored)
    expect(prefs.globe.view).toBe('map')
    expect(prefs.globe.muted).toEqual(['seismic', 'storm'])
    expect(prefs.globe.panelSize).toBe('wide')
    expect(prefs.homeGateways).toEqual(['courts', 'resources'])
  })

  /**
   * A blob from another generation is discarded rather than guessed at. This is
   * the one case where losing a preference is the right outcome — a half-read
   * shape is how `undefined` reaches code expecting an array.
   */
  it('discards a blob from a different version', () => {
    expect(parsePrefs({ version: 999, globe: { view: 'map' } })).toEqual(DEFAULT_PREFS)
    expect(parsePrefs({ globe: { view: 'map' } })).toEqual(DEFAULT_PREFS)
  })

  it('replaces a field of the wrong type with its default', () => {
    const prefs = parsePrefs({
      version: PREFS_VERSION,
      globe: { view: 7, layer: null, muted: 'seismic', region: {}, panelSize: 'enormous' },
      homeGateways: 'courts',
    })
    expect(prefs.globe.view).toBe('globe')
    expect(prefs.globe.layer).toBe(DEFAULT_PREFS.globe.layer)
    expect(prefs.globe.muted).toEqual([])
    expect(prefs.globe.region).toBe('all')
    expect(prefs.globe.panelSize).toBe('regular')
    expect(prefs.homeGateways).toEqual([])
  })

  /**
   * Without a cap, a hand-edited blob with fifty thousand entries renders fifty
   * thousand panels and hangs the tab.
   */
  it('caps the lists so a hand-edited blob cannot hang the page', () => {
    const many = Array.from({ length: 5000 }, (_, i) => `x${i}`)
    const prefs = parsePrefs({ version: PREFS_VERSION, globe: { panels: many, muted: many }, homeGateways: many })
    expect(prefs.homeGateways).toHaveLength(MAX_HOME_GATEWAYS)
    expect(prefs.globe.panels.length).toBeLessThanOrEqual(32)
    expect(prefs.globe.muted.length).toBeLessThanOrEqual(64)
  })

  /** Order is the preference for panels and pins, so it must not be sorted away. */
  it('preserves the order the user arranged, and drops duplicates', () => {
    const prefs = parsePrefs({
      version: PREFS_VERSION,
      globe: { panels: ['cyber', 'seismic', 'cyber', 'storm'] },
      homeGateways: ['grid', 'courts', 'grid'],
    })
    expect(prefs.globe.panels).toEqual(['cyber', 'seismic', 'storm'])
    expect(prefs.homeGateways).toEqual(['grid', 'courts'])
  })

  /**
   * A window of zero would filter every event away, and the product would read
   * as broken rather than as filtered.
   */
  it('refuses a time window that would hide everything', () => {
    expect(parsePrefs({ version: PREFS_VERSION, globe: { windowHours: 0 } }).globe.windowHours).toBeNull()
    expect(parsePrefs({ version: PREFS_VERSION, globe: { windowHours: -5 } }).globe.windowHours).toBeNull()
    expect(parsePrefs({ version: PREFS_VERSION, globe: { windowHours: NaN } }).globe.windowHours).toBeNull()
    expect(parsePrefs({ version: PREFS_VERSION, globe: { windowHours: 24 } }).globe.windowHours).toBe(24)
  })

  it('never returns a partial object, whatever it was given', () => {
    for (const junk of [null, {}, { version: PREFS_VERSION }, { version: PREFS_VERSION, globe: null }]) {
      const prefs = parsePrefs(junk)
      expect(Array.isArray(prefs.globe.muted)).toBe(true)
      expect(Array.isArray(prefs.globe.panels)).toBe(true)
      expect(Array.isArray(prefs.homeGateways)).toBe(true)
      expect(typeof prefs.globe.view).toBe('string')
    }
  })

  /** Defaults must be a fresh object each time, or one tab mutates another. */
  it('hands out its own copy, not the shared default', () => {
    const a = parsePrefs(null)
    a.globe.muted.push('seismic')
    expect(parsePrefs(null).globe.muted).toEqual([])
    expect(DEFAULT_PREFS.globe.muted).toEqual([])
  })

  it('knows when nothing changed, so a no-op is not saved', () => {
    expect(prefsEqual(parsePrefs(null), DEFAULT_PREFS)).toBe(true)
    const changed = parsePrefs(null)
    changed.globe.view = 'map'
    expect(prefsEqual(changed, DEFAULT_PREFS)).toBe(false)
  })
})
