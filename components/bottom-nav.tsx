"use client"

import { Zap, Globe2, Brain, Radar, User, CandlestickChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT, useCurated } from "@/lib/i18n"
import { BAR_TABS, tabDef, type Tab } from "@/lib/navigation"

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
  // Shield only what we wrote for this language — see lib/i18n/dictionaries.
  const curated = useCurated()
  return (
    <nav
      aria-label="Sections"
      /*
        The bar sits on the very bottom edge, which on a phone is not the bottom
        of the screen. iOS draws its home indicator over the last ~34px and
        Android its gesture bar, so without the safe-area inset the tab labels
        live underneath the system's own control — unreadable, and a tap there
        goes to the operating system rather than to us. Pi Browser is a mobile
        webview, so this is the app's primary surface, not an edge case.

        `env()` is 0 on every device that has no inset, so this costs desktop
        and older phones nothing.
      */
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 lg:hidden"
    >
      <div className="container mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-around py-3">
          {BAR_TABS.map((id) => {
            const tab = tabDef(id)
            const Icon = ICONS[id]
            const active = activeTab === id
            /**
             * The globe is the centre of the bar and is drawn as the centre.
             *
             * Not decoration: it is the surface this product exists to show, it
             * is where the app opens, and the middle slot is the one a thumb
             * reaches without the hand moving. A bar of five identical targets
             * says every destination is equally the point, which is not true
             * here and was the owner's complaint.
             *
             * The lift is small — a slightly larger icon in a filled disc that
             * rises above the row — because a floating action button in the
             * middle of a *navigation* bar is a different control and would
             * teach the wrong thing.
             */
            const centre = id === 'globe'
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center gap-1 transition-colors",
                  centre && "-mt-4",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {centre ? (
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full ring-1 transition-colors",
                      active
                        ? "bg-primary text-primary-foreground ring-primary/40"
                        : "bg-muted text-foreground ring-border",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                {/* Curated by the dictionary — see side-nav for why the machine
                    translator must not touch it. */}
                <span
                  data-no-translate={curated(tab.i18nKey) || undefined}
                  className={cn("text-[10px]", centre ? "font-semibold" : "font-medium")}
                >
                  {t(tab.i18nKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
