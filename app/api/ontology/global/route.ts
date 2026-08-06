import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured } from '@/lib/db'
import { defaultGlobalOntology, globalNeighbors } from '@/lib/modules/ontology-global'
import type { EntityType } from '@/lib/engine/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/ontology/global?type=<entityType>&value=<value>
 * Reads an entity's neighborhood from the accumulating global knowledge graph.
 */
export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isDbConfigured())
    return NextResponse.json({ error: 'Global ontology is not configured yet.' }, { status: 503 })

  const url = new URL(request.url)
  const type = (url.searchParams.get('type') ?? '') as EntityType
  const value = url.searchParams.get('value') ?? ''
  if (!type || !value) return NextResponse.json({ error: 'Provide type and value' }, { status: 400 })

  const result = await globalNeighbors(defaultGlobalOntology, type, value)
  if (!result) return NextResponse.json({ node: null, neighbors: [] })
  return NextResponse.json(result)
}
