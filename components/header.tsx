"use client"

import { Moon, Sun, Radar, ShieldCheck, CreditCard, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "@/hooks/use-theme"
import { useI18n, LOCALES, LOCALE_LABELS } from "@/lib/i18n"

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { locale, setLocale, t } = useI18n()

  const cycleLocale = () => {
    const i = LOCALES.indexOf(locale)
    setLocale(LOCALES[(i + 1) % LOCALES.length])
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radar className="h-6 w-6 text-primary" />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleLocale}
              className="h-8 gap-1 px-2 text-xs"
              title={LOCALE_LABELS[locale]}
            >
              <Languages className="h-4 w-4" />
              <span className="uppercase">{locale}</span>
            </Button>
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
