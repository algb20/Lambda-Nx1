/**
 * The translation port.
 *
 * Hand-written dictionaries covered nine components out of twenty-odd, and every
 * new screen silently arrived in English only. Machine translation covers the
 * whole surface at once, including text the engine produced at runtime (event
 * titles, source names) that no dictionary could ever contain.
 *
 * The provider sits behind this interface for the usual reason (charter rule
 * #4): the endpoint is Google's today, and swapping it costs one file. The
 * dictionaries stay as the authoritative layer — a hand-written string always
 * wins over a machine one, because we control its wording and its tone.
 */
export interface TranslationProvider {
  readonly name: string
  /** False when the provider needs a credential this deployment does not have. */
  readonly available: () => boolean
  /**
   * Translate a batch. Returns exactly one result per input, in order.
   *
   * **Throws `TranslationUnavailableError` when it cannot translate.** It used
   * to return the originals instead, and that one decision hid the feature
   * being broken for as long as it was broken: on 2026-08-27 the live
   * deployment answered `/api/translate` with `HTTP 200`, the untranslated
   * English, and `stats.fetched: 2` — a claim to have fetched two translations
   * it had not fetched. The provider had been answering **429 "Sorry…"** to
   * every request, because Google's keyless endpoint refuses datacenter
   * addresses, which is what every serverless function has.
   *
   * A caller still substitutes positionally and still needs one result per
   * input — so the *caller* falls back to the original text. The difference is
   * that it now knows it is doing so, and can say so, and does not write the
   * English into the translation cache under an Arabic key.
   */
  translate(texts: string[], to: string, from?: string): Promise<string[]>
}

/**
 * A provider that could not translate. Not a bug and not an outage — usually
 * a rate limit or a missing credential — but never something to paper over.
 */
export class TranslationUnavailableError extends Error {
  constructor(
    readonly provider: string,
    readonly reason: string,
  ) {
    super(`${provider}: ${reason}`)
    this.name = 'TranslationUnavailableError'
  }
}

/** How many strings go in one request. Keeps URLs inside sane length limits. */
export const BATCH_SIZE = 40
const TIMEOUT_MS = 8_000

/**
 * Parse the translation endpoint's response.
 *
 * It answers in two different shapes depending on how many strings were sent —
 * a bare array of strings for several, and a nested structure for one — and it
 * is not versioned, so this is written to survive either and to return nothing
 * rather than garbage when it recognises neither.
 */
export function parseTranslationResponse(payload: unknown, expected: number): string[] | null {
  if (!Array.isArray(payload)) return null

  // Shape A: ["translated"] or [["a"], ["b"]] — one entry per input.
  if (payload.length === expected) {
    const out = payload.map((entry) => {
      if (typeof entry === 'string') return entry
      if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0]
      return null
    })
    if (out.every((v): v is string => typeof v === 'string')) return out
  }

  // Shape B (single input): [[["translated","original",…]],…]
  if (expected === 1 && Array.isArray(payload[0])) {
    const segments = payload[0]
      .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
    if (segments) return [segments]
  }

  return null
}

/**
 * Google's public translation endpoint. Keyless, and used the same way a browser
 * translate widget uses it. We send only interface strings and public content —
 * never anything a user typed privately.
 */
export const googleTranslate: TranslationProvider = {
  name: 'google-public',
  // Keyless: nothing to check, and nothing to be sure of either.
  available: () => true,
  async translate(texts: string[], to: string, from = 'auto'): Promise<string[]> {
    if (texts.length === 0) return []
    const params = new URLSearchParams({ client: 'gtx', sl: from, tl: to, dt: 't', ie: 'UTF-8', oe: 'UTF-8' })
    for (const text of texts) params.append('q', text)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/t?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new TranslationUnavailableError(
          'google-public',
          res.status === 429
            ? 'answered 429 — this endpoint refuses datacenter addresses, which is what a serverless function has'
            : `answered ${res.status}`,
        )
      }
      const parsed = parseTranslationResponse(await res.json().catch(() => null), texts.length)
      // Unparseable is a failure, not a result. A garbled interface is worse
      // than an untranslated one, and a silent one is worse than both.
      if (!parsed) throw new TranslationUnavailableError('google-public', 'answered in a shape it does not recognise')
      return parsed
    } catch (err) {
      if (err instanceof TranslationUnavailableError) throw err
      throw new TranslationUnavailableError('google-public', err instanceof Error ? err.message : 'request failed')
    } finally {
      clearTimeout(timer)
    }
  },
}

