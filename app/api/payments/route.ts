import { NextResponse } from 'next/server'
import { providerFor, railForRequest } from '@/lib/payments'
import { piPaymentsConfigured } from '@/lib/payments/pi'
import { decideGrant } from '@/lib/payments/checkout'
import { getSessionUserId } from '@/lib/auth/server'
import { isDbConfigured, repo } from '@/lib/db'

/**
 * POST /api/payments  { action: 'approve'|'complete'|'cancel', paymentId, txid?, metadata? }
 * Server-side payment handling through lib/payments (Pi by default). Requires an
 * authenticated session. Self-contained in the app — works on Pi and standalone.
 *
 * A plan is granted on `complete` and only on `complete`: approval means "we
 * recognise this charge", not "we have been paid", so granting there would hand
 * out Pro to anyone who starts a checkout and walks away. The price itself is
 * never read from the client — lib/payments/checkout fixes it from our plans
 * table — so the metadata here only says *which* plan was bought.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { action?: unknown; paymentId?: unknown; txid?: unknown; metadata?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
  if (!paymentId) return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })

  // The rail follows the payer, not the deployment. A build serving both Pi
  // Browser and the public website has to take π from one and a card from the
  // other; choosing once at deploy time makes one of those two impossible.
  // See lib/payments/rail.ts.
  const payments = providerFor(railForRequest(request.headers))

  // Refuse before the charge, not during it. Reaching a provider without its key
  // used to surface as a 500 carrying the sentence "PI_API_KEY is not set" —
  // which both tells a stranger exactly how this deployment is misconfigured
  // and reads, to the user, as though their payment broke. Which environment
  // variable is missing is an operator's business.
  const configured = payments.name === 'pi' ? piPaymentsConfigured() : Boolean(process.env.STRIPE_SECRET_KEY)
  if (!configured) {
    console.error(`[payments] the ${payments.name} rail has no key configured — payments are unavailable`)
    return NextResponse.json(
      { error: 'Payments are temporarily unavailable. Nothing has been charged.' },
      { status: 503 },
    )
  }

  try {
    switch (body.action) {
      case 'approve':
        return NextResponse.json(await payments.approve(paymentId))
      case 'complete': {
        const txid = typeof body.txid === 'string' ? body.txid : ''
        if (!txid) return NextResponse.json({ error: 'Missing txid' }, { status: 400 })
        const result = await payments.complete(paymentId, txid)

        const decision = decideGrant({ action: 'complete', ok: result.ok, metadata: body.metadata })
        let granted = false
        if (decision.grant && decision.plan && isDbConfigured()) {
          try {
            await repo.users.setPlan(userId, decision.plan)
            granted = true
          } catch (err) {
            // The payment succeeded; the grant did not. Say so rather than
            // reporting a clean success the account does not reflect.
            console.error('Payment completed but the plan grant failed:', err)
          }
        }
        return NextResponse.json({ ...result, granted, plan: granted ? decision.plan : null })
      }
      case 'cancel':
        return NextResponse.json(await payments.cancel(paymentId))
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    // The detail goes to the logs; the user gets a sentence that does not
    // describe our infrastructure and does not leave them wondering whether
    // they were charged.
    console.error('[payments] provider call failed:', err)
    // Named by the rail the payer actually used. Telling a card payer that "Pi
    // will be returned by the network" is a sentence about someone else's money.
    return NextResponse.json(
      {
        error:
          payments.name === 'pi'
            ? 'The payment could not be processed. If Pi was deducted, it will be returned by the network.'
            : 'The payment could not be processed. If your card was charged, the authorisation will be released.',
      },
      { status: 502 },
    )
  }
}
