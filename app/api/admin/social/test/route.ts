import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { repo, isDbConfigured } from '@/lib/db'
import { adminGate } from '@/lib/social/admin'
import { deliver } from '@/lib/social/broadcast'
import { selfOrigin } from '@/lib/http/self-origin'

/**
 * POST /api/admin/social/test { id } — send one real message to a channel.
 *
 * A configuration screen that cannot prove the configuration works is a screen
 * that quietly lies. This sends an actual message through the actual publisher,
 * and records the outcome exactly as an automatic delivery would.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: { id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  const channel = id ? await repo.socialChannels.getById(id) : undefined
  if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const origin = selfOrigin(await headers()) ?? ''

  const result = await deliver(channel, {
    title: 'Lambda — channel test',
    body: 'If you can read this, the channel is connected and Lambda can publish to it.',
    url: origin,
    kind: 'post',
    author: null,
    publishedAt: new Date().toISOString(),
  })

  await repo.socialChannels.recordDelivery(channel.id, result.ok, result.error ?? null)
  return NextResponse.json({ result })
}
