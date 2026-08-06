import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payments'
import { getSessionUserId } from '@/lib/auth/server'

/**
 * POST /api/payments  { action: 'approve'|'complete'|'cancel', paymentId, txid? }
 * Server-side payment handling through lib/payments (Pi by default). Requires an
 * authenticated session. Self-contained in the app — works on Pi and standalone.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: { action?: unknown; paymentId?: unknown; txid?: unknown }
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
        return NextResponse.json(await payments.complete(paymentId, txid))
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
