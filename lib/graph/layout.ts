/**
 * Where a graph's nodes sit in space, decided the same way every time.
 *
 * ## Determinism is the requirement, not a nicety
 *
 * Every force-directed layout in general use seeds its nodes at random. That is
 * fine for a toy and wrong here for two reasons. The charter forbids
 * `Math.random()` in shipped code, and — the reason behind the rule — a picture
 * of a market that rearranges itself between two identical loads is not a
 * finding. A reader who returns to a chart and finds a different shape cannot
 * tell whether the market moved or the renderer did.
 *
 * So the seed is the data: nodes are placed on a Fibonacci sphere in sorted key
 * order, and every force below is a pure function of positions and edges. Same
 * input, same output, on every machine and every reload.
 *
 * ## The three forces, and what each is for
 *
 * - **Repulsion** between every pair, so nodes do not stack. Inverse-square,
 *   softened near zero so two coincident nodes separate rather than explode.
 * - **Springs** along edges, with a rest length taken from the edge's own
 *   distance. This is what makes the drawing mean something: two assets that
 *   correlate at 0.95 are drawn close *because* they correlate at 0.95, not
 *   because the layout felt like it.
 * - **Cluster cohesion**, a gentle pull toward each cluster's centroid. Without
 *   it a spanning tree spreads into a thin filament and the group structure —
 *   the thing a reader is looking for — is invisible.
 *
 * The cohesion pull is damped by **√(cluster size)**, and that correction was
 * forced by a measurement. Scaled linearly by size, an 81-member cluster pulled
 * with eighty-one times the force of a singleton and collapsed into an
 * unreadable knot: on the live crypto board the ratio of the 90th-percentile
 * radius to the median was **4.57**, meaning the group holding 83% of the market
 * occupied under a fifth of the frame. With √n damping the same graph measures
 * **2.37**, and the median nearest-neighbour spacing doubles. Nothing about the
 * data changed — cohesion is a layout aid, not a measurement, and the springs
 * that carry the meaning were untouched.
 *
 * ## Why O(n²) is the right call here
 *
 * Barnes–Hut exists because n gets large. Here n is the number of instruments
 * on a board — 250 at the very most, usually under 100 — and 250 nodes is
 * 31,125 pairs per iteration. At 400 iterations that is twelve million distance
 * computations, which is a few tens of milliseconds once, on the server, cached
 * with the report. An octree would cost more in code than it saves in time, and
 * approximate forces would make the result depend on tree-build order.
 */

export interface LayoutNode {
  key: string
  /** Group index; nodes sharing one are pulled together. */
  cluster?: number
  /** Relative pull weight — a larger asset anchors the picture. 1 by default. */
  mass?: number
}

export interface LayoutEdge {
  a: string
  b: string
  /**
   * How far apart the two should sit, in the same units as the output. Taken
   * straight from the data — for a correlation network, Mantegna's distance.
   */
  distance: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface LayoutOptions {
  /** Fixed iteration count. More is smoother, not different. Default 400. */
  iterations?: number
  /** Repulsion strength between every pair. Default 0.9. */
  repulsion?: number
  /** Spring stiffness along edges. Default 0.25. */
  stiffness?: number
  /** Pull toward the cluster centroid. Default 0.02. */
  cohesion?: number
  /** Scale the rest lengths so the whole graph fits a comfortable radius. */
  scale?: number
}

/**
 * A point on the Fibonacci sphere — the standard way to place `n` points on a
 * sphere with near-uniform spacing and no clustering at the poles, which a
 * naive latitude/longitude grid produces.
 */
function fibonacciPoint(index: number, count: number): Vec3 {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = count === 1 ? 0 : 1 - (index / (count - 1)) * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = golden * index
  return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius }
}

/** Squared length, used everywhere a square root would be wasted. */
function lengthSquared(dx: number, dy: number, dz: number): number {
  return dx * dx + dy * dy + dz * dz
}

/**
 * Lay the graph out.
 *
 * Returns a position for every node given, including nodes no edge touches —
 * an isolated asset is a finding (nothing in this market moves with it) and
 * dropping it from the drawing would hide that.
 */
