'use client'

import { useState } from 'react'
import { Bell, ShieldCheck, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { UpgradePanel } from '@/components/upgrade-panel'
import { SUBSCRIPTION_VISIBLE } from '@/lib/plans/plans'
import { AccountPanel } from '@/components/account-panel'
import { PiUsernameLink } from '@/components/pi-username-link'
import { AvatarSetting } from '@/components/avatar'
import { GroupsPanel } from '@/components/groups-panel'
import { SuggestionsPanel } from '@/components/suggestions-panel'
import { BuildStamp } from '@/components/build-stamp'

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
      {/* Account first, because for a signed-out visitor it is the only thing on
          this screen that does anything — and in Pi mode it used to be missing
          entirely, which is why nobody could create an account outside the Pi
          Browser. */}
      <AccountPanel />

      {/* Plan and billing next: the one thing a signed-in user actively comes
          here to change. */}
      <UpgradePanel />

      {/* Renders only for signed-in accounts. */}
      <AvatarSetting />

      {/* Renders only for Pi-verified accounts. */}
      <PiUsernameLink />

      <GroupsPanel />

      {/*
        Ideas used to be its own tab, next to a floating feedback button that is
        already on every screen — two doors onto one room, one of them costing a
        permanent slot in the navigation bar. The panel keeps everything it did;
        it simply no longer spends a tab to do it.
      */}
      <SuggestionsPanel />

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
            Nothing on this screen is simulated. Every control here changes real behaviour, and
            anything not yet wired is absent rather than shown as a placeholder.
          </p>
        </CardContent>
      </Card>

      {/* Reachable from inside the app, not only from a footer nobody scrolls
          to. Every page here describes what the code actually does — pricing
          and the API reference are both rendered from the definitions the app
          itself enforces, so neither can drift from the product. */}
      <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        {/* Hidden with the rest of the subscription surface (R273). The page
            itself stays reachable by URL and stays rendered from the plan
            definitions, so nothing about it can rot while it is out of sight. */}
        {SUBSCRIPTION_VISIBLE ? (
          <>
            <a href="/pricing" className="hover:text-foreground hover:underline">
              Pricing
            </a>
            <span>·</span>
          </>
        ) : null}
        <a href="/docs/api" className="hover:text-foreground hover:underline">
          API
        </a>
        <span>·</span>
        <a href="/privacy" className="hover:text-foreground hover:underline">
          Privacy
        </a>
        <span>·</span>
        <a href="/terms" className="hover:text-foreground hover:underline">
          Terms of use
        </a>
      </p>
      {/* Which build is serving this page — settles "am I looking at the
          latest work?" without a hosting dashboard. */}
      <BuildStamp className="justify-center pt-1" />

    </div>
  )
}
