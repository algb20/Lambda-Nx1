'use client'

import { WorldSurface, type SurfaceArc, type SurfacePoint } from '@/components/world-surface'

/**
 * DataGlobe — the globe-only view of the world surface, kept as its own name
 * because several dashboards embed a small globe beside a result and do not want
 * a projection toggle there. The drawing, the country outlines and the hit
 * testing are the shared implementation in WorldSurface.
 */
export type GlobeArc = SurfaceArc

export function DataGlobe({
  points,
  arcs = [],
  height = 380,
  focus,
  showToggle = false,
  onSelect,
}: {
  points: SurfacePoint[]
  arcs?: SurfaceArc[]
  height?: number
  focus?: { lat: number; lon: number }
  showToggle?: boolean
  onSelect?: (point: SurfacePoint) => void
}) {
  return (
    <WorldSurface
      points={points}
      arcs={arcs}
      height={height}
      focus={focus}
      showToggle={showToggle}
      onSelect={onSelect}
    />
  )
}