/**
 * Google's dictionary-extension endpoint. Keyless, and it works from a server.
 *
 * ## The correction this records
 *
 * An hour before this was written, this file said a keyless provider could not
 * work from a datacenter address and that a deployment therefore needed a paid
 * credential. That was wrong, and it was wrong because one endpoint had been
 * tested and generalised from.
 *
 * `translate.googleapis.com` with `client=gtx` **is** refused — 429, every
 * time, from every datacenter address tried. `clients5.google.com` with
 * `client=dict-chrome-ex` is not. Same company, same service, same absence of a
 * key; what differs is the host and the client string. Measured on 2026-08-27
 * from the same address that had just been refused:
 *
 * | Probe | Result |
 * |---|---|
 * | one string | `200` — `["الأحداث العالمية الحية"]` |
 * | batch of five | `200`, five results, in order |
 * | batch of forty (our `BATCH_SIZE`) | `200`, **40 of 40** |
 * | fr · zh-CN · hi · sw · ur · ja · yo · ta | `200` for all eight |
 * | ten consecutive calls | **10 of 10** |
 *
 * So it leads the chain: it costs nothing, needs no account, and is the one
 * measured to answer. The keyed providers below stay as a fallback for a
 * deployment that wants DeepL's phrasing or an address where even this is
 * refused — never as a requirement.
 *
 * `translate.google.com` with `client=at` also answers 200 keylessly and is
 * deliberately *not* used: given three strings it returned one. A provider that
 * silently returns fewer results than it was given would shift every label on
 * the page by one.
 */
export const googleFreeTranslate: TranslationProvider = {
  name: 'google-free',
  available: () => true,
  async translate(texts: string[], to: string, from = 'auto'): Promise<string[]> {
    if (texts.length === 0) return []
    const params = new URLSearchParams({ client: 'dict-chrome-ex', sl: from, tl: to })
    for (const text of texts) params.append('q', text)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`https://clients5.google.com/translate_a/t?${params.toString()}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new TranslationUnavailableError('google-free', `answered ${res.status}`)
      /**
       * Its answer is `[["translated","detectedLang"], …]` — a pair per input.
       * `parseTranslationResponse` already reads the first element of a nested
       * entry, which is the translation, so the same parser covers this shape
       * and the two the other endpoint returns.
       */
      const parsed = parseTranslationResponse(await res.json().catch(() => null), texts.length)
      if (!parsed) throw new TranslationUnavailableError('google-free', 'answered in a shape it does not recognise')
      return parsed
    } catch (err) {
      if (err instanceof TranslationUnavailableError) throw err
      throw new TranslationUnavailableError('google-free', err instanceof Error ? err.message : 'request failed')
    } finally {
      clearTimeout(timer)
    }
  },
}

/**
 * DeepL, with a key. 500,000 characters a month on the free tier.
 *
 * **Optional, and deliberately not first.** The keyless provider above is
 * measured to work, so nothing here is required to translate the product —
 * requiring a credit card for a language toggle would be the wrong trade for
 * every reader who does not have one.
 *
 * It stays because two providers are better than one and because DeepL phrases
 * some languages better than Google does. A deployment that sets the key gets
 * it as the fallback when the keyless path is refused. It sits behind the same
 * interface as the rest (charter rule #4) — swapping it costs this constant.
 */
export const deeplTranslate: TranslationProvider = {
  name: 'deepl',
  available: () => Boolean(process.env.DEEPL_API_KEY?.trim()),
  async translate(texts: string[], to: string): Promise<string[]> {
    if (texts.length === 0) return []
    const key = process.env.DEEPL_API_KEY?.trim() ?? ''
    // Free keys end in `:fx` and live on a different host from paid ones. A
    // paid key sent to the free host is rejected, and vice versa.
    const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'
    const body = new URLSearchParams()
    for (const text of texts) body.append('text', text)
    body.set('target_lang', deeplTarget(to))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`https://${host}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new TranslationUnavailableError(
          'deepl',
          res.status === 456 ? 'the month’s character quota is spent' : `answered ${res.status}`,
        )
      }
      const payload = (await res.json().catch(() => null)) as { translations?: Array<{ text?: string }> } | null
      const out = payload?.translations?.map((t) => t.text)
      if (!out || out.length !== texts.length || out.some((t) => typeof t !== 'string')) {
        throw new TranslationUnavailableError('deepl', 'returned a different number of strings than it was given')
      }
      return out as string[]
    } catch (err) {
      if (err instanceof TranslationUnavailableError) throw err
      throw new TranslationUnavailableError('deepl', err instanceof Error ? err.message : 'request failed')
    } finally {
      clearTimeout(timer)
    }
  },
}

