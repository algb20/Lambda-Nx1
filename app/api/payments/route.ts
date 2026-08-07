import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'
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

  const payments = getPaymentProvider()
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment error' },
      { status: 500 },
    )
  }
}
