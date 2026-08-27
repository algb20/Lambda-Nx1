import { NextResponse } from 'next/server'
import { LOCALES, type Locale } from '@/lib/i18n/dictionaries'
import { TranslationCache, batch, isTranslatable, translateWithFallback } from '@/lib/i18n/translate'

/**
 * POST /api/translate { texts: string[], to: Locale }
 *
 * The server does the translating, not the browser, for three reasons: the
 * result is cached across every visitor instead of once per device, the provider
 * endpoint is never exposed to the page (so swapping it is invisible to the
 * client), and a page that renders in Arabic never has to reveal to a third
 * party which user is reading it.
 *
 * Strings are returned in the order they arrived, always one-for-one, so the
 * caller can substitute positionally without matching anything up.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** One cache per server instance. Translation is pure per (text, locale). */
const cache = new TranslationCache(20_000)

const MAX_TEXTS = 300
const MAX_LENGTH = 1_000

export async function POST(request: Request) {
  let body: { texts?: unknown; to?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const to = typeof body.to === 'string' ? body.to.slice(0, 5).toLowerCase() : ''
  if (!(LOCALES as readonly string[]).includes(to)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 })
  }
  const locale = to as Locale
  // English is the source language of the interface; nothing to do.
  if (locale === 'en') {
    const texts = Array.isArray(body.texts) ? body.texts : []
    return NextResponse.json({ translations: texts })
  }

  if (!Array.isArray(body.texts)) {
    return NextResponse.json({ error: 'texts must be an array' }, { status: 400 })
  }
  const texts = body.texts
    .slice(0, MAX_TEXTS)
    .map((t) => (typeof t === 'string' ? t.slice(0, MAX_LENGTH) : ''))

  // Work out what actually needs sending: skip the cached and the untranslatable.
  const results = new Array<string>(texts.length)
  const pendingIndexes: number[] = []
  const pendingTexts: string[] = []

  texts.forEach((text, i) => {
    if (!isTranslatable(text)) {
      results[i] = text
      return
    }
    const hit = cache.get(text, locale)
    if (hit !== undefined) {
      results[i] = hit
      return
    }
    // Two identical strings on a page are one request, not two.
    const existing = pendingTexts.indexOf(text)
    if (existing === -1) {
      pendingTexts.push(text)
    }
    pendingIndexes.push(i)
  })

  let provider: string | null = null
  let unavailable: string | null = null
  let translatedCount = 0

  if (pendingTexts.length > 0) {
    const translatedByText = new Map<string, string>()
    for (const chunk of batch(pendingTexts)) {
      const outcome = await translateWithFallback(chunk, locale)
      if (outcome.provider) {
        provider = outcome.provider
        chunk.forEach((source, i) => {
          const value = outcome.texts[i] ?? source
          translatedByText.set(source, value)
          /**
           * Only a real translation is cached.
           *
           * The previous version cached whatever came back — and what came back
           * when the provider refused was the English original. So one 429
           * pinned English under the Arabic key for the life of the instance,
           * and the interface stayed untranslated long after the provider had
           * recovered. Nothing expired it, because as far as the cache knew it
           * held a perfectly good Arabic string.
           */
          cache.set(source, locale, value)
        })
        translatedCount += chunk.length
      } else {
        unavailable = outcome.unavailable
        // The originals stand in, uncached, so the next request tries again.
        chunk.forEach((source) => translatedByText.set(source, source))
      }
    }
    for (const i of pendingIndexes) {
      results[i] = translatedByText.get(texts[i]) ?? texts[i]
    }
  }

  return NextResponse.json({
    translations: results,
    /**
     * `translated` is what was actually translated, not what was attempted.
     *
     * The field it replaces was `fetched`, and on 2026-08-27 the live
     * deployment reported `fetched: 2` beside two untranslated English strings.
     * A statistic that counts requests made rather than results obtained will
     * report a completely broken feature as a completely healthy one.
     */
    stats: { total: texts.length, translated: translatedCount, cached: cache.size, provider },
    ...(unavailable ? { unavailable } : {}),
  })
}
