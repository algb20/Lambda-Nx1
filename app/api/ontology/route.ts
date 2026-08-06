import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured } from '@/lib/db'
import { defaultOntologyStore, loadOntology, neighbors, subgraph } from '@/lib/modules/ontology-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/ontology?investigationId=<id>[&node=<type:value>][&depth=N]
 * Reads a saved investigation's ontology as a traversable knowledge graph. With
 * `node`, returns that node's neighbors + a subgraph around it.
 */
export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Ontology store is not configured yet.' }, { status: 503 })

  const url = new URL(request.url)
  const investigationId = url.searchParams.get('investigationId') ?? ''
  if (!investigationId) return NextResponse.json({ error: 'Missing investigationId' }, { status: 400 })
  const node = url.searchParams.get('node')
  const depth = Math.min(3, Math.max(1, Number(url.searchParams.get('depth') ?? '1') || 1))

  const graph = await loadOntology(defaultOntologyStore, investigationId)
  if (node) {
    return NextResponse.json({
      node,
      neighbors: neighbors(graph, node),
      subgraph: subgraph(graph, node, depth),
    })
  }
  return NextResponse.json({ graph, stats: { nodes: graph.nodes.length, edges: graph.edges.length } })
}
