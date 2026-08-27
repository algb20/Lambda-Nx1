import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BATCH_SIZE,
  TranslationCache,
  batch,
  googleTranslate,
  TranslationUnavailableError,
  translateWithFallback,
  deeplTarget,
  activeProviders,
  type TranslationProvider,
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
   * This test used to assert the opposite — "falls back to the original text on
   * every failure" — and that assertion is what kept the feature broken.
   *
   * The reasoning behind it was half right: the caller substitutes
   * positionally, so a short array would shift the whole interface. But
   * "always return one string per input" and "never say you failed" are
   * different promises, and only the first was needed. Returning the originals
   * *silently* meant that on 2026-08-27 the live deployment answered
   * `/api/translate` with `HTTP 200`, untranslated English, and a claim to have
   * fetched two translations — while the provider had been answering **429** to
   * every request for as long as anyone could tell. Nothing in the product,
   * the tests, or the health checks could see it.
   *
   * The caller still falls back. It now knows that it is.
   */
  it('refuses out loud instead of quietly handing back English', async () => {
    const originals = ['Hello', 'Goodbye']

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => null }) as Response))
    await expect(googleTranslate.translate(originals, 'ar')).rejects.toThrow(TranslationUnavailableError)

    // The 429 is the measured one, so its reason names what it actually means.
    await expect(googleTranslate.translate(originals, 'ar')).rejects.toThrow(/datacenter/)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ unexpected: true }) }) as Response),
    )
    await expect(googleTranslate.translate(originals, 'ar')).rejects.toThrow(/shape/)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(googleTranslate.translate(originals, 'ar')).rejects.toThrow(/network down/)
  })

  it('does not call the provider for an empty batch', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await googleTranslate.translate([], 'ar')).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})

/**
 * The chain exists because the keyless provider is **measured not to work from
 * a server**. On 2026-08-27, from a datacenter address, Google's public
 * endpoint answered 429 to every request; MyMemory's shared daily quota was
 * already spent; three Lingva instances answered 500; LibreTranslate's public
 * host returned HTML. That is structural — those endpoints exist for browsers,
 * and this product translates on the server deliberately.
 */
describe('translateWithFallback', () => {
  const provider = (name: string, impl: TranslationProvider['translate']): TranslationProvider => ({
    name,
    available: () => true,
    translate: impl,
  })
  const works = (name: string) => provider(name, async (texts) => texts.map((t) => `[${name}] ${t}`))
  const refuses = (name: string) =>
    provider(name, async () => {
      throw new TranslationUnavailableError(name, 'answered 429')
    })

  it('names the provider that answered', async () => {
    const out = await translateWithFallback(['Hello'], 'ar', [works('deepl')])
    expect(out.provider).toBe('deepl')
    expect(out.texts).toEqual(['[deepl] Hello'])
    expect(out.unavailable).toBeNull()
  })

  it('moves to the next provider when one refuses', async () => {
    const out = await translateWithFallback(['Hello'], 'ar', [refuses('deepl'), works('google-cloud')])
    expect(out.provider).toBe('google-cloud')
  })

  /**
   * The interface must render either way — so this never throws. What it must
   * not do is let the caller believe it translated.
   */
  it('returns the originals and says why when every provider refuses', async () => {
    const out = await translateWithFallback(['Hello'], 'ar', [refuses('deepl'), refuses('google-public')])
    expect(out.texts).toEqual(['Hello'])
    expect(out.provider, 'a null provider is what tells the caller not to cache this').toBeNull()
    expect(out.unavailable).toContain('deepl')
    expect(out.unavailable).toContain('google-public')
  })

  it('says plainly when there is no provider at all', async () => {
    const out = await translateWithFallback(['Hello'], 'ar', [])
    expect(out.provider).toBeNull()
    expect(out.unavailable, 'the operator needs the variable name, not a shrug').toMatch(/DEEPL_API_KEY/)
  })

  /**
   * A provider that returns the wrong number of strings would shift every
   * label on the page by one. It is rejected as a refusal, not trusted.
   */
  it('rejects a provider that returns the wrong number of strings', async () => {
    const short = provider('short', async () => ['only one'])
    const out = await translateWithFallback(['a', 'b'], 'ar', [short, works('good')])
    expect(out.provider).toBe('good')
  })

  it('does not call a provider for an empty batch', async () => {
    const spy = vi.fn()
    const out = await translateWithFallback([], 'ar', [provider('x', spy)])
    expect(out.texts).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('a provider is only offered when its credential exists', () => {
  it('leaves out the keyed providers when no key is set', () => {
    const before = { deepl: process.env.DEEPL_API_KEY, google: process.env.GOOGLE_TRANSLATE_API_KEY }
    delete process.env.DEEPL_API_KEY
    delete process.env.GOOGLE_TRANSLATE_API_KEY
    try {
      expect(activeProviders().map((p) => p.name)).toEqual(['google-public'])
    } finally {
      if (before.deepl) process.env.DEEPL_API_KEY = before.deepl
      if (before.google) process.env.GOOGLE_TRANSLATE_API_KEY = before.google
    }
  })

  it('puts the keyed provider first, because it is the one that works from a server', () => {
    const before = process.env.DEEPL_API_KEY
    process.env.DEEPL_API_KEY = 'test-key:fx'
    try {
      expect(activeProviders().map((p) => p.name)).toEqual(['deepl', 'google-public'])
    } finally {
      if (before) process.env.DEEPL_API_KEY = before
      else delete process.env.DEEPL_API_KEY
    }
  })
})

describe('deeplTarget', () => {
  /** DeepL rejects a bare EN or PT outright; the rest map straight through. */
  it('supplies the region DeepL insists on', () => {
    expect(deeplTarget('en')).toBe('EN-GB')
    expect(deeplTarget('pt')).toBe('PT-PT')
  })

  it('upper-cases everything else and drops our region suffix', () => {
    expect(deeplTarget('ar')).toBe('AR')
    expect(deeplTarget('zh-CN')).toBe('ZH')
  })
})
