'use client'

import { Zap, Globe2, Brain, Radar, User, CandlestickChart} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { TAB_DEFS, type Tab } from '@/lib/navigation'

/**
 * The desktop navigation rail.
 *
 * On a wide screen the product was rendering a phone: a single 672px column
 * centred in a sea of empty background, with a bottom bar stretched across a
 * 27-inch monitor. It read as an app someone had forgotten to make into a site.
 *
 * So the same five destinations get a persistent left rail above `lg`, with
 * room for the one-line description each tab already carries — and the bottom
 * bar hides itself there. Below `lg` nothing changes: the phone layout was
 * right for a phone, and the charter says preserve the design rather than
 * redesign it.
 */
const ICONS: Record<Tab, typeof Zap> = {
  feed: Zap,
  globe: Globe2,
  markets: CandlestickChart,
  intelligence: Brain,
  monitor: Radar,
  account: User,
}

export function SideNav({
  activeTab,
  setActiveTab,
}: {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}) {
  const t = useT()

  return (
    <nav
      aria-label="Sections"
      className="sticky top-20 hidden w-60 shrink-0 flex-col gap-1 lg:flex"
    >
      {TAB_DEFS.map((tab) => {
        const Icon = ICONS[tab.id]
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors',
              active
                ? 'border-border bg-card text-foreground'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            <Icon
              className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', active ? 'text-primary' : '')}
              style={{ width: 18, height: 18 }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{t(tab.i18nKey)}</span>
              {/*
                The description is the reason a rail beats a bar: a bottom bar
                has room for a five-letter word, and "Radar" alone does not tell
                a new user what is behind it.
              */}
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {tab.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
