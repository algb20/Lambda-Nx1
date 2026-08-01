'use client'

import { useEffect, useMemo, useState } from 'react'
import { Globe2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataGlobe } from '@/components/data-globe'
import { pointsFromCountries, type GlobePoint } from '@/lib/geo/centroids'

interface NewsItem {
  data?: { country?: string }
}

/**
 * Live world map — plots where today's top events are being reported, on our own
 * 3D globe. It reuses the News gateway (source countries) and aggregates them
 * into weighted points. The same globe can later map sources, markets, or any
 * geolocated signal.
 */
export function GlobeView() {
  const [countries, setCountries] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/intelligence/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' }),
        })
        const data = await res.json()
        const items: NewsItem[] = data?.items ?? []
        if (!cancelled) setCountries(items.map((i) => i.data?.country).filter(Boolean) as string[])
      } catch {
        /* offline — the globe still renders */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const points: GlobePoint[] = useMemo(() => pointsFromCountries(countries), [countries])
  const top = useMemo(() => [...points].sort((a, b) => b.weight - a.weight).slice(0, 8), [points])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Live world map</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Where today&apos;s top events are being reported, on our own 3D globe. Drag to spin, hover a
        point for the country. Public signals only.
      </p>

      <Card className="overflow-hidden p-0">
        <DataGlobe points={points} height={400} />
      </Card>

      {loading ? (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading live signals…
        </Card>
      ) : (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Most active now</h4>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No geolocated signals right now (sources may be rate-limited). The globe still spins —
              live points appear as they arrive.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {top.map((p) => (
                <Badge key={p.label} variant="outline" className="gap-1">
                  {p.label}
                  <span className="text-muted-foreground">{p.weight}</span>
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
