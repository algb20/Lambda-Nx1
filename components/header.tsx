"use client"

import { Moon, Sun, Zap, Shield, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "@/hooks/use-theme"

export function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 py-3 max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap className="h-6 w-6 text-primary" fill="currentColor" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Zap className="h-6 w-6 text-primary" fill="currentColor" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">AgentSwarm</h1>
              <p className="text-[10px] text-muted-foreground leading-none">Quantum</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:flex text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            >
              <Shield className="h-3 w-3 mr-1" />
              Quantum-Safe
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-accent/10 border-accent/20 hover:bg-accent/20"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Pay with</span> π
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
