import { describe, it, expect } from 'vitest'
import {
  globeRadius,
  greatCircle,
  mapFrame,
  projectGlobe,
  projectMap,
  unprojectGlobe,
  unprojectMap,
} from './projection'

const viewport = { width: 400, height: 400 }
const camera = { rotation: 0, tilt: 0, zoom: 1 }

describe('projectGlobe', () => {
  it('puts the point facing the camera dead centre', () => {
    const p = projectGlobe(0, 0, camera, viewport)
    expect(p.x).toBeCloseTo(200)
    expect(p.y).toBeCloseTo(200)
    expect(p.visible).toBe(true)
  })

  it('hides the far hemisphere instead of drawing through the planet', () => {
    expect(projectGlobe(0, 180, camera, viewport).visible).toBe(false)
    expect(projectGlobe(0, 120, camera, viewport).visible).toBe(false)
    expect(projectGlobe(0, 60, camera, viewport).visible).toBe(true)
  })

  it('places north above centre and east to the right', () => {
    const north = projectGlobe(45, 0, camera, viewport)
    const east = projectGlobe(0, 45, camera, viewport)
    expect(north.y).toBeLessThan(200)
    expect(east.x).toBeGreaterThan(200)
  })

  it('follows the camera as the globe spins', () => {
    const spun = { ...camera, rotation: Math.PI }
    // With the globe turned half a revolution, lon 180 now faces us.
    expect(projectGlobe(0, 180, spun, viewport).visible).toBe(true)
    expect(projectGlobe(0, 0, spun, viewport).visible).toBe(false)
  })

  it('scales the sphere with zoom', () => {
    expect(globeRadius({ ...camera, zoom: 2 }, viewport)).toBeCloseTo(
      globeRadius(camera, viewport) * 2,
    )
  })
})

describe('projectMap', () => {
  const mapCam = { zoom: 1, offsetX: 0, offsetY: 0 }

  it('keeps the 2:1 equirectangular aspect inside the viewport', () => {
    const frame = mapFrame(mapCam, viewport)
    expect(frame.w / frame.h).toBeCloseTo(2)
    expect(frame.w).toBeLessThanOrEqual(viewport.width)
  })

  it('places 0,0 at the centre of the map rectangle', () => {
    const frame = mapFrame(mapCam, viewport)
    const p = projectMap(0, 0, mapCam, viewport)
    expect(p.x).toBeCloseTo(frame.left + frame.w / 2)
    expect(p.y).toBeCloseTo(frame.top + frame.h / 2)
  })

  it('keeps latitude linear — the reason we did not pick Mercator', () => {
    const frame = mapFrame(mapCam, viewport)
    const at30 = projectMap(30, 0, mapCam, viewport)
    const at60 = projectMap(60, 0, mapCam, viewport)
    const midY = frame.top + frame.h / 2
    // 60° must be exactly twice as far from the equator as 30°.
    expect((midY - at60.y) / (midY - at30.y)).toBeCloseTo(2)
  })

  it('round-trips a coordinate through unprojectMap', () => {
    for (const [lat, lon] of [
      [48.85, 2.35],
      [-33.87, 151.21],
      [0, 0],
      [70, -120],
    ] as Array<[number, number]>) {
      const p = projectMap(lat, lon, mapCam, viewport)
      const back = unprojectMap(p.x, p.y, mapCam, viewport)!
      expect(back.lat).toBeCloseTo(lat, 6)
      expect(back.lon).toBeCloseTo(lon, 6)
    }
  })

  it('reports points panned off the canvas as not visible', () => {
    const panned = { zoom: 1, offsetX: 5000, offsetY: 0 }
    expect(projectMap(0, 0, panned, viewport).visible).toBe(false)
  })

  it('returns null when a click lands outside the map rectangle', () => {
    expect(unprojectMap(-9999, 0, mapCam, viewport)).toBeNull()
  })
})

describe('greatCircle', () => {
  it('starts and ends on the two endpoints', () => {
    const path = greatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, 8)
    expect(path).toHaveLength(9)
    expect(path[0][0]).toBeCloseTo(0)
    expect(path[0][1]).toBeCloseTo(0)
    expect(path[8][1]).toBeCloseTo(90)
  })

  it('bends toward the pole on a long northern route, as a real path does', () => {
    // London → Tokyo passes far north of both cities' latitude.
    const path = greatCircle({ lat: 51.5, lon: -0.13 }, { lat: 35.7, lon: 139.7 }, 32)
    const maxLat = Math.max(...path.map(([lat]) => lat))
    expect(maxLat).toBeGreaterThan(60)
  })

  it('collapses to a single point when both ends coincide', () => {
    expect(greatCircle({ lat: 10, lon: 10 }, { lat: 10, lon: 10 })).toHaveLength(1)
  })
})

describe('unprojectGlobe — the coordinate under the cursor', () => {
  const viewport = { width: 400, height: 400 }

  it('round-trips a coordinate on the near hemisphere', () => {
    for (const cam of [
      { rotation: 0, tilt: 0, zoom: 1 },
      { rotation: 0.7, tilt: 0.35, zoom: 1.4 },
      { rotation: -2.1, tilt: -0.6, zoom: 2 },
    ]) {
      for (const [lat, lon] of [
        [0, 0],
        [35.6, 139.7],
        [-33.87, 151.21],
        [48.85, 2.35],
      ] as Array<[number, number]>) {
        const p = projectGlobe(lat, lon, cam, viewport)
        if (!p.visible) continue // the far side has no cursor position to report
        const back = unprojectGlobe(p.x, p.y, cam, viewport)!
        expect(back, `${lat},${lon}`).not.toBeNull()
        expect(back.lat).toBeCloseTo(lat, 4)
        expect(back.lon).toBeCloseTo(lon, 4)
      }
    }
  })

  /** A readout is a real position on the planet, or nothing. */
  it('returns null off the sphere rather than clamping to the rim', () => {
    const cam = { rotation: 0, tilt: 0, zoom: 1 }
    expect(unprojectGlobe(0, 0, cam, viewport)).toBeNull()
    expect(unprojectGlobe(399, 399, cam, viewport)).toBeNull()
    expect(unprojectGlobe(200, 200, cam, viewport)).not.toBeNull()
  })

  it('keeps longitude inside (-180, 180]', () => {
    const cam = { rotation: 3.0, tilt: 0.2, zoom: 1 }
    for (let x = 25; x < 375; x += 7) {
      for (let y = 25; y < 375; y += 7) {
        const p = unprojectGlobe(x, y, cam, viewport)
        if (!p) continue
        expect(p.lon).toBeGreaterThan(-180.0001)
        expect(p.lon).toBeLessThanOrEqual(180.0001)
        expect(Math.abs(p.lat)).toBeLessThanOrEqual(90.0001)
      }
    }
  })
})
