import { describe, expect, it } from 'vitest'
import {
  hasViewState,
  parseViewState,
  shareUrl,
  toCompleteSearch,
  toSearch,
  VIEW_KEYS,
  type GlobeViewState,
  type ViewDefaults,
} from './view-state'

const DEFAULTS: ViewDefaults = {
  mode: 'globe',
  layer: 'events',
  region: 'all',
  windowHours: null,
}

const view = (over: Partial<GlobeViewState> = {}): GlobeViewState => ({
  mode: 'globe',
  layer: 'events',
  region: 'all',
  windowHours: null,
  lat: null,
  lon: null,
  zoom: null,
  ...over,
})

describe('reading a shared link', () => {
  it('reads every field it understands', () => {
    const s = parseViewState(
      '?view=map&layer=latency&region=europe&window=24&lat=51.5000&lon=-0.1276&zoom=3.50',
      DEFAULTS,
    )
    expect(s).toEqual({
      mode: 'map',
      layer: 'latency',
      region: 'europe',
      windowHours: 24,
      lat: 51.5,
      lon: -0.1276,
      zoom: 3.5,
    })
  })

  it('falls back to the reader’s own settings when the link says nothing', () => {
    const mine: ViewDefaults = { mode: 'map', layer: 'coverage', region: 'asia', windowHours: 72 }
    const s = parseViewState('', mine)
    expect(s.mode).toBe('map')
    expect(s.layer).toBe('coverage')
    expect(s.region).toBe('asia')
    expect(s.windowHours).toBe(72)
    expect(s.lat).toBeNull()
  })

  /**
   * A shared link is typed, truncated, wrapped by a mail client and rewritten
   * by a chat app. Every one of these has to land on the reader's own setting
   * rather than on an error or on the attacker's value.
   */
  it('ignores a value outside its allowed set', () => {
    const s = parseViewState('?view=hologram&layer=<script>&window=99', DEFAULTS)
    expect(s.mode).toBe('globe')
    expect(s.layer).toBe('events')
    expect(s.windowHours).toBeNull()
  })

  it('ignores a region that could not be a key', () => {
    expect(parseViewState('?region=../../etc/passwd', DEFAULTS).region).toBe('all')
    expect(parseViewState('?region=' + 'x'.repeat(64), DEFAULTS).region).toBe('all')
  })

  /**
   * The region is deliberately *not* checked against the atlas: which regions
   * exist depends on the sweep that just ran, so a link shared an hour ago can
   * legitimately name one that is momentarily absent.
   */
  it('accepts a region key it has never heard of', () => {
    expect(parseViewState('?region=south_atlantic', DEFAULTS).region).toBe('south_atlantic')
  })

  it('rejects coordinates outside the earth', () => {
    const s = parseViewState('?lat=120&lon=999&zoom=0', DEFAULTS)
    expect(s.lat).toBeNull()
    expect(s.lon).toBeNull()
    expect(s.zoom).toBeNull()
  })

  it('rejects a coordinate that is not a number at all', () => {
    const s = parseViewState('?lat=NaN&lon=&zoom=abc', DEFAULTS)
    expect(s.lat).toBeNull()
    expect(s.lon).toBeNull()
    expect(s.zoom).toBeNull()
  })

  /**
   * `window=all` is "the filter is off", which is a different statement from a
   * very large window — and it is the one the surface prints.
   */
  it('reads window=all as the filter being off', () => {
    const mine: ViewDefaults = { ...DEFAULTS, windowHours: 24 }
    expect(parseViewState('?window=all', mine).windowHours).toBeNull()
  })

  it('reads a leading ? or none', () => {
    expect(parseViewState('layer=coverage', DEFAULTS).layer).toBe('coverage')
    expect(parseViewState('?layer=coverage', DEFAULTS).layer).toBe('coverage')
  })
})

describe('knowing whether the link said anything', () => {
  it('is false for an empty query and for unrelated parameters', () => {
    expect(hasViewState('')).toBe(false)
    expect(hasViewState('?utm_source=x&fbclid=y')).toBe(false)
  })

  it('is true as soon as one of our keys appears', () => {
    for (const key of VIEW_KEYS) expect(hasViewState(`?${key}=1`)).toBe(true)
  })
})

describe('writing a link', () => {
  /**
   * A URL that spells out every field is unreadable and pins settings the
   * sharer never chose. `?layer=latency` says one thing deliberately.
   */
  it('is empty when nothing differs from the defaults', () => {
    expect(toSearch(view(), DEFAULTS)).toBe('')
  })

  it('writes only what differs', () => {
    expect(toSearch(view({ layer: 'coverage' }), DEFAULTS)).toBe('?layer=coverage')
  })

  it('writes the filter being off as window=all', () => {
    const mine: ViewDefaults = { ...DEFAULTS, windowHours: 24 }
    expect(toSearch(view({ windowHours: null }), mine)).toBe('?window=all')
  })

  it('writes coordinates to four decimals and zoom to two', () => {
    const s = toSearch(view({ lat: 51.50735, lon: -0.12776, zoom: 3.14159 }), DEFAULTS)
    expect(s).toContain('lat=51.5074')
    expect(s).toContain('lon=-0.1278')
    expect(s).toContain('zoom=3.14')
  })

  /**
   * The property that makes sharing work at all: what the sharer sees is what
   * the recipient gets, for every field.
   */
  it('round-trips every field back to the same view', () => {
    const original = view({
      mode: 'map',
      layer: 'corroboration',
      region: 'africa',
      windowHours: 72,
      lat: -1.2921,
      lon: 36.8219,
      zoom: 2.5,
    })
    expect(parseViewState(toSearch(original, DEFAULTS), DEFAULTS)).toEqual(original)
  })

  /**
   * And it round-trips against *someone else's* defaults, which is the case
   * that actually matters — the recipient is not the sharer.
   */
  it('round-trips to the same view for a reader with different settings', () => {
    const mine: ViewDefaults = { mode: 'map', layer: 'coverage', region: 'asia', windowHours: 6 }
    const original = view({ mode: 'globe', layer: 'events', region: 'all', windowHours: null })
    const link = toSearch(original, mine)
    expect(parseViewState(link, mine)).toEqual(original)
  })
})

describe('the share link', () => {
  /**
   * The address bar and a share link want different things, and conflating them
   * is a real bug. If the sharer is on the events layer because that is the
   * product default, an abbreviated link shows the recipient *their* layer.
   */
  it('names every field, even the ones equal to the defaults', () => {
    const link = shareUrl('https://lambda.example', '/', view())
    expect(link).toContain('view=globe')
    expect(link).toContain('layer=events')
    expect(link).toContain('region=all')
    expect(link).toContain('window=all')
  })

  it('lands on the sharer’s view for a reader whose settings are different', () => {
    const theirs: ViewDefaults = { mode: 'map', layer: 'coverage', region: 'asia', windowHours: 6 }
    const mine = view({ mode: 'globe', layer: 'events', region: 'all', windowHours: null })
    const link = toCompleteSearch(mine)
    expect(parseViewState(link, theirs)).toEqual(mine)
  })

  it('joins origin and path', () => {
    expect(shareUrl('https://lambda.example', '/', view({ layer: 'latency' }))).toContain(
      'https://lambda.example/?',
    )
  })
})
