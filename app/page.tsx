"use client"

import { useCallback, useEffect, useState } from "react"
import { HomeFeed } from "@/components/home-feed"
import { IntelligenceDashboard } from "@/components/intelligence-dashboard"
import { MonitoringDashboard } from "@/components/monitor-dashboard"
import { CalibrationScoreboard } from "@/components/calibration-scoreboard"
import { GlobeView } from "@/components/globe-view"
import { StandingBriefPanel } from "@/components/standing-brief"
import { FollowByEmail } from "@/components/follow-by-email"
import { LiveColumns } from "@/components/live-columns"
import { UserPreferences } from "@/components/user-preferences"
import { BottomNav } from "@/components/bottom-nav"
import { CommandPalette } from '@/components/command-palette'
import { SideNav } from "@/components/side-nav"
import { ContextRail } from "@/components/context-rail"
import { Header } from "@/components/header"
import { ErrorBoundary } from "@/components/error-boundary"
import { resolveTab, tabDef, type Tab } from "@/lib/navigation"
import { MarketsPanel } from "@/components/markets-panel"

/**
 * The shell.
 *
 * Two things about its shape are deliberate.
 *
 * **Five tabs, not nine.** Four destinations did not earn a permanent slot in
 * front of every user: two were empty placeholders, one duplicated the floating
 * feedback button, and one answered a question that belongs inside Radar. The
 * reasoning lives with the list in `lib/navigation.ts`, and old ids still
 * resolve so no saved link lands on a blank screen.
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
  const [activeTab, setTab] = useState<Tab>(initialTab ?? 'feed')

  const setActiveTab = useCallback((id: Tab) => {
    setTab(id)
    if (typeof window === 'undefined') return
    const path = id === 'feed' ? '/' : `/${id}`
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
    The bottom padding clears the tab bar, and the tab bar itself now grows by
    the phone's safe-area inset — so a fixed `pb-20` leaves the last row of
    every page under the system's home indicator on the devices that have one.
    The padding tracks the bar instead of guessing at it. `env()` is 0 wherever
    there is no inset, so nothing else changes, and `lg:!pb-0` still wins on a
    wide screen because an `!important` rule beats an inline style.
  */
  return (
    <div
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      className="min-h-screen bg-background lg:!pb-0"
    >
      <Header onNavigate={navigate} />

      {/* One keystroke to any of five tabs and twenty-seven gateways. Mounted
          at the shell so it works from every panel, including a broken one. */}
      <CommandPalette onNavigate={navigate} />

      {/*
        Width is earned, not taken. `lg` brings the navigation rail and real
        content width; `xl` brings a second column beside it. Simply raising the
        cap without the rail would make it worse — a single column stretched to
        1600px gives 200-character lines nobody can read, and the page still has
        nothing on either side. A wide screen is a different arrangement, not a
        tall screen with more room.
      */}
      {/*
        The globe tab is a workspace, not an article.

        Every other tab is reading — a feed, a report, a settings page — and
        reading wants a measured column, because a 200-character line is a line
        nobody finishes. The world surface is the opposite: it is a display
        somebody watches, and on a wide screen a centred column leaves half the
        monitor empty while the map is squeezed and the live rows sit below the
        fold. So this tab drops the container entirely and takes the viewport.

        The cap stays for everything else, and that is deliberate rather than
        lazy: width is earned by what a screen is *for*.
      */}
      <div
        className={
          // Markets is a workspace too, by the rule stated just above: width is
          // earned by what a screen is for. A wall of tables in a reading
          // column wastes the monitor and squeezes every number.
          activeTab === "globe"
            ? "flex w-full gap-0 px-0 py-0"
            : activeTab === "markets"
              ? "container mx-auto flex gap-6 px-4 py-4 lg:max-w-none lg:gap-8 lg:py-6"
              : "container mx-auto flex gap-6 px-4 py-4 lg:max-w-[88rem] lg:gap-8 lg:py-6 2xl:max-w-[104rem]"
        }
      >
        <SideNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/*
          Each tab is isolated. A throw inside one used to unmount the whole tree
          and leave a blank white page — the user lost the entire product, with no
          message, to one failing panel. Keyed by tab so switching away from a
          broken panel clears its error instead of trapping the user there.

          `min-w-0` matters: without it a wide child (a table, the globe canvas)
          pushes the flex row past the viewport and the whole page scrolls
          sideways.
        */}
        <main
          className={
            activeTab === "globe" || activeTab === "markets"
              ? "w-full min-w-0"
              : "mx-auto w-full min-w-0 max-w-2xl lg:mx-0 lg:max-w-none"
          }
        >
          <ErrorBoundary key={activeTab} label={tabDef(activeTab).label}>
            {activeTab === "feed" && <HomeFeed onNavigate={navigate} />}
            {activeTab === "globe" && (
              /*
                Two panes on a wide screen, stacked on a narrow one.

                The columns run beside the map rather than beneath it because a
                globe answers "where" and cannot answer "what happened" — a dot
                has no headline. On a monitor there is room for both, and putting
                the reading below the map wastes half the display and makes
                learning anything a scroll. Below `xl` the panes stack, because
                two columns on a phone is two unreadable columns.

                Both panes read one sweep from the shared store, so a dot and the
                row describing it can never come from two different pictures of
                the world.
              */
              <div className="flex min-h-[calc(100vh-3.5rem)] flex-col xl:flex-row">
                <div className="min-w-0 flex-1 space-y-6 px-4 py-4 xl:max-w-[38rem] xl:overflow-y-auto">
                {/*
                  The brief leads the map rather than sitting behind a button.
                  It reads the same world picture the globe draws, and the
                  analysis is the thing a user came for — a map of dots asks
                  them to do the triage themselves, which is what every
                  comparable board already does.

                  It is here rather than in a sixth tab because the five-tab
                  shell was a deliberate decision (see lib/navigation.ts): one
                  tab per question a user arrives with. "What does the world
                  picture mean" is the same question as "where is it", answered
                  one layer up.
                */}
                {/*
                  The map leads, the reading follows.

                  These were the other way round, and it was wrong for the one
                  reason that matters: a user opening the globe tab came to see
                  the world. Putting an analytic summary above the map means
                  the thing they asked for is below the fold on a phone, and
                  the first impression of a *map* product is a wall of text.

                  The brief keeps its place immediately beneath — close enough
                  to read together, second because it explains what the map is
                  already showing.
                */}
                <GlobeView />
                <StandingBriefPanel />
                {/*
                  Offered at the foot of the brief, where somebody has just read
                  one and knows what they would be getting. A subscribe box at
                  the top of a page asks people to commit to something they have
                  not seen yet, which is how it gets ignored.
                */}
                <FollowByEmail />
                </div>

                {/*
                  The live columns. `sticky` on the tall pane rather than the
                  short one: the reading scrolls, the world stays put, which is
                  how an operations display behaves and the opposite of how an
                  article does.
                */}
                <aside className="min-w-0 flex-1 border-t border-border xl:sticky xl:top-14 xl:h-[calc(100vh-3.5rem)] xl:min-w-[28rem] xl:border-l xl:border-t-0">
                  <LiveColumns />
                </aside>
              </div>
            )}
            {/*
              A destination of its own, unlike the standing brief above — which
              stays inside the globe tab precisely because it answers the same
              question the map does, one layer up. "What are prices and markets
              doing" is not that question, and the data behind it was already
              complete and going nowhere. See lib/navigation.ts.
            */}
            {activeTab === "markets" && (
              <div className="px-4 py-4">
                <MarketsPanel />
              </div>
            )}
            {activeTab === "intelligence" && <IntelligenceDashboard />}
            {activeTab === "monitor" && (
              <div className="space-y-6">
                <MonitoringDashboard />
                {/*
                  Calibration is not a separate destination: it answers "how
                  well has this monitoring called things", which is a question
                  about Radar and belongs on the same screen as Radar.
                */}
                <CalibrationScoreboard />
              </div>
            )}
            {activeTab === "account" && <UserPreferences />}
          </ErrorBoundary>
        </main>

        {/*
          Mounts only above 1280px — gated on a real media query rather than
          hidden with CSS, so a laptop does not pay for the fetch.

          Never on the globe tab. The rail exists to put context beside a page
          that is being *read*; the world surface has its own live columns doing
          that job better, and running both left the map 518px wide on a 1600px
          monitor — three panes fighting over one screen, which is how a display
          ends up smaller than the article next to it.
        */}
        {/*
          Not on a dashboard either.

          The rail puts context beside a page being *read*. Beside the markets
          page it did the opposite: two short cards against a very long column
          of tables, so most of that side of the screen was empty — the owner's
          *"فراغات كثيرة غير مستغلة"*, a lot of unused blank space. The markets
          page has its own context in every row.
        */}
        {activeTab === "globe" || activeTab === "markets" ? null : (
          <ContextRail onNavigate={navigate} />
        )}
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
