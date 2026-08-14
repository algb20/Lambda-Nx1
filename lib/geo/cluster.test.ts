import { describe, it, expect } from 'vitest'
import { clusterByScreenDistance, meanCoordinate, type PlottedPoint } from './cluster'
import { projectGlobe, projectMap } from './projection'

const plot = (x: number, y: number, item: string): PlottedPoint<string> => ({ x, y, item })

describe('clusterByScreenDistance', () => {
  it('merges marks that overlap on screen and leaves separated ones alone', () => {
    const clusters = clusterByScreenDistance(
      [plot(100, 100, 'a'), plot(104, 103, 'b'), plot(400, 100, 'c')],
      20,
    )
    expect(clusters).toHaveLength(2)
    expect(clusters[0].items).toEqual(['a', 'b'])
    expect(clusters[1].items).toEqual(['c'])
  })

  it('places the mark at the centre of its members, not on the first one', () => {
    const [cluster] = clusterByScreenDistance([plot(100, 100, 'a'), plot(110, 120, 'b')], 40)
    expect(cluster.x).toBeCloseTo(105)
    expect(cluster.y).toBeCloseTo(110)
  })

  it('names the cluster after its first member, because callers pass rank order', () => {
    const [cluster] = clusterByScreenDistance(
      [plot(100, 100, 'most-significant'), plot(102, 100, 'lesser')],
      20,
    )
    expect(cluster.lead).toBe('most-significant')
    expect(cluster.items[0]).toBe('most-significant')
  })

  it('keeps every input point — a merged mark hides nothing', () => {
    const points = Array.from({ length: 200 }, (_, i) => plot((i % 20) * 7, Math.floor(i / 20) * 7, `p${i}`))
    const clusters = clusterByScreenDistance(points, 25)
    const members = clusters.flatMap((c) => c.items)
    expect(members).toHaveLength(200)
    expect(new Set(members).size).toBe(200)
    expect(clusters.length).toBeLessThan(200)
  })

  it('never merges two marks further apart than the radius', () => {
    const points = Array.from({ length: 60 }, (_, i) => plot(i * 9, (i * 13) % 200, `p${i}`))
    const radius = 18
    for (const cluster of clusterByScreenDistance(points, radius)) {
      for (const item of cluster.items) {
        const source = points.find((p) => p.item === item)!
        // Every member is inside the radius of the mark that represents it.
        expect(Math.hypot(source.x - cluster.x, source.y - cluster.y)).toBeLessThanOrEqual(radius + 1e-6)
      }
    }
  })

  it('is deterministic — the same input gives the same grouping every frame', () => {
    const points = Array.from({ length: 120 }, (_, i) => plot((i * 37) % 300, (i * 53) % 300, `p${i}`))
    const first = clusterByScreenDistance(points, 22).map((c) => c.items.join(','))
    const second = clusterByScreenDistance(points, 22).map((c) => c.items.join(','))
    expect(second).toEqual(first)
  })

  it('splits a cluster as the reader zooms in', () => {
    // The same two events, projected at two zoom levels of the flat map.
    const viewport = { width: 600, height: 300 }
    const near = { lat: 48.9, lon: 2.4 }
    const other = { lat: 46.5, lon: 4.5 }
    const at = (zoom: number) =>
      clusterByScreenDistance(
        [near, other].map((c, i) => {
          const p = projectMap(c.lat, c.lon, { zoom, offsetX: 0, offsetY: 0 }, viewport)
          return plot(p.x, p.y, `e${i}`)
        }),
        18,
      )
    expect(at(1)).toHaveLength(1)
    expect(at(8)).toHaveLength(2)
  })

  it('clusters by what the reader sees, not by ground distance', () => {
    /**
     * The whole argument for screen-space clustering. These two pairs are the
     * same 20° of longitude apart, but near the pole that is a few hundred
     * kilometres of ground and a few pixels of screen, while at the equator it
     * is thousands of kilometres and a wide gap. A kilometre-based radius has to
     * be wrong for one of them; a pixel-based radius is right for both.
     */
    const viewport = { width: 400, height: 400 }
    const camera = { rotation: 0, tilt: 0, zoom: 1 }
    const project = (lat: number, lon: number, id: string) => {
      const p = projectGlobe(lat, lon, camera, viewport)
      return plot(p.x, p.y, id)
    }
    const polar = clusterByScreenDistance([project(85, -10, 'a'), project(85, 10, 'b')], 20)
    const equatorial = clusterByScreenDistance([project(0, -10, 'c'), project(0, 10, 'd')], 20)
    expect(polar).toHaveLength(1)
    expect(equatorial).toHaveLength(2)
  })

  it('returns one mark per point when clustering is switched off', () => {
    const points = [plot(10, 10, 'a'), plot(11, 11, 'b')]
    expect(clusterByScreenDistance(points, 0)).toHaveLength(2)
    expect(clusterByScreenDistance(points, Number.NaN)).toHaveLength(2)
    expect(clusterByScreenDistance([], 20)).toEqual([])
  })

  it('handles negative screen coordinates, which happen whenever the map is panned', () => {
    const clusters = clusterByScreenDistance([plot(-40, -40, 'a'), plot(-38, -42, 'b')], 15)
    expect(clusters).toHaveLength(1)
  })
})

describe('meanCoordinate', () => {
  it('averages ordinary coordinates', () => {
    const mean = meanCoordinate([
      { lat: 10, lon: 20 },
      { lat: 20, lon: 30 },
    ])
    expect(mean?.lat).toBeCloseTo(15.1, 0)
    expect(mean?.lon).toBeCloseTo(25, 0)
  })

  it('crosses the antimeridian instead of landing in the wrong ocean', () => {
    const mean = meanCoordinate([
      { lat: 0, lon: 179 },
      { lat: 0, lon: -179 },
    ])
    // Arithmetic averaging would answer 0° — the middle of the Atlantic.
    expect(Math.abs(mean?.lon as number)).toBeCloseTo(180, 1)
    expect(mean?.lat).toBeCloseTo(0, 6)
  })

  it('has no answer for an empty set or for exact antipodes, and says so', () => {
    expect(meanCoordinate([])).toBeNull()
    expect(
      meanCoordinate([
        { lat: 0, lon: 0 },
        { lat: 0, lon: 180 },
      ]),
    ).toBeNull()
  })
})
