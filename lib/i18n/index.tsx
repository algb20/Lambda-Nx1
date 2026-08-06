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
  t: (key: string, fallback?: string) => string
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
    (key: string, fallback?: string) =>
      DICTIONARIES[locale]?.[key] ?? DICTIONARIES.en[key] ?? fallback ?? key,
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