export function layoutGraph(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  options: LayoutOptions = {},
): Record<string, Vec3> {
  const iterations = options.iterations ?? 400
  const repulsion = options.repulsion ?? 0.9
  const stiffness = options.stiffness ?? 0.25
  const cohesion = options.cohesion ?? 0.02
  const scale = options.scale ?? 1

  const ordered = [...nodes].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const n = ordered.length
  if (n === 0) return {}

  const index = new Map<string, number>()
  ordered.forEach((node, i) => index.set(node.key, i))

  const px = new Float64Array(n)
  const py = new Float64Array(n)
  const pz = new Float64Array(n)
  const mass = new Float64Array(n)
  const cluster = new Int32Array(n)

  ordered.forEach((node, i) => {
    // Seeded on a sphere of radius 3 so the first iteration has room to sort
    // itself out rather than starting from a single overlapping ball.
    const p = fibonacciPoint(i, n)
    px[i] = p.x * 3
    py[i] = p.y * 3
    pz[i] = p.z * 3
    mass[i] = Math.max(0.1, node.mass ?? 1)
    cluster[i] = node.cluster ?? -1
  })

  const springs = edges
    .map((e) => ({ a: index.get(e.a), b: index.get(e.b), rest: e.distance * scale }))
    .filter((e): e is { a: number; b: number; rest: number } => e.a !== undefined && e.b !== undefined)

  const fx = new Float64Array(n)
  const fy = new Float64Array(n)
  const fz = new Float64Array(n)

  for (let step = 0; step < iterations; step++) {
    fx.fill(0)
    fy.fill(0)
    fz.fill(0)

    // Repulsion, every pair once.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = px[i] - px[j]
        const dy = py[i] - py[j]
        const dz = pz[i] - pz[j]
        /**
         * The softening term. Two nodes at the same point have zero distance
         * and infinite force; 0.01 caps that at something the integrator can
         * absorb, and it is small enough not to affect any real separation.
         */
        const d2 = lengthSquared(dx, dy, dz) + 0.01
        const d = Math.sqrt(d2)
        const force = (repulsion * mass[i] * mass[j]) / d2
        const ux = dx / d
        const uy = dy / d
        const uz = dz / d
        fx[i] += ux * force
        fy[i] += uy * force
        fz[i] += uz * force
        fx[j] -= ux * force
        fy[j] -= uy * force
        fz[j] -= uz * force
      }
    }

    // Springs along the edges.
    for (const s of springs) {
      const dx = px[s.b] - px[s.a]
      const dy = py[s.b] - py[s.a]
      const dz = pz[s.b] - pz[s.a]
      const d = Math.sqrt(lengthSquared(dx, dy, dz)) || 1e-6
      const pull = stiffness * (d - s.rest)
      const ux = (dx / d) * pull
      const uy = (dy / d) * pull
      const uz = (dz / d) * pull
      fx[s.a] += ux
      fy[s.a] += uy
      fz[s.a] += uz
      fx[s.b] -= ux
      fy[s.b] -= uy
      fz[s.b] -= uz
    }

    // Cluster cohesion, computed from this step's positions.
    if (cohesion > 0) {
      const sums = new Map<number, { x: number; y: number; z: number; count: number }>()
      for (let i = 0; i < n; i++) {
        if (cluster[i] < 0) continue
        const acc = sums.get(cluster[i]) ?? { x: 0, y: 0, z: 0, count: 0 }
        acc.x += px[i]
        acc.y += py[i]
        acc.z += pz[i]
        acc.count++
        sums.set(cluster[i], acc)
      }
      for (let i = 0; i < n; i++) {
        const acc = cluster[i] < 0 ? undefined : sums.get(cluster[i])
        if (!acc || acc.count < 2) continue
        fx[i] += (acc.x / acc.count - px[i]) * cohesion * Math.sqrt(acc.count)
        fy[i] += (acc.y / acc.count - py[i]) * cohesion * Math.sqrt(acc.count)
        fz[i] += (acc.z / acc.count - pz[i]) * cohesion * Math.sqrt(acc.count)
      }
    }

    /**
     * A cooling schedule rather than a velocity: this is a relaxation, not a
     * physics simulation, and carrying momentum makes the final state depend on
     * how fast it got there. The step shrinks toward zero so the last
     * iterations settle rather than orbit.
     */
    const cool = 0.12 * (1 - step / iterations) + 0.004
    for (let i = 0; i < n; i++) {
      // Displacement is clamped so one very strong force cannot throw a node
      // across the graph in a single step and destroy the arrangement.
      const dx = Math.max(-1, Math.min(1, fx[i] * cool))
      const dy = Math.max(-1, Math.min(1, fy[i] * cool))
      const dz = Math.max(-1, Math.min(1, fz[i] * cool))
      px[i] += dx
      py[i] += dy
      pz[i] += dz
    }
  }

  // Centre on the centroid, so the drawing is not off in a corner.
  let cx = 0
  let cy = 0
  let cz = 0
  for (let i = 0; i < n; i++) {
    cx += px[i]
    cy += py[i]
    cz += pz[i]
  }
  cx /= n
  cy /= n
  cz /= n

  const out: Record<string, Vec3> = {}
  ordered.forEach((node, i) => {
    out[node.key] = { x: px[i] - cx, y: py[i] - cy, z: pz[i] - cz }
  })
  return out
}

/** The furthest any node sits from the centre — what a camera needs to frame it. */
export function boundingRadius(positions: Record<string, Vec3>): number {
  return radiusPercentile(positions, 1)
}

/**
 * The radius that contains a given fraction of the nodes.
 *
 * Framing on the *furthest* node is the obvious rule and it wastes the screen:
 * a correlation network has a dense body and a handful of strays, and on the
 * live board the outermost node sat at 10.5 while half of them sat inside 3.5.
 * Fitting the maximum shrinks the part anyone is looking at to a fifth of the
 * frame so that two dots can stay on screen.
 *
 * So the camera frames a percentile and lets the strays clip — they are still
 * there, still drawn, and one zoom step away. Which fraction is the caller's
 * choice, because "how much may I cut off" is a judgement, not a constant.
 */
export function radiusPercentile(positions: Record<string, Vec3>, fraction: number): number {
  const radii = Object.values(positions).map((p) => Math.sqrt(lengthSquared(p.x, p.y, p.z)))
  if (radii.length === 0) return 0
  radii.sort((a, b) => a - b)
  const clamped = Math.max(0, Math.min(1, fraction))
  return radii[Math.min(radii.length - 1, Math.floor((radii.length - 1) * clamped))]
}
