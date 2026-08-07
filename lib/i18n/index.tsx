'use client'

/**
 * i18n provider — locale state, translation lookup, and automatic RTL. Wraps the
 * app; any component calls useT()/useLocale(). The chosen locale is persisted and
 * the document direction (ltr/rtl) is set so Arabic and other RTL languages lay
 * out correctly without per-component work.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DICTIONARIES, LOCALES, RTL_LOCALES, type Locale } from './dictionaries'

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
}

const I18nContext = createContext<I18nValue | null>(null)

function normalize(input: string | null | undefined): Locale {
  const code = (input ?? '').slice(0, 2).toLowerCase()
  return (LOCALES as readonly string[]).includes(code) ? (code as Locale) : 'en'
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

  const value = useMemo<I18nValue>(() => ({ locale, dir, setLocale, t }), [locale, dir, setLocale, t])
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

export { LOCALES, LOCALE_LABELS } from './dictionaries'
export type { Locale } from './dictionaries'
