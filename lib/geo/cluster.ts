/**
 * Screen-space clustering for the world surface.
 *
 * ## The failure this fixes
 *
 * At world zoom a hundred dots inside one country collapse into a single smear.
 * The busiest place on earth then reads as *one* mark — the exact opposite of
 * what the reader should take from it — and every dot underneath is unclickable,
 * because whichever one happens to be drawn last owns those pixels. A map that
 * hides its own densest region is not a map of activity.
 *
 * So overlapping marks are merged into one that states how many events it stands
 * for, and splits back apart as the reader zooms in. Nothing is discarded: the
 * members travel with the cluster, so a click can still reach them.
 *
 * ## Why the basis is pixels and not kilometres
 *
 * The complaint is visual overlap, so the measurement is visual overlap.
 * Clustering on ground distance would use a radius that means something
 * different at every latitude and in every projection: on the equirectangular
 * map 200 km is a few pixels at the equator and a wide band at 70°N, and on the
 * globe the same 200 km shrinks to nothing as it approaches the limb. A
 * geographic radius is therefore wrong everywhere except the one latitude it was
 * tuned for, and it is wrong in the direction that matters — it would
 * over-merge the high latitudes, which is where the coverage is already
 * thinnest.
 *
 * Pure and dependency-free: it takes points that are already projected, so the
 * same function serves both projections and can be tested without a canvas.
 */

/** A point after projection — where it actually landed on screen. */
export interface PlottedPoint<T> {
  x: number
  y: number
  item: T
}

export interface ScreenCluster<T> {
  /** Centroid of the members, in screen pixels. Where the mark is drawn. */
  x: number
  y: number
  /**
   * The first member in input order.
   *
   * Callers pass points in rank order, so the lead is the cluster's most
   * significant event. The mark takes its colour and its label from the lead,
   * which means a cluster is never named after the least important thing in it.
   */
  lead: T
  items: T[]
}

/**
 * Merge points that sit within `radiusPx` of one another into single marks.
 *
 * Greedy single pass in input order: each point joins the nearest cluster whose
 * centroid it is already within, otherwise it starts one. Greedy rather than
 * k-means because the input order is meaningful (it is the ranking) and because
 * the result must be identical on every frame — a mark that jitters between two
 * groupings while the globe spins is unreadable.
 *
 * A grid keyed on the radius keeps this linear in practice: a centroid within
 * one radius of a point can only be in the point's own cell or the eight around
 * it, so the search never walks the whole cluster list.
 *
 * `radiusPx <= 0` disables clustering and returns one cluster per point, so a
 * caller can turn it off without a second code path.
 */
export function clusterByScreenDistance<T>(
  points: Array<PlottedPoint<T>>,
  radiusPx: number,
): Array<ScreenCluster<T>> {
  if (radiusPx <= 0 || !Number.isFinite(radiusPx)) {
    return points.map((p) => ({ x: p.x, y: p.y, lead: p.item, items: [p.item] }))
  }

  interface Working<U> extends ScreenCluster<U> {
    /** The grid cell the centroid currently sits in, so it can be re-indexed. */
    cell: string
  }

  const clusters: Array<Working<T>> = []
  /** Grid cell → indices of the clusters whose centroid is in that cell. */
  const grid = new Map<string, number[]>()
  const cellOf = (x: number, y: number) => `${Math.floor(x / radiusPx)},${Math.floor(y / radiusPx)}`

  const addToGrid = (cell: string, index: number) => {
    const bucket = grid.get(cell)
    if (bucket) bucket.push(index)
    else grid.set(cell, [index])
  }

  for (const point of points) {
    const gx = Math.floor(point.x / radiusPx)
    const gy = Math.floor(point.y / radiusPx)

    let bestIndex = -1
    let bestDistance = Infinity
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      for (let iy = gy - 1; iy <= gy + 1; iy++) {
        const bucket = grid.get(`${ix},${iy}`)
        if (!bucket) continue
        for (const index of bucket) {
          const cluster = clusters[index]
          const distance = Math.hypot(cluster.x - point.x, cluster.y - point.y)
          // Strictly nearer, so a tie goes to the cluster created first and the
          // grouping is stable frame to frame.
          if (distance <= radiusPx && distance < bestDistance) {
            bestDistance = distance
            bestIndex = index
          }
        }
      }
    }

    if (bestIndex < 0) {
      const cell = cellOf(point.x, point.y)
      clusters.push({ x: point.x, y: point.y, lead: point.item, items: [point.item], cell })
      addToGrid(cell, clusters.length - 1)
      continue
    }

    const cluster = clusters[bestIndex]
    const n = cluster.items.length
    // Running mean: the mark sits at the centre of what it represents rather
    // than on whichever member happened to arrive first.
    cluster.x = (cluster.x * n + point.x) / (n + 1)
    cluster.y = (cluster.y * n + point.y) / (n + 1)
    cluster.items.push(point.item)

    const cell = cellOf(cluster.x, cluster.y)
    if (cell !== cluster.cell) {
      // The centroid drifted into a neighbouring cell; move its index with it or
      // the next point in the old cell would never find it.
      const from = grid.get(cluster.cell)
      if (from) {
        const at = from.indexOf(bestIndex)
        if (at >= 0) from.splice(at, 1)
      }
      addToGrid(cell, bestIndex)
      cluster.cell = cell
    }
  }

  return clusters.map(({ x, y, lead, items }) => ({ x, y, lead, items }))
}

/**
 * The mean direction of a set of coordinates, as a coordinate.
 *
 * Averaging latitude and longitude arithmetically is wrong across the
 * antimeridian — two points at 179°E and 179°W average to 0°, the middle of the
 * Atlantic, which is where a "zoom to this cluster" would then take the reader.
 * Averaging the unit vectors and converting back gives the answer a navigator
 * would give. Returns null for an empty set or for points whose vectors cancel
 * exactly (antipodes), where there is no defensible centre to name.
 */
export function meanCoordinate(
  points: Array<{ lat: number; lon: number }>,
): { lat: number; lon: number } | null {
  if (points.length === 0) return null
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    const la = (p.lat * Math.PI) / 180
    const lo = (p.lon * Math.PI) / 180
    x += Math.cos(la) * Math.sin(lo)
    y += Math.sin(la)
    z += Math.cos(la) * Math.cos(lo)
  }
  const length = Math.hypot(x, y, z)
  if (length < 1e-9) return null
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, y / length))) * 180) / Math.PI,
    lon: (Math.atan2(x, z) * 180) / Math.PI,
  }
}
