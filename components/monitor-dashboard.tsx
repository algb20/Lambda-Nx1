'use client'

import { useEffect, useState, useCallback } from 'react'
import { Radar, Loader2, Trash2, Play, Pause, Bell, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadarKnowledgeBase } from '@/components/radar-knowledge-base'
import type { Monitor, Alert } from '@/lib/db'
import { discardBody } from '@/lib/http/discard'

const INTERVALS: Array<{ label: string; minutes: number }> = [
  { label: 'Hourly', minutes: 60 },
  { label: 'Daily', minutes: 1440 },
  { label: 'Weekly', minutes: 10080 },
]

export function MonitoringDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [domain, setDomain] = useState('')
  const [interval, setIntervalMinutes] = useState(1440)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/monitors')
    if (res.status === 401) {
      // Decided from the status; the body is never read, so it is released
      // explicitly. See lib/http/discard.ts.
      discardBody(res)
      setAuthed(false)
      return
    }
    setAuthed(true)
    const data = await res.json()
    setMonitors(data.monitors ?? [])
    const aRes = await fetch('/api/alerts')
    // Both branches, because only one of them was ever handled. When this read
    // the body on the ok path alone, every other status — a 429 from our own
    // rate limit, a 401 on this second call — dropped a body unread and held
    // the socket, so `/monitor` stopped reaching quiescence again days after
    // that leak was declared fixed. Found by the browser suite, not by the
    // pattern scan, which is why both exist.
    if (aRes.ok) setAlerts((await aRes.json()).alerts ?? [])
    else discardBody(aRes)
  }, [])

  useEffect(() => {
    refresh().catch(() => setError('Could not load monitors'))
  }, [refresh])

  const create = async () => {
    if (!domain.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'domain', targetValue: domain.trim(), intervalMinutes: interval }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not create monitor')
      setDomain('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create monitor')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' })
    await refresh()
  }

  const toggle = async (m: Monitor) => {
    await fetch(`/api/monitors/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: m.status === 'active' ? 'paused' : 'active' }),
    })
    await refresh()
  }

  if (authed === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!authed) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Radar className="h-6 w-6 shrink-0 text-primary" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Radar — monitoring</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to watch a domain and be alerted when its public footprint changes
              (new subdomains, IPs, nameservers or registrar). The detection engine is built
              and tested; nothing here is simulated.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Radar — monitoring</h2>
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Watch a domain</h3>
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="example.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
          />
          <Button onClick={create} disabled={busy || !domain.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-2 flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.minutes}
              onClick={() => setIntervalMinutes(iv.minutes)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === iv.minutes ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </Card>

      {monitors.length > 0 ? (
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-semibold">Your monitors</h3>
          {monitors.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.targetValue}</p>
                <p className="text-[11px] text-muted-foreground">
                  every {m.intervalMinutes}m ·{' '}
                  {m.lastRunAt ? `checked ${new Date(m.lastRunAt).toLocaleDateString()}` : 'not yet checked'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                  {m.status}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggle(m)}>
                  {m.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <Card className="p-4">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Bell className="h-4 w-4" />
          Alerts
        </h3>
        {alerts.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No changes detected yet.</p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className="border-b border-border/40 py-2 last:border-0">
              <p className="text-sm">{a.title}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</p>
            </div>
          ))
        )}
      </Card>

      <RadarKnowledgeBase />
    </div>
  )
}