/**
 * DeepL wants an upper-case code, and two of them carry a region it insists on.
 *
 * `EN` and `PT` are ambiguous to it and rejected outright; the rest of our
 * codes map straight through. Anything DeepL does not support fails the request
 * honestly rather than silently returning the source text.
 */
export function deeplTarget(locale: string): string {
  const base = locale.split('-')[0].toUpperCase()
  if (base === 'EN') return 'EN-GB'
  if (base === 'PT') return 'PT-PT'
  if (base === 'ZH') return 'ZH'
  return base
}

/**
 * Google Cloud Translation, with a key. 500,000 characters a month free.
 *
 * The alternative to DeepL, and the one to prefer for reach: it covers every
 * language in `LOCALE_LABELS`, where DeepL covers about thirty. A deployment
 * that sets both gets DeepL's quality where DeepL has the language and Google's
 * coverage everywhere else — which is what the chain below does.
 */
export const googleCloudTranslate: TranslationProvider = {
  name: 'google-cloud',
  available: () => Boolean(process.env.GOOGLE_TRANSLATE_API_KEY?.trim()),
  async translate(texts: string[], to: string): Promise<string[]> {
    if (texts.length === 0) return []
    const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim() ?? ''
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: texts, target: to.split('-')[0], format: 'text' }),
        signal: controller.signal,
      })
      if (!res.ok) throw new TranslationUnavailableError('google-cloud', `answered ${res.status}`)
      const payload = (await res.json().catch(() => null)) as
        | { data?: { translations?: Array<{ translatedText?: string }> } }
        | null
      const out = payload?.data?.translations?.map((t) => t.translatedText)
      if (!out || out.length !== texts.length || out.some((t) => typeof t !== 'string')) {
        throw new TranslationUnavailableError('google-cloud', 'returned a different number of strings than it was given')
      }
      return out as string[]
    } catch (err) {
      if (err instanceof TranslationUnavailableError) throw err
      throw new TranslationUnavailableError('google-cloud', err instanceof Error ? err.message : 'request failed')
    } finally {
      clearTimeout(timer)
    }
  },
}

/**
 * The providers this deployment can actually use, in the order they are tried.
 *
 * **Keyless first**, because the keyless one is measured to work and because a
 * language toggle that demands a credit card is not a language toggle. The
 * keyed providers follow as a fallback for the deployment that wants them or
 * the address where even `clients5` is refused, and the original `gtx` endpoint
 * trails as a last resort: it is measured to answer 429 from a datacenter, but
 * it costs nothing to ask, and there are addresses where the opposite is true.
 *
 * That ordering also means a deployment with a DeepL key does not spend a
 * character of its monthly allowance until it needs to.
 */
export function activeProviders(
  all: TranslationProvider[] = [googleFreeTranslate, deeplTranslate, googleCloudTranslate, googleTranslate],
): TranslationProvider[] {
  return all.filter((p) => p.available())
}

