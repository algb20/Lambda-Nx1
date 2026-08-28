/**
 * Ask the mail provider, right now, and report exactly what it said.
 *
 * ## Why this route exists
 *
 * Mail is the one part of this system whose correctness cannot be established
 * from inside the process. Every other check reads its own configuration and
 * reports it; this one has to hand a message to somebody else and be told
 * whether they accepted it. Until it does, "configured" only means "a variable
 * is set", which is exactly the kind of check that lets an operator walk away
 * satisfied and broken.
 *
 * It was written the moment the owner reported having set a key and still
 * seeing an error. There is no way to answer that by reasoning — the provider
 * knows why, and nothing else does.
 *
 * ## What it does not do
 *
 * It never returns the key, or any part of it. It reports the *shape* of the
 * configuration — which service was selected, whether a sender exists, what
 * domain that sender is on — because those are the three things that are
 * actually wrong when this fails, and none of them is a secret.
 *
 * ## Why it is admin-gated
 *
 * A route that sends mail to an address in the request body is an open relay if
 * anyone can call it. `ADMIN_SECRET` is the same operator credential the usage
 * registry and the social routes already use.
 */
import { NextResponse } from 'next/server'
import { adminGate } from '@/lib/social/admin'
import { createMailProvider } from '@/lib/mail'
import { planMail } from '@/lib/mail/config'
import { senderShape } from '@/lib/mail/sender'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The configuration as it stands, without sending anything.
 *
 * Deliberately available before the send: half the failures are visible here —
 * a key with no `MAIL_FROM`, or `MAIL_PROVIDER=disabled` left over from an
 * earlier attempt — and finding those costs the operator nothing.
 */
export async function GET(request: Request): Promise<Response> {
  const refusal = adminGate(request)
  if (refusal) return refusal

  const provider = createMailProvider()
  const plan = planMail(process.env)
  const sender = senderShape(process.env.MAIL_FROM)

  /**
   * Every problem comes from the plan, except the one the plan cannot see.
   *
   * `planMail` knows which variables are set; it deliberately does not parse
   * `MAIL_FROM`, because "is this a valid address" is a different question from
   * "is mail configured", and only this route needs it. So: the plan's verdict,
   * then the sender's shape.
   */
  const problems: string[] = []
  if (plan.problem) problems.push(plan.problem)
  if (sender.present && !sender.domain) {
    problems.push(
      `MAIL_FROM does not contain an address (got ${JSON.stringify(process.env.MAIL_FROM?.slice(0, 40))}). It must be an email address, optionally with a display name: Lambda <no-reply@yourdomain.com>.`,
    )
  }

  return NextResponse.json({
    provider: provider.name,
    configured: provider.configured,
    /** How the message would leave, and whether a variable chose that or we inferred it. */
    transport: plan.mode === 'http' ? 'https' : plan.mode === 'smtp' ? 'smtp' : 'none',
    chosenBy: plan.forced ? 'MAIL_PROVIDER' : plan.mode === 'off' ? null : 'the keys that are set',
    sender,
    /**
     * The domain the sender is on, restated as the question the operator has to
     * answer, because this is the single most common failure: a key is valid,
     * the code is right, and the provider refuses because nobody proved they own
     * the domain in the From line.
     */
    senderMustBeVerified: sender.domain
      ? `Your provider must have ${sender.domain} verified, or it will refuse every message.`
      : null,
    problems,
    next: problems.length
      ? 'Fix the above, redeploy so the runtime picks up the new variables, then POST here with {"to":"you@example.com"} to send a real message.'
      : 'Configuration looks complete. POST here with {"to":"you@example.com"} to send a real message and see what the provider says.',
  })
}

/** Send one real message and report the provider's own verdict, verbatim. */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminGate(request)
  if (refusal) return refusal

  const body = (await request.json().catch(() => ({}))) as { to?: unknown }
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Provide {"to": "you@example.com"}' }, { status: 400 })
  }

  const provider = createMailProvider()
  if (!provider.configured) {
    return NextResponse.json(
      {
        delivered: false,
        provider: provider.name,
        detail: 'No mail provider is active. Call GET on this route to see exactly what is missing.',
      },
      { status: 503 },
    )
  }

  const startedAt = Date.now()
  const result = await provider.send({
    to,
    subject: 'Lambda — mail is working',
    text: [
      'This is the test message from your Lambda deployment.',
      '',
      'If you are reading it, verification codes, password resets and the daily',
      'brief can all be delivered. Nothing else needs to be switched on.',
      '',
      `Sent via: ${provider.name}`,
    ].join('\n'),
  })

  return NextResponse.json({
    ...result,
    provider: provider.name,
    tookMs: Date.now() - startedAt,
    /**
     * The provider's own words are the whole point of this route. A bad key, an
     * unverified sender domain and a rejected recipient are three different
     * repairs, and only the provider knows which one this was.
     */
    meaning: result.delivered
      ? 'Accepted for delivery. If it does not arrive, check the spam folder and the provider’s own activity log — from here it left cleanly.'
      : 'Read `detail` above: it is the provider’s own message. A bad key is a settings change, an unverified sender domain is a DNS record, a rejected recipient is the address you sent to.',
  })
}
