"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { FollowByEmail } from "@/components/follow-by-email"
import { BottomNav } from "@/components/bottom-nav"
import { shellContainerFor } from "@/lib/shell-width"
import { CommandPalette } from '@/components/command-palette'
import { SideNav } from "@/components/side-nav"
import { Header } from "@/components/header"
import { ErrorBoundary } from "@/components/error-boundary"
import { PanelSkeleton } from "@/components/panel-skeleton"
import { useT, useCurated } from "@/lib/i18n"
import { HOME_TAB, pathForTab, resolveTab, tabDef, type Tab } from "@/lib/navigation"

/**
 * One tab's code arrives when that tab is on screen — not before.
 *
 * ## The measurement
 *
 * Every panel in the product was a static import here, so webpack put all of
 * them in one chunk and every route loaded all of it. Measured against the
 * production build in a phone-sized Chromium: **1,032 kB of JavaScript decoded
 * (308 kB over the wire) on every single route**, `/pricing` included — a page
 * that is a price list and carried the globe, the atlas, five dashboards and
 * the whole gateway console with it.
 *
 * A visitor opening the map paid to download the monitoring board, the markets
 * tables, the account screen and the 2,500-line investigation console before
 * the map could start. On the mid-range Android that Pi Browser runs on, that
 * is not a byte count — it is seconds of parse and compile before the first
 * useful frame.
 *
 * ## Why `next/dynamic` and not a lazy route
 *
 * These are panels of one page, not five documents (see the note on
 * `pushState` below). `next/dynamic` keeps that: the shell stays one page, and
 * only the panel currently rendered is fetched.
 *
 * **`ssr` stays on.** Each tab is prerendered at its own URL by
 * `app/[tab]/page.tsx`, so the server still renders the real panel into the
 * HTML — a crawler sees the product, a deep link paints on the first frame, and
 * Next preloads exactly the chunk that render used. Turning SSR off here would
 * buy nothing and hand every tab URL back to the spinner it took work to
 * escape.
 *
 * The skeleton is for the other path: switching tab in a live session, where
 * the chunk is fetched on demand and a blank main area would read as a hang.
 */
const HomeFeed = dynamic(() => import("@/components/home-feed").then((m) => m.HomeFeed), {
  loading: () => <PanelSkeleton label="Feed" />,
})
const IntelligenceDashboard = dynamic(
  () => import("@/components/intelligence-dashboard").then((m) => m.IntelligenceDashboard),
  { loading: () => <PanelSkeleton label="Investigate" /> },
)
const MonitoringDashboard = dynamic(
  () => import("@/components/monitor-dashboard").then((m) => m.MonitoringDashboard),
  { loading: () => <PanelSkeleton label="Radar" /> },
)
const CalibrationScoreboard = dynamic(
  () => import("@/components/calibration-scoreboard").then((m) => m.CalibrationScoreboard),
)
const MarketsPanel = dynamic(() => import("@/components/markets-panel").then((m) => m.MarketsPanel), {
  loading: () => <PanelSkeleton label="Markets" />,
})
const UserPreferences = dynamic(
  () => import("@/components/user-preferences").then((m) => m.UserPreferences),
  { loading: () => <PanelSkeleton label="Account" /> },
)
const GlobeWorkspace = dynamic(
  () => import("@/components/globe-workspace").then((m) => m.GlobeWorkspace),
  { loading: () => <PanelSkeleton label="World surface" /> },
)
const LiveColumns = dynamic(() => import("@/components/live-columns").then((m) => m.LiveColumns))
const HomeDashboard = dynamic(() => import("@/components/home-dashboard").then((m) => m.HomeDashboard), {
  loading: () => <PanelSkeleton label="Home" />,
})
const CountryDossier = dynamic(() => import("@/components/country-dossier").then((m) => m.CountryDossier), {
  loading: () => <PanelSkeleton label="Risks" />,
})
const RadarKnowledgeBase = dynamic(
  () => import("@/components/radar-knowledge-base").then((m) => m.RadarKnowledgeBase),
  { loading: () => <PanelSkeleton label="Knowledge base" /> },
)

