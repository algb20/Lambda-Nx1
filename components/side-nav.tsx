'use client'

import {
  Home,
  Globe2,
  Siren,
  Radar,
  Map as MapIcon,
  BarChart3,
  FileText,
  LineChart,
  ShieldAlert,
  Library,
  Settings,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, useCurated } from '@/lib/i18n'
import { TAB_DEFS, type Tab, type NavGroup } from '@/lib/navigation'
import { usePassiveWorldReport } from '@/hooks/use-world-report'
import { tierCounts } from '@/lib/world/tiers'
import { WorldClock } from '@/components/world-clock'
import { SIDEBAR_WIDTH } from '@/lib/shell-width'

/**
 * The sidebar of the R338 reference design: one line per section, the active
 * one in solid blue, a count of critical events beside "Situations & Alerts",
 * and the clock at the foot.
 *
 * The count is read passively: it appears once some page has loaded the world
 * sweep, and the sidebar never starts one itself (see
 * `subscribeToWorldPassively`). An absent badge means "not loaded", never zero.
 */
export const TAB_ICONS: Record<Tab, typeof Home> = {
  home: Home,
  intelligence: Globe2,
  situations: Siren,
  monitor: Radar,
  globe: MapIcon,
  markets: BarChart3,
  feed: FileText,
  forecast: LineChart,
  risks: ShieldAlert,
  knowledge: Library,
  account: Settings,
}

const GROUP_ORDER: NavGroup[] = ['main', 'analysis', 'library']

export function SideNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}) {
  const t = useT()
  const curated = useCurated()
  const { report } = usePassiveWorldReport()
  // Placed and unplaceable alike, the same population the Home cards count.
  const critical = report ? tierCounts(report.events.concat(report.unplaceable)).critical : null

  return (
    <nav
      aria-label="Sections"
      className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 ${SIDEBAR_WIDTH} flex-col gap-3 overflow-y-auto border-e border-sidebar-border bg-sidebar px-3 py-4 lg:flex in-data-[sign-in-prompt=open]:pb-32`}
    >
      {GROUP_ORDER.map((group) => (
        <ul key={group} className="space-y-1">
          {TAB_DEFS.filter((d) => d.group === group).map((tab) => {
            const Icon = TAB_ICONS[tab.id]
            const active = activeTab === tab.id
            return (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  title={tab.description}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors',
                    active
                      ? 'bg-gradient-to-r from-primary to-primary/80 font-semibold text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span data-no-translate={curated(tab.i18nKey) || undefined} className="min-w-0 flex-1 truncate">
                    {t(tab.i18nKey)}
                  </span>
                  {tab.id === 'situations' && critical ? (
                    <span
                      className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white"
                      title={`${critical} critical events in the current sweep`}
                    >
                      {critical}
                    </span>
                  ) : null}
                  {tab.id !== 'home' && !active ? (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-40 rtl:rotate-180" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ))}

      <div className="mt-auto space-y-3">
        <WorldClock compact />
        {/* The credits and licence links CC BY, OGL and the other source
            licences require wherever their data appears (R320). */}
        <a
          href="/terms#sources"
          className="block px-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          Sources &amp; credits
        </a>
      </div>
    </nav>
  )
}
