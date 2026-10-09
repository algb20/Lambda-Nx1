"use client"

import { useState } from "react"
import { MoreHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT, useCurated } from "@/lib/i18n"
import { BAR_TABS, TAB_DEFS, tabDef, type Tab } from "@/lib/navigation"
import { TAB_ICONS } from "@/components/side-nav"

interface BottomNavProps {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}

/**
 * The phone bar of the R338 reference design: Home, Intelligence, Maps and
 * "More", which opens every other section as a sheet.
 *
 * The safe-area padding stays: iOS draws its home indicator over the last
 * ~34px and Android its gesture bar, and Pi Browser is a mobile webview, so a
 * bar without it puts our labels under the operating system's own control.
 */
export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const t = useT()
  const curated = useCurated()
  const [moreOpen, setMoreOpen] = useState(false)
  const inBar = (BAR_TABS as readonly Tab[]).includes(activeTab)

  const go = (id: Tab) => {
    setMoreOpen(false)
    setActiveTab(id)
  }

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">All sections</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close" className="touch-target rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {TAB_DEFS.map((def) => {
                const Icon = TAB_ICONS[def.id]
                const active = activeTab === def.id
                return (
                  <li key={def.id}>
                    <button
                      onClick={() => go(def.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-full w-full flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-[11px] transition-colors",
                        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40 hover:bg-muted",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span data-no-translate={curated(def.i18nKey) || undefined} className="leading-tight">
                        {t(def.i18nKey)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Sections"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
          {BAR_TABS.map((id) => {
            const tab = tabDef(id)
            const Icon = TAB_ICONS[id]
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex min-w-16 flex-col items-center gap-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span data-no-translate={curated(tab.i18nKey) || undefined} className="text-[10px] font-medium">
                  {tab.short}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "touch-target flex min-w-16 flex-col items-center gap-1 transition-colors",
              !inBar ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">{inBar ? "More" : tabDef(activeTab).short}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