/**
 * The shell.
 *
 * Two things about its shape are deliberate.
 *
 * **Sections, grouped.** The owner's reference design (R338) lays the product
 * out as eleven sections in three groups — main, analysis, library — beside a
 * persistent sidebar. The list and its reasoning live in `lib/navigation.ts`,
 * and old ids still resolve so no saved link lands on a blank screen.
 *
 * **Every tab has a URL.** The shell used to keep the active tab in component
 * state and nothing else, which meant the entire product lived at one address.
 * Nothing could be linked to, the browser's back button did nothing, a refresh
 * threw the user back to the feed, and a crawler saw a single page whose only
 * visible text was the sign-in screen. The tab now lives in the URL — the
 * address bar is the state — so `/globe` is a place, back and forward work,
 * and a reload lands where the user was.
 *
 * `history.pushState` rather than the router, deliberately: this is one page
 * swapping panels, not five documents. Asking Next.js to route between them
 * would re-run the shell each time and throw away the panel state a user is
 * mid-way through, to produce a navigation the user cannot tell apart.
 *
 * **It is a site on a desktop and an app on a phone.** The single centred
 * 672px column with a bottom bar was a phone layout wearing a browser: correct
 * below `lg`, and on a wide screen it left most of the display empty while the
 * bottom bar stretched across the whole monitor. Above `lg` a persistent rail
 * takes over and the content gets real width; below it, nothing changed.
 */
