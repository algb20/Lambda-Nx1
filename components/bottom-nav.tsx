"use client"

import { Zap, Globe2, Brain, Radar, User, CandlestickChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n"
import { TAB_DEFS, type Tab } from "@/lib/navigation"

/**
 * The mobile navigation bar.
 *
 * Five destinations, generated from the one tab list rather than written out
 * button by button. The hand-written version had nine buttons across a phone —
 * each a 10px label under an icon, two of them leading to empty placeholder
 * screens — and it could disagree with any other navigation surface, because
 * every entry was a separate literal.
 *
 * Hidden above `lg`, where the desktop rail takes over: a bottom bar stretched
 * across a desktop monitor is the single clearest sign that a site is really a
 * phone app in a browser.
 */
const ICONS: Record<Tab, typeof Zap> = {
  feed: Zap,
  globe: Globe2,
  markets: CandlestickChart,
  intelligence: Brain,
  monitor: Radar,
  account: User,
}

interface BottomNavProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const t = useT()
  return (
    <nav
      aria-label="Sections"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 lg:hidden"
    >
      <div className="container mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-around py-3">
          {TAB_DEFS.map((tab) => {
            const Icon = ICONS[tab.id]
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{t(tab.i18nKey)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
