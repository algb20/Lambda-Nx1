"use client"

import { useState } from "react"

import { Moon, Sun, CreditCard, Languages, UserCircle2, Search, Bell } from "lucide-react"
import { SIDEBAR_WIDTH } from "@/lib/shell-width"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PostureBadge } from "@/components/posture-badge"
import { BrandMark } from "@/components/brand-mark"
import { useTheme } from "@/hooks/use-theme"
import { useI18n, CURATED_LOCALES, SUPPORTED_LOCALES, LOCALE_LABELS } from "@/lib/i18n"
import { usePiAuthOptional } from "@/contexts/pi-auth-context"
import { SUBSCRIPTION_VISIBLE } from "@/lib/plans/plans"
import { useViewer } from "@/hooks/use-viewer"
import { openCommandPalette } from "@/components/command-palette"
import { usePassiveWorldReport } from "@/hooks/use-world-report"
import { tierCounts } from "@/lib/world/tiers"
import { HeaderClock } from "@/components/header-clock"

/**
 * `onNavigate` exists for one reason: the "Pay with π" button used to do
 * nothing at all. It looked like the way to subscribe, and pressing it was a
 * dead end — the real checkout has always lived in Preferences. A control that
 * does nothing is worse than no control, because it teaches the user the app is
 * broken. Now it takes them where the payment actually happens.
 */
export function Header({
  onNavigate,
  /** Which tab is open, so the account button can mark itself current. */
  tab = 'home',
}: { onNavigate?: (tab: string) => void; tab?: string } = {}) {
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
  const { report } = usePassiveWorldReport()
  // Placed and unplaceable alike, the same population the Home cards count.
  const critical = report ? tierCounts(report.events.concat(report.unplaceable)).critical : null

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
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-full items-center gap-3 px-3 lg:px-0">
        {/* Brand, as wide as the sidebar beneath it (R338 reference design). */}
        <div className={`flex shrink-0 items-center gap-2.5 lg:px-4 ${SIDEBAR_WIDTH}`}>
          <BrandMark size={34} title="Lambda NX" className="text-primary" />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">
              Lambda <span className="text-primary">NX</span>
            </div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">{t('app.tagline')}</div>
          </div>
        </div>

        {/* One search for the product: opens the command palette (⌘K). */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search"
          className="hidden h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card/70 px-4 text-start text-sm text-muted-foreground transition-colors hover:border-primary/60 md:flex lg:max-w-3xl"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search anything… countries, companies, markets, events, assets</span>
          <kbd className="rounded border border-border px-1.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <div className="ms-auto flex items-center gap-1.5 pe-1 lg:pe-4">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Search"
            className="touch-target flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted md:hidden"
          >
            <Search className="h-4 w-4" />
          </button>
          <HeaderClock />
          <button
            type="button"
            onClick={() => onNavigate?.('situations')}
            aria-label="Critical events"
            title={critical === null ? 'Situations & alerts' : `${critical} critical events in the current sweep`}
            className="touch-target relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          >
            <Bell className="h-4 w-4" />
            {critical ? (
              <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                {critical > 99 ? '99+' : critical}
              </span>
            ) : null}
          </button>
            {/*
              The compliance claim, checked rather than asserted.

              This was a hardcoded green shield: the same words and the same
              colour whether the guardrail was enforcing anything or had been
              deleted. See `components/posture-badge` and `lib/security/posture`
              — it now probes the allowlist, the method rule and the licence
              gate on every load, and it is green on nothing less.
            */}
            <PostureBadge label={t('badge.passiveLawful')} />
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
                className="touch-target h-8 gap-1 px-2 text-xs"
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
                className="touch-target h-7 text-xs bg-accent/10 border-accent/20 hover:bg-accent/20"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">{t('header.pay')}</span> π
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="touch-target h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/*
              Preferences, in the corner where accounts live.

              It used to be the sixth button in the phone bar. Five destinations
              plus a settings screen is six cramped targets on a 360px phone, and
              settings is not a destination anyone navigates *to* — it is
              somewhere you go once and leave. Moving it here is what freed the
              bar to be five with the globe at its centre.

              Always rendered, signed in or out: it holds the language, the
              theme, the plan and the delete-my-account control, and a signed-out
              reader needs the first of those more than anyone.
            */}
            {onNavigate ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate('account')}
                aria-current={tab === 'account' ? 'page' : undefined}
                title={t('nav.preferences')}
                aria-label={t('nav.preferences')}
                className={`touch-target h-8 w-8 ${tab === 'account' ? 'text-primary' : ''}`}
              >
                <UserCircle2 className="h-4 w-4" />
              </Button>
            ) : null}
        </div>
      </div>
    </header>
  )
}
