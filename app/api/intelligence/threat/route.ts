import { NextResponse } from 'next/server'
import { investigateThreat } from '@/lib/modules/threat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { indicator?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const indicator = typeof body.indicator === 'string' ? body.indicator.trim() : ''
  if (!indicator) return NextResponse.json({ error: 'Provide an "indicator".' }, { status: 400 })

  try {
    return NextResponse.json(await investigateThreat(indicator))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Investigation failed' },
      { status: 400 },
    )
  }
}
