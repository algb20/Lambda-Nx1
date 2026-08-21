import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CURATED_LOCALES,
  DICTIONARIES,
  LOCALE_LABELS,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
} from './dictionaries'

/**
 * The shield against double-translation, and the trap inside it.
 *
 * `AutoTranslate` rewrites every text node on the page. That is right for
 * content the engine produced and wrong for a label the dictionary already
 * translated on purpose — it turned `الإعدادات` into `جحيم` ("hell"),
 * `مراقبة` into `حمى` ("fever") and `Movers` into `شركات نقل الأثاث`
 * (furniture removal companies).
 *
 * The obvious fix — mark those nodes `data-no-translate` — is only half right.
 * Applied unconditionally it protects the seven curated languages and freezes
 * the other hundred in English forever, which is the exact opposite of opening
 * the product to every language. So the shield is conditional, and these tests
 * hold that condition in place.
 */

describe('every language is offered, not only the ones we hand-wrote', () => {
  it('offers far more languages than it curates', () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(100)
    expect(CURATED_LOCALES.length).toBeLessThan(SUPPORTED_LOCALES.length)
  })

  it('offers every curated language too', () => {
    for (const locale of CURATED_LOCALES) {
      expect(SUPPORTED_LOCALES, `${locale} is curated but not offered`).toContain(locale)
    }
  })

  /**
   * A speaker scans the list for how *they* write their language, not for what
   * English calls it. A list of English names is a list they cannot search.
   */
  it('labels every language in its own script', () => {
    for (const code of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[code], `${code} has no label`).toBeTruthy()
    }
    expect(LOCALE_LABELS.de).toBe('Deutsch')
    expect(LOCALE_LABELS.ja).toBe('日本語')
    expect(LOCALE_LABELS.fa).toBe('فارسی')
  })

  /**
   * Opening the product to every language means every right-to-left language,
   * not only Arabic. A mirrored layout is not a nicety for these readers.
   */
  it('mirrors the layout for every right-to-left language it offers', () => {
    for (const code of ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi']) {
      expect(RTL_LOCALES.has(code), `${code} must be RTL`).toBe(true)
    }
    expect(RTL_LOCALES.has('en')).toBe(false)
    expect(RTL_LOCALES.has('ja')).toBe(false)
  })
})

describe('isCurated decides the shield, and it must be per-language', () => {
  it('is true only where we actually wrote the words', async () => {
    const { isCurated } = await import('./dictionaries')
    // Arabic has a hand-written label for the account tab.
    expect(isCurated('ar', 'nav.preferences')).toBe(true)
    // Turkish does not, and must therefore be machine-translated rather than
    // shielded — shielding it would leave a Turkish reader with English.
    expect(isCurated('tr', 'nav.preferences')).toBe(false)
    expect(isCurated('sw', 'mk.movers')).toBe(false)
  })

  it('is false for a key nobody has written in any language', async () => {
    const { isCurated } = await import('./dictionaries')
    expect(isCurated('ar', 'nothing.here')).toBe(false)
  })
})

describe('the finance glossary exists in every curated language', () => {
  /**
   * The terms a machine translator gets wrong on a markets page. "Movers" is
   * the proof: an isolated two-word label with no context became furniture
   * removal companies on the live site.
   */
  const TERMS = ['mk.movers', 'mk.networks', 'mk.rates', 'mk.currencies', 'mk.exchanges']

  it.each(CURATED_LOCALES)('%s carries every finance term', (locale) => {
    for (const term of TERMS) {
      expect(DICTIONARIES[locale]?.[term], `${locale} is missing ${term}`).toBeTruthy()
    }
  })

  it('says "Movers" in Arabic as a market term, not a removal company', () => {
    expect(DICTIONARIES.ar['mk.movers']).toBe('أكبر التحركات')
  })
})

describe('no component shields unconditionally', () => {
  /**
   * A bare `data-no-translate` on a translated label is the bug this whole
   * file is about: correct for the curated seven, permanently English for
   * everyone else. Every shield must be conditional, or come from `Label`,
   * which is conditional by construction.
   */
  const FILES = [
    'components/side-nav.tsx',
    'components/bottom-nav.tsx',
    'components/markets-panel.tsx',
  ]

  it.each(FILES)('%s never hard-codes the shield on a translated label', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8')
      // Comments explain the rule and name the attribute; only code can break it.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    // `data-no-translate` with no `={...}` is the unconditional form.
    const bare = source.match(/data-no-translate(?!=)/g) ?? []
    expect(bare, `${file} shields ${bare.length} node(s) unconditionally`).toHaveLength(0)
  })
})
