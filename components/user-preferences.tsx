'use client'

import { useState } from 'react'
import { Bell, ShieldCheck, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { UpgradePanel } from '@/components/upgrade-panel'
import { PiUsernameLink } from '@/components/pi-username-link'
import { AvatarSetting } from '@/components/avatar'
import { GroupsPanel } from '@/components/groups-panel'

/**
 * Settings. The previous version advertised fabricated capabilities ("Quantum
 * Swarm Fusion 99.2%", IBM/Azure partnerships, 6G/DePIN satellites, an RWA
 * investment agent). All removed per charter rule #1. This shows only real
 * controls and truthful statements about how the platform works. Persisted
 * account settings arrive with auth (P5) and the modules.
 */
export function UserPreferences() {
  const [alertThreshold, setAlertThreshold] = useState([75])

  return (
    <div className="space-y-4">
      {/* Plan and billing first: it is the one thing on this screen a user
          actively comes here to change. */}
      <UpgradePanel />

      {/* Renders only for signed-in accounts. */}
      <AvatarSetting />

      {/* Renders only for Pi-verified accounts. */}
      <PiUsernameLink />

      <GroupsPanel />

      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Preferences that are wired to real behavior only.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert threshold
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            When monitoring ships (P4/P6), only findings at or above this confidence trigger
            an alert.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Minimum importance</span>
            <Badge variant="secondary">{alertThreshold[0]}%</Badge>
          </div>
          <Slider value={alertThreshold} onValueChange={setAlertThreshold} max={100} step={5} />
        </CardContent>
      </Card>

      <Card className="border-green-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            How Lambda operates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Passive only — the engine never contacts an investigation target directly.</p>
          <p>• Public and lawful sources only; robots.txt, terms and rate limits respected.</p>
          <p>• Data minimization &amp; GDPR-aware — we store only what a task needs.</p>
          <p>• Every finding carries its source, timestamp and a confidence grade.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Account, saved investigations and persisted preferences appear once authentication
            and the first modules are connected. Nothing here is simulated.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
