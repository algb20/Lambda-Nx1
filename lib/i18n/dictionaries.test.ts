import { describe, it, expect } from 'vitest'
import { DICTIONARIES, LOCALES, LOCALE_LABELS, RTL_LOCALES, type Locale } from './dictionaries'

const EN_KEYS = Object.keys(DICTIONARIES.en)

/**
 * A half-translated locale is worse than an untranslated one: the user picks
 * their language and still meets English at random. English is the declared
 * fallback, so nothing breaks — but the gap has to be visible here rather than
 * discovered by whoever is reading the screen.
 */
describe('dictionaries — every locale is complete', () => {
  it('ships more than a token number of strings', () => {
    expect(EN_KEYS.length).toBeGreaterThan(40)
  })

  for (const locale of LOCALES) {
    it(`${locale} translates every English key`, () => {
      const missing = EN_KEYS.filter((k) => !(k in DICTIONARIES[locale]))
      expect(missing, `${locale} is missing: ${missing.join(', ')}`).toEqual([])
    })

    it(`${locale} adds no key English does not have`, () => {
      // An orphan key is dead weight nothing renders.
      const extra = Object.keys(DICTIONARIES[locale]).filter((k) => !EN_KEYS.includes(k))
      expect(extra, `${locale} has orphans: ${extra.join(', ')}`).toEqual([])
    })

    it(`${locale} leaves no value empty`, () => {
      const blank = Object.entries(DICTIONARIES[locale])
        .filter(([, v]) => !v || !v.trim())
        .map(([k]) => k)
      expect(blank).toEqual([])
    })

    it(`${locale} keeps every {placeholder} the English string declares`, () => {
      // Dropping a placeholder in translation silently loses a number the
      // sentence was built to carry.
      const holders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort()
      for (const key of EN_KEYS) {
        expect(holders(DICTIONARIES[locale][key]), `${locale} → ${key}`).toEqual(
          holders(DICTIONARIES.en[key]),
        )
      }
    })

    it(`${locale} has a human-readable name in the picker`, () => {
      expect(LOCALE_LABELS[locale as Locale]?.length).toBeGreaterThan(1)
    })
  }
})

describe('dictionaries — direction', () => {
  it('marks Arabic right-to-left and the rest left-to-right', () => {
    expect(RTL_LOCALES.has('ar')).toBe(true)
    for (const l of LOCALES.filter((x) => x !== 'ar')) expect(RTL_LOCALES.has(l)).toBe(false)
  })
})

/**
 * The bug this catches, seen on a real screenshot: the navigation rail rendered
 * `nav.feed`, `nav.intelligence` and `nav.preferences` — the raw keys — to every
 * user in every language, for weeks. The fallback chain is designed so a missing
 * translation shows *English* rather than a key, and it works; what it cannot do
 * is invent a key that was never in the English dictionary either.
 *
 * So the check is against the navigation definitions rather than against a list
 * written here: a tab added without its label fails immediately, in English
 * first, which is where it would otherwise be least visible.
 */
describe('every navigation label exists', () => {
  it('has an English string for every tab, so nothing can fall back to a key', async () => {
    const { TAB_DEFS } = await import('@/lib/navigation')
    for (const tab of TAB_DEFS) {
      expect(DICTIONARIES.en[tab.i18nKey], `missing en: ${tab.i18nKey}`).toBeTruthy()
    }
  })

  it('translates every tab into every locale we claim to support', async () => {
    const { TAB_DEFS } = await import('@/lib/navigation')
    for (const locale of LOCALES) {
      for (const tab of TAB_DEFS) {
        expect(DICTIONARIES[locale][tab.i18nKey], `missing ${locale}: ${tab.i18nKey}`).toBeTruthy()
      }
    }
  })
})