export interface TranslationOutcome {
  /** One per input, in order. Originals where nothing could translate them. */
  texts: string[]
  /** Which provider answered, or `null` when none did. */
  provider: string | null
  /** Why translation is unavailable, when it is. One line, per provider tried. */
  unavailable: string | null
}

/**
 * Try each provider in turn; report which one answered.
 *
 * Never throws: the interface must render either way. What it does instead is
 * say, in `provider` and `unavailable`, which of the two happened — so a
 * surface can show the reader "not translated" rather than quietly showing them
 * English and letting them conclude the feature does not exist.
 */
export async function translateWithFallback(
  texts: string[],
  to: string,
  providers: TranslationProvider[] = activeProviders(),
): Promise<TranslationOutcome> {
  if (texts.length === 0) return { texts: [], provider: null, unavailable: null }
  if (providers.length === 0) {
    return {
      texts,
      provider: null,
      unavailable: 'no translation provider is available at all',
    }
  }

  const refusals: string[] = []
  for (const provider of providers) {
    try {
      const out = await provider.translate(texts, to)
      if (out.length === texts.length) return { texts: out, provider: provider.name, unavailable: null }
      refusals.push(`${provider.name}: returned ${out.length} of ${texts.length}`)
    } catch (err) {
      refusals.push(err instanceof Error ? err.message : `${provider.name}: failed`)
    }
  }
  return { texts, provider: null, unavailable: refusals.join('; ') }
}

/**
 * A bounded cache. Translation is pure for a given (text, locale), so the same
 * string is never paid for twice; the bound stops a long-running server from
 * growing without limit.
 */
export class TranslationCache {
  private map = new Map<string, string>()

  constructor(private readonly max = 5_000) {}

  static key(text: string, locale: string): string {
    return `${locale} ${text}`
  }

  get(text: string, locale: string): string | undefined {
    const k = TranslationCache.key(text, locale)
    const hit = this.map.get(k)
    // Refresh recency so the entries in active use are the ones that survive.
    if (hit !== undefined) {
      this.map.delete(k)
      this.map.set(k, hit)
    }
    return hit
  }

  set(text: string, locale: string, value: string): void {
    const k = TranslationCache.key(text, locale)
    if (this.map.has(k)) this.map.delete(k)
    this.map.set(k, value)
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  get size(): number {
    return this.map.size
  }
}

/**
 * Strings that must never be sent for translation, because translating them
 * breaks meaning rather than conveying it: pure numbers and measurements, code
 * and identifiers, URLs, and anything too short to carry meaning on its own.
 */
export function isTranslatable(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 2) return false
  // Must contain at least one letter — "42", "12:30", "—" carry no language.
  if (!/\p{L}/u.test(trimmed)) return false
  if (/^https?:\/\//i.test(trimmed)) return false
  // Identifiers: source keys, snake_case, kebab-case, dotted paths, domains.
  if (/^[a-z0-9]+([._-][a-z0-9]+)+$/i.test(trimmed)) return false
  // A lone Admiralty grade or coordinate pair.
  if (/^[A-F][1-6]$/.test(trimmed)) return false
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed)) return false

  /*
   * The rest are identifiers whose shape has no separators for the rule above
   * to catch, so they read as ordinary words to a translator and come back
   * altered. Every one of them is a value the user is expected to copy, paste
   * or compare, and an altered one is worse than an untranslated one: a mangled
   * wallet address sends money nowhere, and a mangled hash matches nothing.
   */

  // An email address. The "@" is not a separator the identifier rule accepts.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false

  // A hex digest — a file hash, a commit, a fingerprint.
  if (/^(0x)?[0-9a-f]{7,}$/i.test(trimmed)) return false

  // A base58/bech32-shaped wallet address. Long, mixed-case, no spaces.
  if (/^(bc1|tb1|[13])[a-km-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) return false
  if (/^[A-Za-z0-9]{32,60}$/.test(trimmed) && !/\s/.test(trimmed)) return false

  // An ISO timestamp. The "T" and "Z" make it look like prose to a translator.
  if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+)?(Z|[+-]\d{2}:?\d{2})?$/.test(trimmed)) return false

  return true
}

/** Split a list into request-sized batches. */
export function batch<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
