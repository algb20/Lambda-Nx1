"use client"

import { useState } from "react"

import { Moon, Sun, ShieldCheck, CreditCard, Languages, UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BrandMark } from "@/components/brand-mark"
import { useTheme } from "@/hooks/use-theme"
import { useI18n, CURATED_LOCALES, SUPPORTED_LOCALES, LOCALE_LABELS } from "@/lib/i18n"
import { usePiAuthOptional } from "@/contexts/pi-auth-context"
import { SUBSCRIPTION_VISIBLE } from "@/lib/plans/plans"
import { useViewer } from "@/hooks/use-viewer"
import { shellContainerFor } from "@/lib/shell-width"

/**
 * `onNavigate` exists for one reason: the "Pay with π" button used to do
 * nothing at all. It looked like the way to subscribe, and pressing it was a
 * dead end — the real checkout has always lived in Preferences. A control that
 * does nothing is worse than no control, because it teaches the user the app is
 * broken. Now it takes them where the payment actually happens.
 */
export function Header({
  onNavigate,
  /**
   * Which tab is open, so the header shares the page's width instead of
   * keeping its own. It was `max-w-2xl` while the content had grown to `88rem`
   * — measured 80px out of alignment at 1440px and 208px at 1920px. See
   * lib/shell-width.ts.
   */
  tab = 'feed',
}: { onNavigate?: (tab: 'preferences') => void; tab?: string } = {}) {
  const { theme, toggleTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  // Optional because the header is shared by every surface. `pi.active`, not
  // `pi !== null`, is what says Pi is in play: the provider is mounted
  // everywhere now, so its presence alone would put a Pi guest badge in front
  // of web visitors who have no Pi account.
  const pi = usePiAuthOptional()
  /**
   * The name comes from the session first, and from the Pi handshake only as a
   * fallback while that handshake is still ahead of the session read.
   *
   * Reading Pi alone is what it used to do, and it meant an email-account
   * holder who was signed in saw no trace of it anywhere in the chrome — the
   * one place that is supposed to answer "am I signed in?".
   */
  const { user } = useViewer()
  const username = user?.username ?? pi?.userData?.username ?? null

  const [langOpen, setLangOpen] = useState(false)
  const [langQuery, setLangQuery] = useState('')

  /**
   * Which languages the list offers, and in what order.
   *
   * The curated seven lead because their strings are hand-written — chosen
   * wording, checked tone — and a machine translation of the same screen is a
   * step down. The other hundred and one follow in the order the labels are
   * declared, which groups them the way the file does.
   *
   * The filter reads both the English code and the label in its own script, so
   * a reader looking for their language finds it by typing it the way they
   * write it — `Deutsch` and `de` both reach German, `العربية` and `ar` both
   * reach Arabic. Matching only the code would ask every reader to know the
   * ISO-639 abbreviation for their own language before they can select it.
   */
  const orderedLocales = [
    ...CURATED_LOCALES,
    ...SUPPORTED_LOCALES.filter((c) => !(CURATED_LOCALES as readonly string[]).includes(c)),
  ]
  const q = langQuery.trim().toLowerCase()
  const shownLocales = q
    ? orderedLocales.filter(
        (c) => c.toLowerCase().includes(q) || (LOCALE_LABELS[c] ?? '').toLowerCase().includes(q),
      )
    : orderedLocales

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className={`${shellContainerFor(tab)} py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <BrandMark size={24} title="Lambda" className="text-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">Lambda</h1>
              <p className="text-[10px] text-muted-foreground leading-none">{t('app.tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:flex text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            >
              <ShieldCheck className="h-3 w-3 mr-1" />
              {t('badge.passiveLawful')}
            </Badge>
            {/* Who am I? Signing in and then seeing no trace of it is
                disorienting — and it is the only way to tell whether the
                features that need an account will work. */}
            {username ? (
              <span
                className="flex max-w-[7.5rem] items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                title={t('auth.signedInAs') + ' @' + username}
              >
                <UserCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">@{username}</span>
              </span>
            ) : pi?.active ? (
              <span
                className="hidden items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground sm:flex"
                title={t('auth.guestHint')}
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                {t('auth.guest')}
              </span>
            ) : null}
            {/* A searchable list, not a cycle button and not a bare list.
                It offered seven of the hundred and eight languages the product
                already defines — the other hundred were reachable only by
                editing a cookie. A hundred and eight in an unsearchable
                dropdown is its own kind of unreachable, so the seven curated
                ones lead and a filter finds the rest by name in either
                script. */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLangOpen((v) => !v)}
                className="h-8 gap-1 px-2 text-xs"
                title={LOCALE_LABELS[locale]}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
              >
                <Languages className="h-4 w-4" />
                <span className="uppercase">{locale}</span>
              </Button>
              {langOpen ? (
                <>
                  {/* Tapping anywhere else closes it — essential on touch, where
                      there is no blur to rely on. */}
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setLangOpen(false)}
                  />
                  <div className="absolute end-0 z-50 mt-1 w-56 max-w-[85vw] overflow-hidden rounded-md border border-border bg-card shadow-lg">
                    <input
                      autoFocus
                      value={langQuery}
                      onChange={(e) => setLangQuery(e.target.value)}
                      placeholder={t('lang.search')}
                      aria-label={t('lang.search')}
                      className="w-full border-b border-border bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
                    />
                  <ul
                    role="listbox"
                    className="max-h-72 overflow-y-auto overscroll-contain py-1"
                  >
                    {shownLocales.map((code) => (
                      <li key={code}>
                        <button
                          role="option"
                          aria-selected={code === locale}
                          onClick={() => {
                            setLocale(code)
                            setLangOpen(false)
                          }}
                          className={`flex min-h-[2.25rem] w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-xs transition-colors hover:bg-muted ${
                            code === locale ? "font-semibold text-primary" : "text-foreground"
                          }`}
                        >
                          <span className="truncate">{LOCALE_LABELS[code]}</span>
                          <span className="uppercase text-muted-foreground">{code}</span>
                        </button>
                      </li>
                    ))}
                    {shownLocales.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-muted-foreground">{t('lang.none')}</li>
                    ) : null}
                  </ul>
                  </div>
                </>
              ) : null}
            </div>
            {/* Hidden with the rest of the subscription surface (R273) — a
                button that leads to a price list nobody can see is a dead end,
                which is the exact fault this button was added to fix. */}
            {onNavigate && SUBSCRIPTION_VISIBLE ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('preferences')}
                title={t('header.pay.title')}
                className="h-7 text-xs bg-accent/10 border-accent/20 hover:bg-accent/20"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{t('header.pay')}</span> π
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