export default function HomePage({ initialTab }: { initialTab?: Tab } = {}) {
  /**
   * The tab comes from the route, not from the window.
   *
   * It used to read `window.location.pathname` in the `useState` initialiser,
   * with `'feed'` on the server — which is a hydration mismatch on every tab
   * URL there is. `/globe` is prerendered at build time showing the *feed*,
   * the client's first render shows the *globe*, React finds two different
   * trees and throws **#418**: it discards the server HTML and re-renders the
   * whole document on the client. Every deep link paid for that, silently,
   * including on a phone in Pi Browser — and the page looked fine afterwards,
   * which is why it survived.
   *
   * `app/[tab]/page.tsx` already knows which tab it is; it is the route
   * parameter. Passing it down means the server and the client's first render
   * agree by construction rather than by luck, and the deep link still paints
   * the right panel on the first frame — which was the point of reading the
   * window in the first place.
   */
  /**
   * A bare `/` with no `initialTab` is the home dashboard. `HOME_TAB` rather
   * than a literal, because the home tab and the path mapping must agree.
   */
  const [activeTab, setTab] = useState<Tab>(initialTab ?? HOME_TAB)

  const setActiveTab = useCallback((id: Tab) => {
    setTab(id)
    if (typeof window === 'undefined') return
    const path = pathForTab(id)
    if (window.location.pathname !== path) window.history.pushState({ tab: id }, '', path)
  }, [])

  // The back button must work. Without this the URL changes and the panel does
  // not, which is worse than having no URLs at all.
  useEffect(() => {
    const onPop = () => setTab(resolveTab(window.location.pathname.slice(1)))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /**
   * Where the shell can be sent.
   *
   * A plain tab id switches tab. `gateway:<id>` — what the command palette
   * emits — switches to Investigate *and* names the gateway in the hash, which
   * is what the dashboard listens to. Doing it in one call keeps the palette
   * from having to know how the dashboard holds its state.
   */
  const navigate = (id: string) => {
    if (id.startsWith('gateway:')) {
      const gateway = id.slice('gateway:'.length)
      setTab('intelligence')
      if (typeof window !== 'undefined') {
        /**
         * Path and hash in **one** `pushState`, then the event by hand.
         *
         * The obvious version — `setActiveTab('intelligence')` followed by
         * `location.hash = gateway` — pushed the path first and the hash
         * second, and the URL ended up back at `/intelligence` with the hash
         * gone. The gateway still opened, so it looked fine; the address bar
         * simply stopped being shareable, which is the kind of breakage nobody
         * reports because nobody notices it happening.
         *
         * One push cannot race with itself, and `hashchange` does not fire for
         * a `pushState`, so the dashboard is told directly.
         */
        window.history.pushState({ tab: 'intelligence' }, '', `/intelligence#${gateway}`)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      return
    }
    setActiveTab(resolveTab(id))
  }

  /*
    The bottom padding clears the phone bar, which grows by the safe-area
    inset; `env()` is 0 wherever there is no inset, and `lg:!pb-0` wins on a
    wide screen, where the sidebar replaces the bar.

    The frame is the R338 reference design: header across the top, sidebar
    down the left, the page beside it at full width. Width is decided in
    lib/shell-width.ts, so the header's brand block and the sidebar share one
    edge by construction.
  */
  return (
    <div
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      className="min-h-screen bg-background lg:!pb-0"
    >
      <Header onNavigate={navigate} tab={activeTab} />

      {/* One keystroke to any section and gateway; the header's search opens it. */}
      <CommandPalette onNavigate={navigate} showTrigger={false} />

      <div className="flex w-full">
        <SideNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/*
          Each tab is isolated: a throw inside one panel shows a message in that
          panel instead of blanking the product. Keyed by tab so switching away
          clears it. `min-w-0` stops a wide child (a table, the map canvas) from
          pushing the row past the viewport.
        */}
        <main className="min-w-0 flex-1">
          <div className={shellContainerFor(activeTab)}>
            <ErrorBoundary key={activeTab} label={tabDef(activeTab).label}>
              {activeTab === "home" && <HomeDashboard onNavigate={navigate} />}
              {activeTab === "situations" && (
                <PageFrame tab="situations" note="Every live report, by category, with its source and time. Grouping into situation objects arrives with M-3.">
                  <LiveColumns />
                </PageFrame>
              )}
              {activeTab === "globe" && (
                /*
                  The map takes the frame; the reading takes a rail.

                  Measured before: with the map pane capped at 38rem and the
                  rail `flex-1`, the globe canvas stopped at 574px while the rail
                  reached 1712px on a 2560 monitor, holding 415 characters. The
                  cap belongs on the rail, which has a natural right width.
                */
                <div className="flex min-h-[calc(100vh-4rem)] flex-col xl:flex-row">
                  <div className="min-w-0 flex-1 space-y-6 px-3 py-4 sm:px-4 lg:px-6 xl:overflow-y-auto">
                    <GlobeWorkspace />
                    <FollowByEmail />
                  </div>
                  <aside className="min-w-0 shrink-0 border-t border-border xl:sticky xl:top-16 xl:h-[calc(100vh-4rem)] xl:w-[26rem] xl:border-s xl:border-t-0 2xl:w-[32rem]">
                    <LiveColumns />
                  </aside>
                </div>
              )}
              {activeTab === "markets" && (
                <PageFrame tab="markets" note="Prices and series as each source publishes them. Nothing here is predicted.">
                  <MarketsPanel />
                </PageFrame>
              )}
              {activeTab === "intelligence" && (
                <PageFrame tab="intelligence" note="Every gateway over one engine: investigate a domain, a company, a vessel, a threat.">
                  <IntelligenceDashboard />
                </PageFrame>
              )}
              {activeTab === "monitor" && (
                <PageFrame tab="monitor" note="What you watch, checked on a schedule, with every change kept as evidence.">
                  <MonitoringDashboard />
                </PageFrame>
              )}
              {activeTab === "feed" && (
                <PageFrame tab="feed" note="The analysed feed and briefs, each finding linked to its source.">
                  <HomeFeed onNavigate={navigate} />
                </PageFrame>
              )}
              {activeTab === "forecast" && (
                <PageFrame tab="forecast" note="Only what can be scored: every call is logged before the outcome and graded after it. A forecast is never presented as fact.">
                  <CalibrationScoreboard />
                </PageFrame>
              )}
              {activeTab === "risks" && (
                <PageFrame tab="risks" note="Reported signal per country, beside how well we can observe it. Not a forecast.">
                  <CountryDossier />
                </PageFrame>
              )}
              {activeTab === "knowledge" && (
                <PageFrame tab="knowledge" note="The method, the sources and the terms behind every finding.">
                  <RadarKnowledgeBase />
                </PageFrame>
              )}
              {activeTab === "account" && (
                <PageFrame tab="account" note="Your account, plan, language and data.">
                  <UserPreferences />
                </PageFrame>
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}

/** The page heading every section shares in the R338 design. */
function PageFrame({ tab, note, children }: { tab: Tab; note: string; children: React.ReactNode }) {
  const t = useT()
  const curated = useCurated()
  const key = tabDef(tab).i18nKey
  return (
    <div className="space-y-4">
      <header>
        <h1 data-no-translate={curated(key) || undefined} className="text-xl font-bold tracking-tight sm:text-2xl">
          {t(key)}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
      </header>
      {children}
    </div>
  )
}
