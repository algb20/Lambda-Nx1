"use client"

import { useState } from "react"
import {
  Bell,
  Brain,
  Globe,
  Heart,
  Rocket,
  Scale,
  Microscope,
  Palette,
  Trophy,
  Leaf,
  Wifi,
  WifiOff,
  Satellite,
  Download,
  Eye,
  Database,
  Shield,
  Coins,
  Cpu,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

const categories = [
  { id: "health", label: "Health & Medicine", icon: Heart, enabled: true },
  { id: "space", label: "Space & Astronomy", icon: Rocket, enabled: true },
  { id: "politics", label: "Politics & Policy", icon: Scale, enabled: false },
  { id: "science", label: "Science & Research", icon: Microscope, enabled: true },
  { id: "art", label: "Art & Culture", icon: Palette, enabled: false },
  { id: "sports", label: "Sports & Athletics", icon: Trophy, enabled: true },
  { id: "environment", label: "Environment & Climate", icon: Leaf, enabled: true },
  { id: "economy", label: "Economy & Finance", icon: Coins, enabled: true },
]

export function UserPreferences() {
  const [categoryPrefs, setCategoryPrefs] = useState(categories)
  const [offlineMode, setOfflineMode] = useState(false)
  const [arMode, setArMode] = useState(true)
  const [notificationPriority, setNotificationPriority] = useState([75])

  const toggleCategory = (id: string) => {
    setCategoryPrefs((prev) => prev.map((cat) => (cat.id === id ? { ...cat, enabled: !cat.enabled } : cat)))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">User Preferences</h2>
        <p className="text-sm text-muted-foreground">Customize your AI swarm behavior & data sources</p>
      </div>

      {/* Category Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Interest Categories
          </CardTitle>
          <p className="text-xs text-muted-foreground">Your swarm learns and adapts to your choices</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {categoryPrefs.map((category) => {
            const Icon = category.icon
            return (
              <div key={category.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
                <Switch checked={category.enabled} onCheckedChange={() => toggleCategory(category.id)} />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Notification Priority */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Proactive Notifications
          </CardTitle>
          <p className="text-xs text-muted-foreground">AI prioritizes alerts based on importance threshold</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Priority Threshold</span>
              <Badge variant="secondary">{notificationPriority[0]}%</Badge>
            </div>
            <Slider
              value={notificationPriority}
              onValueChange={setNotificationPriority}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Only events with {notificationPriority[0]}%+ importance trigger alerts
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Sources & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <Globe className="h-5 w-5 text-cyan-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Web Scraping + NLP (LangChain)</p>
              <p className="text-xs text-muted-foreground">
                UN speeches, government APIs, YouTube, official sources for deep analysis
              </p>
            </div>
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400">
              Active
            </Badge>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <Database className="h-5 w-5 text-purple-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Historical Time-Series (World Bank APIs)</p>
              <p className="text-xs text-muted-foreground">
                Learn from past patterns across economics, demographics, climate data
              </p>
            </div>
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400">
              Active
            </Badge>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <Satellite className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">DePIN Satellites & 6G IoT</p>
              <p className="text-xs text-muted-foreground">
                Real-time feeds from space satellites, IoT sensors for non-internet events
              </p>
            </div>
            <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-400">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quantum Swarm Fusion */}
      <Card className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border-purple-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Quantum Swarm Fusion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Accuracy Rate</span>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
                99.2%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Multi-World Simulation</span>
              <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300">
                Past/Present/Future
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantum Error Correction</span>
              <Badge variant="secondary" className="bg-green-500/10 text-green-400">
                Enabled
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Hybrid quantum-classical computing with collaborative agentic swarm for ultra-accurate predictions
          </p>
        </CardContent>
      </Card>

      {/* Offline & AR Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Display & Experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              {offlineMode ? (
                <WifiOff className="h-4 w-4 text-orange-400" />
              ) : (
                <Wifi className="h-4 w-4 text-green-400" />
              )}
              <div>
                <p className="text-sm font-medium">Offline Mode</p>
                <p className="text-xs text-muted-foreground">Local data storage & processing</p>
              </div>
            </div>
            <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-cyan-400" />
              <div>
                <p className="text-sm font-medium">AR/VR Dashboard</p>
                <p className="text-xs text-muted-foreground">3D global maps & spatial analysis</p>
              </div>
            </div>
            <Switch checked={arMode} onCheckedChange={setArMode} />
          </div>
        </CardContent>
      </Card>

      {/* RWA Investment Agent */}
      <Card className="border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 to-orange-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-400" />
            Proactive RWA Investment Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Automatic investment in tokenized Real World Assets via Pi Network DeFi
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auto-Investment</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Risk Tolerance</span>
            <Badge variant="secondary">Moderate</Badge>
          </div>
          <Button size="sm" className="w-full bg-transparent" variant="outline">
            Configure Investment Rules
          </Button>
        </CardContent>
      </Card>

      {/* Security & Privacy */}
      <Card className="border-green-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-400" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">On-Device Processing</span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-400">
              Enabled
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Quantum-Safe Encryption</span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-400">
              Active
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Zero-Knowledge Proofs</span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-400">
              Active
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GDPR Compliance</span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-400">
              Verified
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Sovereign nodes ensure decentralized, private data processing
          </p>
        </CardContent>
      </Card>

      {/* Global Status */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-medium">Non-Stop Background Operation</p>
              <p className="text-xs text-muted-foreground">
                6G scalability • Instant global connection • Essential worldwide status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partnerships */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Technology Partnerships</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">IBM Quantum</Badge>
            <Badge variant="outline">Azure Quantum</Badge>
            <Badge variant="outline">Google Cloud</Badge>
            <Badge variant="outline">Pi Network</Badge>
            <Badge variant="outline">6G Alliance</Badge>
            <Badge variant="outline">DePIN Network</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Powering the universal future OS in agentic reality</p>
        </CardContent>
      </Card>
    </div>
  )
}
