'use client'

import { useEffect, useMemo, useState } from 'react'
import { Globe2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataGlobe } from '@/components/data-globe'
import { ErrorBoundary } from '@/components/error-boundary'
import { pointsFromEvidence, type GlobePoint } from '@/lib/geo/centroids'

interface NewsItem {
  claim?: string
  /** Sources tag items differently: USGS gives exact coordinates, GDELT and
   *  ReliefWeb give a country. Both are plottable — see pointsFromEvidence. */
  data?: { country?: string; lat?: number; lon?: number; place?: string }
}

/**
 * Live world map — plots where today's top events are being reported, on our own
 * 3D globe. It reuses the News gateway (source countries) and aggregates them
 * into weighted points. The same globe can later map sources, markets, or any
 * geolocated signal.
 */
export function GlobeView() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

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
        if (!cancelled) setItems((data?.items ?? []) as NewsItem[])
      } catch {
        // The globe still renders; the caption below says why it is empty.
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Plot everything the feed can place, not just country-tagged items.
   *
   * The topic-less feed is served by Wikipedia (no location), USGS (exact
   * epicentres) and ReliefWeb (country) — GDELT, the only other country source,
   * needs a topic and is skipped here. Reading `country` alone therefore left
   * the globe permanently empty while precise coordinates sat unused in the
   * same payload. `pointsFromEvidence` takes both.
   */
  const points: GlobePoint[] = useMemo(
    () =>
      pointsFromEvidence(
        items.map((i) => ({
          lat: i.data?.lat,
          lon: i.data?.lon,
          country: i.data?.country,
          label: i.data?.place ?? i.data?.country ?? i.claim,
        })),
      ),
    [items],
  )
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

      {/* The canvas is the riskiest part of this page (WebGL-less 2D drawing,
          pointer capture, animation frames). Isolate it so a failure there
          still leaves the signal list below usable. */}
      <Card className="overflow-hidden p-0">
        <ErrorBoundary label="The 3D globe">
          <DataGlobe points={points} height={400} />
        </ErrorBoundary>
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
              {failed
                ? 'Could not reach the news sources just now. The globe still spins — points appear on the next refresh.'
                : 'No placeable signals in the current feed. Not every top story carries a location; the globe plots the ones that do.'}
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
