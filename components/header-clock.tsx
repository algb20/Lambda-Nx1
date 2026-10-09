'use client'

import { useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { timeIn } from '@/components/world-clock'

/** The header's UTC clock (R338 reference design). Real time, after mount only. */
export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="hidden items-center gap-2 rounded-lg px-2 text-xs xl:flex" title="Coordinated Universal Time">
      <Globe2 className="h-5 w-5 text-primary" />
      <div className="leading-tight">
        <div className="font-semibold tabular-nums">{now ? timeIn('UTC', now) : '--:--'} UTC</div>
        <div className="text-[10px] text-muted-foreground">
          {now ? now.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </div>
      </div>
    </div>
  )
}
