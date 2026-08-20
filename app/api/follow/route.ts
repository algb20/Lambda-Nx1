import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { mailConfigured, mailer } from '@/lib/mail'
import { followConfirmEmail } from '@/lib/mail/templates'
import { codeRateLimit, readJson, str } from '@/lib/auth/code-flow'
import { SUBMIT_REPLY, TOKEN_BYTES, normaliseEmail } from '@/lib/followers/subscription'

/**
 * POST /api/follow { email, locale } — ask to be sent the brief.
 *
 * Creates a **pending** subscription and sends exactly one message: the one
 * asking whether they meant it. Nothing else is ever sent to an address that has
 * not clicked the link in it.
 *
 * ## The reply is the same whatever happened
 *
 * A new address, an address already subscribed, an address that unsubscribed
 * last year — all three get `SUBMIT_REPLY`, word for word. Distinguishing them
 * would turn this box into a membership oracle: type an address, read the
 * wording, learn whether that person reads us. On a platform whose whole subject
 * is what can be learned from public interfaces, leaving that particular one
 * open would be indefensible.
 *
 * The tokens are generated here and *hashed* before storage, so the only copy of
 * either one is the one in the reader's mailbox.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Where the links in the message point. */
function originOf(request: Request): string {
  const url = new URL(request.url)
  // Behind a proxy the request URL is the internal one; the forwarded headers
  // are what the reader's browser will actually be able to reach.
  const host = request.headers.get('x-forwarded-host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Following requires the database' }, { status: 503 })
  }
  if (!mailConfigured()) {
    // Said plainly rather than accepted and dropped: somebody waiting for a
    // confirmation that cannot exist will try again, and again.
    return NextResponse.json(
      {
        error:
          'Following by email is not available on this deployment — no mail provider is configured.',
      },
      { status: 503 },
    )
  }
  const limited = codeRateLimit(request)
  if (limited) return limited

  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const email = normaliseEmail(str(body.email))
  if (!email) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })

  const locale = str(body.locale).slice(0, 8) || 'en'
  const confirmToken = randomBytes(TOKEN_BYTES).toString('base64url')
  const unsubscribeToken = randomBytes(TOKEN_BYTES).toString('base64url')

  const existing = await repo.followers.byEmail(email)

  /**
   * Already confirmed and still subscribed: send nothing, and say the same
   * sentence anyway.
   *
   * Re-sending a confirmation to somebody who is already in would ask them to
   * prove what they have proved — and it is the obvious way to abuse this form,
   * because it would let anybody mail a subscriber over and over by typing
   * their address into a public box. Checked before writing anything, so a
   * repeat submission does not even rotate their tokens.
   */
  if (existing?.confirmedAt && !existing.unsubscribedAt) {
    return NextResponse.json({ ok: true, message: SUBMIT_REPLY })
  }

  /**
   * Everyone reaching this point is pending or has left, so both tokens are
   * fresh — nobody in either state is holding a live link worth preserving, and
   * a new confirmation should invalidate whatever came before it.
   */
  const row = await repo.followers.request({
    email,
    locale,
    confirmTokenHash: hashPassword(confirmToken),
    unsubscribeTokenHash: hashPassword(unsubscribeToken),
  })

  const origin = originOf(request)
  const result = await mailer().send(
    followConfirmEmail({
      to: email,
      confirmUrl: `${origin}/api/follow/confirm?id=${row.id}&token=${confirmToken}`,
      unsubscribeUrl: `${origin}/api/follow/unsubscribe?id=${row.id}&token=${unsubscribeToken}`,
      locale,
    }),
  )

  if (!result.delivered) {
    return NextResponse.json(
      { error: `Could not send the confirmation: ${result.detail}` },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, message: SUBMIT_REPLY })
}
