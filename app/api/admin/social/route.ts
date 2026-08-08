import { NextResponse } from 'next/server'
import { repo, isDbConfigured, type SocialChannel } from '@/lib/db'
import { adminGate } from '@/lib/social/admin'
import { ALL_PUBLISHERS, publisherFor } from '@/lib/social/publishers'
import { encryptSecret, isSecretStorageConfigured } from '@/lib/social/secrets'
import type { SocialPlatform } from '@/lib/social/types'

/**
 * /api/admin/social — the operator's publishing channels.
 *
 * Guarded by ADMIN_SECRET. A stored bot token is never returned by any of these
 * routes, in any shape: the dashboard shows whether a token exists, never what
 * it is.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PLATFORMS: SocialPlatform[] = ['webhook', 'discord', 'slack', 'telegram']
const KINDS = ['post', 'research', 'signal'] as const

/** The public shape of a channel — deliberately without the ciphertext. */
function toPublic(c: SocialChannel) {
  return {
    id: c.id,
    platform: c.platform,
    label: c.label,
    target: c.target,
    hasSecret: Boolean(c.secretEnc),
    enabled: c.enabled,
    autoPublish: c.autoPublish,
    kindFilter: c.kindFilter,
    lastStatus: c.lastStatus,
    lastError: c.lastError,
    lastAt: c.lastAt?.toISOString() ?? null,
    deliveredCount: c.deliveredCount,
    failedCount: c.failedCount,
    createdAt: c.createdAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }
  const channels = await repo.socialChannels.list()
  return NextResponse.json({
    channels: channels.map(toPublic),
    secretStorage: isSecretStorageConfigured(),
    platforms: ALL_PUBLISHERS.map((p) => ({
      platform: p.platform,
      targetHint: p.targetHint,
      needsSecret: p.needsSecret,
    })),
  })
}

export async function POST(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const platform = body.platform as SocialPlatform
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 })
  }
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (label.length < 2 || label.length > 80) {
    return NextResponse.json({ error: 'Give the channel a name (2–80 characters)' }, { status: 400 })
  }

  const publisher = publisherFor(platform)
  const target = publisher.validateTarget(String(body.target ?? ''))
  if (!target) {
    return NextResponse.json({ error: `Invalid target — ${publisher.targetHint}` }, { status: 400 })
  }

  let secretEnc: string | null = null
  if (publisher.needsSecret) {
    const secret = typeof body.secret === 'string' ? body.secret.trim() : ''
    if (!secret) return NextResponse.json({ error: 'This platform needs a bot token' }, { status: 400 })
    if (!isSecretStorageConfigured()) {
      // Refusing is the point: storing it in plain text would be worse.
      return NextResponse.json(
        { error: 'SOCIAL_SECRET_KEY is not set, so a bot token cannot be stored securely yet' },
        { status: 503 },
      )
    }
    secretEnc = encryptSecret(secret)
  }

  const kindFilter =
    typeof body.kindFilter === 'string' && (KINDS as readonly string[]).includes(body.kindFilter)
      ? (body.kindFilter as (typeof KINDS)[number])
      : null

  const created = await repo.socialChannels.create({
    platform,
    label,
    target,
    secretEnc,
    enabled: body.enabled !== false,
    // Auto-publish is off unless explicitly asked for — a channel must never
    // start broadcasting merely because it was added.
    autoPublish: body.autoPublish === true,
    kindFilter,
  })
  return NextResponse.json({ channel: toPublic(created) }, { status: 201 })
}

export async function PATCH(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'Missing channel id' }, { status: 400 })

  const patch: Parameters<typeof repo.socialChannels.update>[1] = {}
  if (typeof body.label === 'string' && body.label.trim().length >= 2) {
    patch.label = body.label.trim()
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.autoPublish === 'boolean') patch.autoPublish = body.autoPublish
  if (body.kindFilter === null) patch.kindFilter = null
  else if (typeof body.kindFilter === 'string' && (KINDS as readonly string[]).includes(body.kindFilter)) {
    patch.kindFilter = body.kindFilter as (typeof KINDS)[number]
  }

  const updated = await repo.socialChannels.update(id, patch)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ channel: toPublic(updated) })
}

export async function DELETE(request: Request) {
  const denied = adminGate(request)
  if (denied) return denied
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 })
  }
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing channel id' }, { status: 400 })
  await repo.socialChannels.remove(id)
  return NextResponse.json({ ok: true })
}
