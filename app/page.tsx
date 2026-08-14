"use client"

import { useState } from "react"
import { HomeFeed } from "@/components/home-feed"
import { IntelligenceDashboard } from "@/components/intelligence-dashboard"
import { MonitoringDashboard } from "@/components/monitor-dashboard"
import { CalibrationScoreboard } from "@/components/calibration-scoreboard"
import { GlobeView } from "@/components/globe-view"
import { StandingBriefPanel } from "@/components/standing-brief"
import { UserPreferences } from "@/components/user-preferences"
import { BottomNav } from "@/components/bottom-nav"
import { SideNav } from "@/components/side-nav"
import { Header } from "@/components/header"
import { ErrorBoundary } from "@/components/error-boundary"
import { resolveTab, tabDef, type Tab } from "@/lib/navigation"

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
 * **It is a site on a desktop and an app on a phone.** The single centred
 * 672px column with a bottom bar was a phone layout wearing a browser: correct
 * below `lg`, and on a wide screen it left most of the display empty while the
 * bottom bar stretched across the whole monitor. Above `lg` a persistent rail
 * takes over and the content gets real width; below it, nothing changed.
 */
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("feed")

  const navigate = (id: string) => setActiveTab(resolveTab(id))

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <Header onNavigate={navigate} />

      <div className="container mx-auto flex gap-8 px-4 py-4 lg:max-w-6xl lg:py-6">
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
        <main className="mx-auto w-full min-w-0 max-w-2xl lg:mx-0 lg:max-w-none">
          <ErrorBoundary key={activeTab} label={tabDef(activeTab).label}>
            {activeTab === "feed" && <HomeFeed onNavigate={navigate} />}
            {activeTab === "globe" && (
              <div className="space-y-6">
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
                <StandingBriefPanel />
                <GlobeView />
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
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
