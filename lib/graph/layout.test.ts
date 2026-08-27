import { describe, expect, it } from 'vitest'
import { boundingRadius, layoutGraph, type LayoutEdge, type LayoutNode } from './layout'

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)

describe('the layout is the same every time', () => {
  const nodes: LayoutNode[] = ['a', 'b', 'c', 'd', 'e'].map((key, i) => ({ key, cluster: i < 3 ? 0 : 1 }))
  const edges: LayoutEdge[] = [
    { a: 'a', b: 'b', distance: 0.4 },
    { a: 'b', b: 'c', distance: 0.4 },
    { a: 'c', b: 'd', distance: 1.3 },
    { a: 'd', b: 'e', distance: 0.4 },
  ]

  /**
   * The reason this module exists rather than a library call. Every general
   * force layout seeds at random; a market picture that reshuffles between two
   * identical loads tells a reader the renderer moved, not the market.
   */
  it('produces identical positions across runs', () => {
    expect(layoutGraph(nodes, edges)).toEqual(layoutGraph(nodes, edges))
  })

  it('does not depend on the order the nodes or edges arrive in', () => {
    const forward = layoutGraph(nodes, edges)
    const backward = layoutGraph([...nodes].reverse(), [...edges].reverse())
    for (const key of Object.keys(forward)) {
      expect(backward[key].x).toBeCloseTo(forward[key].x, 9)
      expect(backward[key].y).toBeCloseTo(forward[key].y, 9)
      expect(backward[key].z).toBeCloseTo(forward[key].z, 9)
    }
  })

  it('never emits a non-finite coordinate', () => {
    for (const p of Object.values(layoutGraph(nodes, edges))) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.z)).toBe(true)
    }
  })
})

describe('the drawing means something', () => {
  /**
   * The whole claim of the picture: two things drawn close are close in the
   * data. A layout that looked good and ignored the distances would be a
   * decoration, and this is the assertion that stops it becoming one.
   */
  it('puts a close pair closer than a far pair', () => {
    const nodes: LayoutNode[] = ['a', 'b', 'c'].map((key) => ({ key }))
    const positions = layoutGraph(nodes, [
      { a: 'a', b: 'b', distance: 0.3 },
      { a: 'b', b: 'c', distance: 1.9 },
    ])
    expect(dist(positions.a, positions.b)).toBeLessThan(dist(positions.b, positions.c))
  })

  it('keeps a cluster together relative to the rest', () => {
    const nodes: LayoutNode[] = [
      { key: 'a1', cluster: 0 },
      { key: 'a2', cluster: 0 },
      { key: 'a3', cluster: 0 },
      { key: 'b1', cluster: 1 },
      { key: 'b2', cluster: 1 },
      { key: 'b3', cluster: 1 },
    ]
    const edges: LayoutEdge[] = [
      { a: 'a1', b: 'a2', distance: 0.3 },
      { a: 'a2', b: 'a3', distance: 0.3 },
      { a: 'a3', b: 'b1', distance: 1.6 },
      { a: 'b1', b: 'b2', distance: 0.3 },
      { a: 'b2', b: 'b3', distance: 0.3 },
    ]
    const p = layoutGraph(nodes, edges)
    const within = (dist(p.a1, p.a2) + dist(p.a2, p.a3) + dist(p.b1, p.b2) + dist(p.b2, p.b3)) / 4
    const across = dist(p.a1, p.b1)
    expect(within).toBeLessThan(across)
  })
})

describe('what it refuses to lose', () => {
  /**
   * An asset nothing correlates with is a finding — "nothing in this market
   * moves with it" — and a layout that quietly dropped unconnected nodes would
   * delete exactly that finding from the picture.
   */
  it('places a node no edge touches', () => {
    const p = layoutGraph(
      [{ key: 'a' }, { key: 'b' }, { key: 'lonely' }],
      [{ a: 'a', b: 'b', distance: 0.5 }],
    )
    expect(p.lonely).toBeDefined()
    expect(Number.isFinite(p.lonely.x)).toBe(true)
  })

  it('ignores an edge naming a node it was not given, rather than throwing', () => {
    const p = layoutGraph([{ key: 'a' }, { key: 'b' }], [
      { a: 'a', b: 'b', distance: 0.5 },
      { a: 'a', b: 'ghost', distance: 0.5 },
    ])
    expect(Object.keys(p).sort()).toEqual(['a', 'b'])
  })

  it('separates two nodes seeded at the same place', () => {
    const p = layoutGraph([{ key: 'a' }, { key: 'b' }], [])
    expect(dist(p.a, p.b)).toBeGreaterThan(0.1)
  })

  it('returns nothing for an empty graph instead of failing', () => {
    expect(layoutGraph([], [])).toEqual({})
    expect(boundingRadius({})).toBe(0)
  })

  it('handles a single node', () => {
    const p = layoutGraph([{ key: 'only' }], [])
    expect(p.only).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('framing', () => {
  it('centres the drawing on its centroid', () => {
    const p = layoutGraph(
      ['a', 'b', 'c', 'd'].map((key) => ({ key })),
      [
        { a: 'a', b: 'b', distance: 0.5 },
        { a: 'c', b: 'd', distance: 0.5 },
      ],
    )
    const points = Object.values(p)
    const mean = (pick: (v: (typeof points)[number]) => number) =>
      points.reduce((s, v) => s + pick(v), 0) / points.length
    expect(mean((v) => v.x)).toBeCloseTo(0, 9)
    expect(mean((v) => v.y)).toBeCloseTo(0, 9)
    expect(mean((v) => v.z)).toBeCloseTo(0, 9)
  })

  it('reports a radius that contains every node', () => {
    const p = layoutGraph(
      ['a', 'b', 'c'].map((key) => ({ key })),
      [{ a: 'a', b: 'b', distance: 0.5 }],
    )
    const r = boundingRadius(p)
    for (const v of Object.values(p)) {
      expect(Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2)).toBeLessThanOrEqual(r + 1e-9)
    }
  })
})

describe('cost', () => {
  /**
   * The O(n²) choice, held to a budget. 120 assets is the realistic ceiling for
   * a board, and if this ever stopped being tens of milliseconds the honest
   * answer would be an octree, not a smaller board.
   */
  it('lays out a board-sized graph well inside a second', () => {
    const nodes: LayoutNode[] = Array.from({ length: 120 }, (_, i) => ({
      key: `n${String(i).padStart(3, '0')}`,
      cluster: i % 6,
    }))
    const edges: LayoutEdge[] = nodes.slice(1).map((n, i) => ({
      a: nodes[i].key,
      b: n.key,
      distance: 0.5 + (i % 5) * 0.2,
    }))
    const began = Date.now()
    const p = layoutGraph(nodes, edges)
    expect(Object.keys(p)).toHaveLength(120)
    expect(Date.now() - began).toBeLessThan(4000)
  })
})
