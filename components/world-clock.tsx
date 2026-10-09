'use client'

import { useEffect, useState } from 'react'
import { Clock, Globe2 } from 'lucide-react'

/**
 * Real clocks, read from the reader's device (R338 reference design: "Global
 * Time"). Rendered only after mount: a server-rendered time would be the
 * build's time, and a hydration mismatch besides.
 */
export const CITY_ZONES: ReadonlyArray<{ city: string; zone: string }> = [
  { city: 'New York', zone: 'America/New_York' },
  { city: 'London', zone: 'Europe/London' },
  { city: 'Dubai', zone: 'Asia/Dubai' },
  { city: 'Tokyo', zone: 'Asia/Tokyo' },
  { city: 'Sydney', zone: 'Australia/Sydney' },
]

export function timeIn(zone: string, at: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
}

function useNow(stepMs = 15_000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), stepMs)
    return () => clearInterval(id)
  }, [stepMs])
  return now
}

export function WorldClock({ compact = false }: { compact?: boolean }) {
  const now = useNow()
  const localZone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'

  if (compact) {
    return (
      <div className="space-y-2 rounded-xl border border-sidebar-border bg-card/60 p-3 text-sm">
        <div className="flex items-center gap-3">
          <Globe2 className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">UTC</div>
            <div className="font-semibold tabular-nums">{now ? timeIn('UTC', now) : '--:--'}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {now ? now.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-sidebar-border pt-2">
          <Clock className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">Local time</div>
            <div className="font-semibold tabular-nums">{now ? timeIn(localZone, now) : '--:--'}</div>
            <div className="truncate text-[11px] text-muted-foreground">{localZone.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ul className="space-y-1.5 text-sm">
      {[{ city: 'UTC', zone: 'UTC' }, ...CITY_ZONES].map(({ city, zone }) => (
        <li key={zone} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full border border-emerald-400" aria-hidden />
            {city}
          </span>
          <span className="font-medium tabular-nums">{now ? timeIn(zone, now) : '--:--'}</span>
        </li>
      ))}
    </ul>
  )
}
