"use client"

import { useState } from "react"

import { Moon, Sun, ShieldCheck, CreditCard, Languages, UserCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BrandMark } from "@/components/brand-mark"
import { useTheme } from "@/hooks/use-theme"
import { useI18n, LOCALES, LOCALE_LABELS } from "@/lib/i18n"
import { usePiAuthOptional } from "@/contexts/pi-auth-context"

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()
  // Optional: standalone mode mounts no Pi provider, and the header is shared.
  const pi = usePiAuthOptional()
  const username = pi?.userData?.username ?? null

  const [langOpen, setLangOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <BrandMark size={24} title="Lambda NX" className="text-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">Lambda NX</h1>
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
            ) : pi ? (
              <span
                className="hidden items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground sm:flex"
                title={t('auth.guestHint')}
              >
                <UserCircle2 className="h-3.5 w-3.5" />
                {t('auth.guest')}
              </span>
            ) : null}
            {/* A list, not a cycle button: with seven locales, "press until
                your language comes round" is not a way to choose one. */}
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
                  <ul
                    role="listbox"
                    className="absolute end-0 z-50 mt-1 min-w-[9rem] overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg"
                  >
                    {LOCALES.map((code) => (
                      <li key={code}>
                        <button
                          role="option"
                          aria-selected={code === locale}
                          onClick={() => {
                            setLocale(code)
                            setLangOpen(false)
                          }}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted ${
                            code === locale ? "font-semibold text-primary" : "text-foreground"
                          }`}
                        >
                          <span>{LOCALE_LABELS[code]}</span>
                          <span className="uppercase text-muted-foreground">{code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-accent/10 border-accent/20 hover:bg-accent/20"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Pay with</span> π
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
