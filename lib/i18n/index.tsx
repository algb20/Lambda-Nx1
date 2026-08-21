'use client'

/**
 * i18n provider — locale state, translation lookup, and automatic RTL. Wraps the
 * app; any component calls useT()/useLocale(). The chosen locale is persisted and
 * the document direction (ltr/rtl) is set so Arabic and other RTL languages lay
 * out correctly without per-component work.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DICTIONARIES,
  LOCALES,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  isCurated,
  type Locale,
} from './dictionaries'

export { isCurated }

interface I18nValue {
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (l: Locale) => void
  /**
   * Translate a key. The second argument is either a plain fallback string or a
   * map of `{placeholder}` values to interpolate — a real requirement once a
   * sentence has to carry numbers and still read naturally in every language,
   * since word order differs and concatenation cannot express that.
   */
  t: (key: string, paramsOrFallback?: string | Record<string, string | number>) => string
  /**
   * Whether `t(key)` returned wording we wrote for *this* language.
   *
   * A component uses it to decide whether to shield the node from the runtime
   * translator: shield what we curated, let the machine handle the rest.
   */
  curated: (key: string) => boolean
}

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Any language the provider supports, not only the seven we hand-wrote.
 *
 * Three-letter codes are real — `ceb`, `haw`, `hmn` — so the old
 * `slice(0, 2)` silently turned Cebuano into `ce` and dropped it. A tagged
 * locale (`pt-BR`) keeps only its language part, which is what the translator
 * takes.
 */
function normalize(input: string | null | undefined): Locale {
  const raw = (input ?? '').trim().toLowerCase()
  const code = raw.split(/[-_]/)[0]
  if (SUPPORTED_LOCALES.includes(code)) return code
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  // Resolve the initial locale from storage, then the browser, on the client.
  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null
    const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
    setLocaleState(normalize(stored ?? nav))
  }, [])

  const dir: 'ltr' | 'rtl' = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
      document.documentElement.dir = dir
    }
  }, [locale, dir])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    if (typeof localStorage !== 'undefined') localStorage.setItem('locale', l)
  }, [])

  const t = useCallback(
    (key: string, paramsOrFallback?: string | Record<string, string | number>) => {
      const isFallback = typeof paramsOrFallback === 'string'
      const fallback = isFallback ? paramsOrFallback : undefined
      // English is the fallback locale: a missing translation shows real text
      // rather than a raw key, so a half-translated locale stays usable.
      const template = DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? fallback ?? key
      if (isFallback || !paramsOrFallback) return template
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = paramsOrFallback[name]
        return value === undefined ? match : String(value)
      })
    },
    [locale],
  )

  const curated = useCallback((key: string) => isCurated(locale, key), [locale])

  const value = useMemo<I18nValue>(
    () => ({ locale, dir, setLocale, t, curated }),
    [locale, dir, setLocale, t, curated],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

/** Convenience: just the translate function. */
export function useT(): (key: string, fallback?: string) => string {
  return useI18n().t
}

export { LOCALES, CURATED_LOCALES, SUPPORTED_LOCALES, LOCALE_LABELS } from './dictionaries'

/** Shield-aware translator: `t` for the words, `curated` for whether we wrote them. */
export function useCurated(): (key: string) => boolean {
  return useI18n().curated
}

/**
 * A translated label that shields itself correctly.
 *
 * Getting this right by hand at every call site is the kind of rule that holds
 * for a week: the node needs the translated string *and* `data-no-translate`
 * *and* that attribute must be present only when the string is curated for the
 * current language. Three facts, one of which is invisible in the markup.
 *
 * So it is one component. Pass the key; it does all three.
 *
 *   <Label k="mk.networks" className="text-sm font-semibold" />
 */
export function Label({
  k,
  className,
  as: Tag = 'span',
}: {
  k: string
  className?: string
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' | 'dt' | 'th'
}) {
  const { t, curated } = useI18n()
  return (
    <Tag data-no-translate={curated(k) || undefined} className={className}>
      {t(k)}
    </Tag>
  )
}
export type { Locale } from './dictionaries'
