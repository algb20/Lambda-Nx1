/**
 * The two projections the world surface can be drawn in, kept as pure functions
 * so the toggle between them is a data decision, not two unrelated renderers.
 *
 * Both share one contract: (lat, lon) → screen {x, y, visible}. Anything the
 * canvas draws — outlines, signal points, great-circle arcs — goes through this,
 * which is why the same event list plots identically on the globe and the map.
 */

export type ViewMode = 'globe' | 'map'

export interface ScreenPoint {
  x: number
  y: number
  /** False when the coordinate is on the far side of the sphere / off-canvas. */
  visible: boolean
}

export interface GlobeCamera {
  /** Yaw in radians — how far the globe has spun. */
  rotation: number
  /** Pitch in radians, clamped by the caller to keep the poles usable. */
  tilt: number
  zoom: number
}

export interface MapCamera {
  zoom: number
  /** Pan offset in screen pixels, applied after projection. */
  offsetX: number
  offsetY: number
}

export interface Viewport {
  width: number
  height: number
}

/** Orthographic (globe) projection: the view from infinitely far away. */
export function projectGlobe(
  lat: number,
  lon: number,
  camera: GlobeCamera,
  viewport: Viewport,
): ScreenPoint {
  const R = globeRadius(camera, viewport)
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180 + camera.rotation
  const x = Math.cos(la) * Math.sin(lo)
  const y = Math.sin(la)
  const z = Math.cos(la) * Math.cos(lo)
  const cosT = Math.cos(camera.tilt)
  const sinT = Math.sin(camera.tilt)
  const y2 = y * cosT - z * sinT
  const z2 = y * sinT + z * cosT
  return { x: cx + x * R, y: cy - y2 * R, visible: z2 > 0 }
}

/** Sphere radius in pixels for the current viewport and zoom. */
export function globeRadius(camera: GlobeCamera, viewport: Viewport): number {
  return (Math.min(viewport.width, viewport.height) / 2 - 18) * camera.zoom
}

/**
 * Equirectangular (flat map) projection. Chosen over Mercator on purpose: it
 * keeps latitude linear, so a point's vertical position is proportional to its
 * real latitude and high-latitude regions are not inflated to several times
 * their true size — an analyst comparing activity between regions should not be
 * misled by the projection.
 */
export function projectMap(
  lat: number,
  lon: number,
  camera: MapCamera,
  viewport: Viewport,
): ScreenPoint {
  const { w, h, left, top } = mapFrame(camera, viewport)
  const x = left + ((lon + 180) / 360) * w
  const y = top + ((90 - lat) / 180) * h
  return {
    x,
    y,
    visible: x >= -32 && x <= viewport.width + 32 && y >= -32 && y <= viewport.height + 32,
  }
}

/**
 * Where the 2:1 map rectangle sits inside the viewport. Letterboxed so the map
 * keeps its aspect ratio at any container size, then scaled and panned.
 */
export function mapFrame(camera: MapCamera, viewport: Viewport) {
  const base = Math.min(viewport.width, viewport.height * 2)
  const w = base * camera.zoom
  const h = w / 2
  return {
    w,
    h,
    left: (viewport.width - w) / 2 + camera.offsetX,
    top: (viewport.height - h) / 2 + camera.offsetY,
  }
}

/** Screen point back to (lat, lon) on the flat map — for click-to-inspect. */
export function unprojectMap(
  x: number,
  y: number,
  camera: MapCamera,
  viewport: Viewport,
): { lat: number; lon: number } | null {
  const { w, h, left, top } = mapFrame(camera, viewport)
  const lon = ((x - left) / w) * 360 - 180
  const lat = 90 - ((y - top) / h) * 180
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

/**
 * Screen point back to (lat, lon) on the globe — the inverse of projectGlobe.
 *
 * This is what lets the surface report the coordinate under the cursor. It
 * returns null outside the sphere's disc rather than clamping to the rim, so a
 * readout is either a real position on the planet or nothing at all.
 */
export function unprojectGlobe(
  x: number,
  y: number,
  camera: GlobeCamera,
  viewport: Viewport,
): { lat: number; lon: number } | null {
  const R = globeRadius(camera, viewport)
  if (R <= 0) return null
  const cx = viewport.width / 2
  const cy = viewport.height / 2
  const dx = (x - cx) / R
  const dy = -(y - cy) / R
  const r2 = dx * dx + dy * dy
  // Outside the disc: the pointer is on the backdrop, not on the planet.
  if (r2 > 1) return null

  // Invert the projection: x and y2 are known, z2 follows from the unit sphere.
  const z2 = Math.sqrt(Math.max(0, 1 - r2))
  const cosT = Math.cos(camera.tilt)
  const sinT = Math.sin(camera.tilt)
  // Undo the tilt rotation applied in projectGlobe.
  const yv = dy * cosT + z2 * sinT
  const zv = -dy * sinT + z2 * cosT
  const xv = dx

  const lat = (Math.asin(Math.max(-1, Math.min(1, yv))) * 180) / Math.PI
  let lon = ((Math.atan2(xv, zv) - camera.rotation) * 180) / Math.PI
  // Normalise into (-180, 180].
  lon = ((((lon + 180) % 360) + 360) % 360) - 180
  return { lat, lon }
}

/** Convert lat/lon (deg) to the unit vector projectGlobe works in. */
export function toVector(lat: number, lon: number): [number, number, number] {
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}

/**
 * Sample a great-circle path between two points (spherical interpolation).
 * On the globe this is the shortest real path; on the flat map it is the curve
 * that path traces, which is why flows look bent there — that is the truth, not
 * a drawing artefact.
 */
export function greatCircle(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  steps = 48,
): Array<[number, number]> {
  const v0 = toVector(a.lat, a.lon)
  const v1 = toVector(b.lat, b.lon)
  const dot = Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]))
  const omega = Math.acos(dot)
  if (omega < 1e-6) return [[a.lat, a.lon]]
  const sinO = Math.sin(omega)
  const out: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const s0 = Math.sin((1 - t) * omega) / sinO
    const s1 = Math.sin(t * omega) / sinO
    const x = s0 * v0[0] + s1 * v1[0]
    const y = s0 * v0[1] + s1 * v1[1]
    const z = s0 * v0[2] + s1 * v1[2]
    out.push([
      (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI,
      (Math.atan2(x, z) * 180) / Math.PI,
    ])
  }
  return out
}
