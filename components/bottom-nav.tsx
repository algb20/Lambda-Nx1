"use client"

import { Zap, User, Building2, Settings, Brain, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"

interface BottomNavProps {
  activeTab: "feed" | "personal" | "enterprise" | "intelligence" | "swarm" | "preferences"
  setActiveTab: (tab: "feed" | "personal" | "enterprise" | "intelligence" | "swarm" | "preferences") => void
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 z-50">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center justify-around py-3">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "feed" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Zap className="h-5 w-5" />
            <span className="text-[10px] font-medium">Feed</span>
          </button>

          <button
            onClick={() => setActiveTab("personal")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "personal" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">Personal</span>
          </button>

          <button
            onClick={() => setActiveTab("enterprise")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "enterprise" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Building2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Enterprise</span>
          </button>

          <button
            onClick={() => setActiveTab("intelligence")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "intelligence" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Brain className="h-5 w-5" />
            <span className="text-[10px] font-medium">AI Intel</span>
          </button>

          <button
            onClick={() => setActiveTab("swarm")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "swarm" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Cpu className="h-5 w-5" />
            <span className="text-[10px] font-medium">Swarm</span>
          </button>

          <button
            onClick={() => setActiveTab("preferences")}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === "preferences" ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] font-medium">Prefs</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
