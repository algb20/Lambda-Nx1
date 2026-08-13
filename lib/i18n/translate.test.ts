import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BATCH_SIZE,
  TranslationCache,
  batch,
  googleTranslate,
  isTranslatable,
  parseTranslationResponse,
} from './translate'

afterEach(() => vi.unstubAllGlobals())

/**
 * The endpoint answers in different shapes depending on how many strings were
 * sent, and it is not versioned. Recognising neither must yield nothing, never
 * a mangled interface.
 */
describe('parseTranslationResponse', () => {
  it('reads a plain list, one entry per input', () => {
    expect(parseTranslationResponse(['مرحبا', 'وداعا'], 2)).toEqual(['مرحبا', 'وداعا'])
  })

  it('reads a nested list, one entry per input', () => {
    expect(parseTranslationResponse([['مرحبا'], ['وداعا']], 2)).toEqual(['مرحبا', 'وداعا'])
  })

  it('reassembles the segmented single-string shape', () => {
    const payload = [[['مرحبا ', 'Hello ', null], ['بالعالم', 'world', null]]]
    expect(parseTranslationResponse(payload, 1)).toEqual(['مرحبا بالعالم'])
  })

  it('returns null rather than a partial or wrong-length result', () => {
    expect(parseTranslationResponse(['only one'], 2)).toBeNull()
    expect(parseTranslationResponse(null, 1)).toBeNull()
    expect(parseTranslationResponse({ nope: true }, 1)).toBeNull()
    expect(parseTranslationResponse([[1], [2]], 2)).toBeNull()
  })
})

describe('isTranslatable — what must never be sent', () => {
  it('accepts real interface text', () => {
    expect(isTranslatable('Live world surface')).toBe(true)
    expect(isTranslatable('M 6.4 - 20km S of Tokyo')).toBe(true)
  })

  it('refuses text with no language in it', () => {
    expect(isTranslatable('42')).toBe(false)
    expect(isTranslatable('—')).toBe(false)
    expect(isTranslatable(' ')).toBe(false)
    expect(isTranslatable('12:30')).toBe(false)
    expect(isTranslatable('+1.2%')).toBe(false)
  })

  /** Translating an identifier turns a working label into a broken one. */
  it('refuses identifiers, URLs, grades and coordinates', () => {
    expect(isTranslatable('usgs_recent')).toBe(false)
    expect(isTranslatable('nasa-eonet')).toBe(false)
    expect(isTranslatable('lib.geo.atlas')).toBe(false)
    expect(isTranslatable('https://example.com/a')).toBe(false)
    expect(isTranslatable('A1')).toBe(false)
    expect(isTranslatable('35.60, 139.70')).toBe(false)
  })

  /*
   * These have no separator for the identifier rule to catch, so they read as
   * ordinary words to a translator and come back altered. Every one is a value
   * the user is expected to copy, paste or compare — and an altered one is worse
   * than an untranslated one: a mangled wallet address sends money nowhere and a
   * mangled hash matches nothing.
   */
  it('refuses an email address', () => {
    expect(isTranslatable('name@example.com')).toBe(false)
    expect(isTranslatable('a.b+c@sub.example.co.uk')).toBe(false)
  })

  it('refuses a hex digest — a hash, a commit, a fingerprint', () => {
    expect(isTranslatable('e632fd2')).toBe(false)
    expect(isTranslatable('0xdeadbeefcafe')).toBe(false)
    expect(
      isTranslatable('da39a3ee5e6b4b0d3255bfef95601890afd80709'),
    ).toBe(false)
  })

  it('refuses a wallet address', () => {
    expect(isTranslatable('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false)
    expect(isTranslatable('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(false)
  })

  it('refuses an ISO timestamp', () => {
    expect(isTranslatable('2026-08-13T02:07:38Z')).toBe(false)
    expect(isTranslatable('2026-08-13')).toBe(false)
    expect(isTranslatable('2026-08-13T02:07:38+03:00')).toBe(false)
  })

  /** The hardening must not start refusing ordinary sentences. */
  it('still accepts prose that merely contains such a value', () => {
    expect(isTranslatable('Reported at 2026-08-13T02:07:38Z by USGS')).toBe(true)
    expect(isTranslatable('Sent to name@example.com')).toBe(true)
    expect(isTranslatable('The seal is a fingerprint of the findings')).toBe(true)
  })
})

describe('TranslationCache', () => {
  it('stores and returns a translation per locale', () => {
    const c = new TranslationCache()
    c.set('Hello', 'ar', 'مرحبا')
    expect(c.get('Hello', 'ar')).toBe('مرحبا')
    // A different locale is a different entry, not a stale hit.
    expect(c.get('Hello', 'fr')).toBeUndefined()
  })

  it('evicts the least recently used once full', () => {
    const c = new TranslationCache(2)
    c.set('a', 'ar', '1')
    c.set('b', 'ar', '2')
    // Touching 'a' makes 'b' the oldest.
    c.get('a', 'ar')
    c.set('c', 'ar', '3')
    expect(c.get('a', 'ar')).toBe('1')
    expect(c.get('b', 'ar')).toBeUndefined()
    expect(c.get('c', 'ar')).toBe('3')
    expect(c.size).toBe(2)
  })
})

describe('batch', () => {
  it('splits into request-sized chunks and keeps order', () => {
    const items = Array.from({ length: 95 }, (_, i) => i)
    const chunks = batch(items)
    expect(chunks).toHaveLength(Math.ceil(95 / BATCH_SIZE))
    expect(chunks.flat()).toEqual(items)
  })

  it('handles an empty list', () => {
    expect(batch([])).toEqual([])
  })
})

describe('googleTranslate', () => {
  it('sends one q parameter per string and returns them in order', async () => {
    const spy = vi.fn(async (url: string) => {
      expect(url).toContain('tl=ar')
      expect((url.match(/&q=/g) ?? []).length).toBe(2)
      return { ok: true, json: async () => ['مرحبا', 'وداعا'] } as Response
    })
    vi.stubGlobal('fetch', spy)
    expect(await googleTranslate.translate(['Hello', 'Goodbye'], 'ar')).toEqual(['مرحبا', 'وداعا'])
  })

  /**
   * Every failure path returns the originals, one-for-one. The caller
   * substitutes positionally, so a short array would shift the whole interface.
   */
  it('falls back to the original text on every failure', async () => {
    const originals = ['Hello', 'Goodbye']

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => null }) as Response))
    expect(await googleTranslate.translate(originals, 'ar')).toEqual(originals)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ unexpected: true }) }) as Response),
    )
    expect(await googleTranslate.translate(originals, 'ar')).toEqual(originals)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    expect(await googleTranslate.translate(originals, 'ar')).toEqual(originals)
  })

  it('does not call the provider for an empty batch', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await googleTranslate.translate([], 'ar')).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})
