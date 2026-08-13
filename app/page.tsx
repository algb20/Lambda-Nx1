"use client"

import { useState } from "react"
import { HomeFeed } from "@/components/home-feed"
import { PersonalDashboard } from "@/components/personal-dashboard"
import { EnterpriseDashboard } from "@/components/enterprise-dashboard"
import { IntelligenceDashboard } from "@/components/intelligence-dashboard"
import { MonitoringDashboard } from "@/components/monitor-dashboard"
import { SuggestionsPanel } from "@/components/suggestions-panel"
import { CalibrationScoreboard } from "@/components/calibration-scoreboard"
import { GlobeView } from "@/components/globe-view"
import { UserPreferences } from "@/components/user-preferences"
import { BottomNav } from "@/components/bottom-nav"
import { Header } from "@/components/header"
import { ErrorBoundary } from "@/components/error-boundary"

const TAB_LABELS: Record<string, string> = {
  feed: "The feed",
  globe: "The world map",
  personal: "Your dashboard",
  enterprise: "The enterprise view",
  intelligence: "The intelligence gateways",
  monitor: "Radar monitoring",
  ideas: "Ideas",
  calibration: "The calibration scoreboard",
  preferences: "Preferences",
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"feed" | "globe" | "personal" | "enterprise" | "intelligence" | "monitor" | "ideas" | "calibration" | "preferences">("feed")

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header onNavigate={setActiveTab} />

      {/*
        Each tab is isolated. A throw inside one used to unmount the whole tree
        and leave a blank white page — the user lost the entire product, with no
        message, to one failing panel. Keyed by tab so switching away from a
        broken panel clears its error instead of trapping the user there.
      */}
      <main className="container mx-auto px-4 py-4 max-w-2xl">
        <ErrorBoundary key={activeTab} label={TAB_LABELS[activeTab]}>
          {activeTab === "feed" && <HomeFeed onNavigate={setActiveTab} />}
          {activeTab === "globe" && <GlobeView />}
          {activeTab === "personal" && <PersonalDashboard />}
          {activeTab === "enterprise" && <EnterpriseDashboard />}
          {activeTab === "intelligence" && <IntelligenceDashboard />}
          {activeTab === "monitor" && <MonitoringDashboard />}
          {activeTab === "ideas" && <SuggestionsPanel />}
          {activeTab === "calibration" && <CalibrationScoreboard />}
          {activeTab === "preferences" && <UserPreferences />}
        </ErrorBoundary>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
