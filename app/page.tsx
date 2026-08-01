"use client"

import { useState } from "react"
import { XLikeFeed } from "@/components/x-like-feed"
import { PersonalDashboard } from "@/components/personal-dashboard"
import { EnterpriseDashboard } from "@/components/enterprise-dashboard"
import { IntelligenceDashboard } from "@/components/intelligence-dashboard"
import { AgenticSwarmDashboard } from "@/components/swarm-dashboard"
import { SuggestionsPanel } from "@/components/suggestions-panel"
import { CalibrationScoreboard } from "@/components/calibration-scoreboard"
import { GlobeView } from "@/components/globe-view"
import { UserPreferences } from "@/components/user-preferences"
import { BottomNav } from "@/components/bottom-nav"
import { Header } from "@/components/header"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"feed" | "globe" | "personal" | "enterprise" | "intelligence" | "swarm" | "ideas" | "calibration" | "preferences">("feed")

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />

      <main className="container mx-auto px-4 py-4 max-w-2xl">
        {activeTab === "feed" && <XLikeFeed onNavigate={setActiveTab} />}
        {activeTab === "globe" && <GlobeView />}
        {activeTab === "personal" && <PersonalDashboard />}
        {activeTab === "enterprise" && <EnterpriseDashboard />}
        {activeTab === "intelligence" && <IntelligenceDashboard />}
        {activeTab === "swarm" && <AgenticSwarmDashboard />}
        {activeTab === "ideas" && <SuggestionsPanel />}
        {activeTab === "calibration" && <CalibrationScoreboard />}
        {activeTab === "preferences" && <UserPreferences />}
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
