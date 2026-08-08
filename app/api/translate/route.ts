import { NextResponse } from 'next/server'
import { LOCALES, type Locale } from '@/lib/i18n/dictionaries'
import { TranslationCache, batch, googleTranslate, isTranslatable } from '@/lib/i18n/translate'

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

  if (pendingTexts.length > 0) {
    const translatedByText = new Map<string, string>()
    for (const chunk of batch(pendingTexts)) {
      const out = await googleTranslate.translate(chunk, locale)
      chunk.forEach((source, i) => {
        const value = out[i] ?? source
        translatedByText.set(source, value)
        cache.set(source, locale, value)
      })
    }
    for (const i of pendingIndexes) {
      results[i] = translatedByText.get(texts[i]) ?? texts[i]
    }
  }

  return NextResponse.json({
    translations: results,
    // Useful when tuning: how much of a page cost a provider call.
    stats: { total: texts.length, fetched: pendingTexts.length, cached: cache.size },
  })
}
