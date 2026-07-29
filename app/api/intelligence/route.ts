import { NextResponse } from 'next/server'

/**
 * Lambda NX — Intelligence API
 *
 * Project charter rule #1: no mock / fabricated data is ever served. The real
 * intelligence engine (lib/engine) is under construction — Module 1
 * (Domain / Infrastructure intelligence, phase P3). Until it is connected, this
 * endpoint honestly reports that the capability is not yet available instead of
 * returning invented numbers.
 */

const NOT_IMPLEMENTED = {
  status: 'not_implemented' as const,
  module: 'intelligence-engine',
  message:
    'The real intelligence engine is not connected yet. It arrives with Module 1 (Domain/Infrastructure). No demo or fabricated data is served.',
}

export async function GET() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 503 })
}

export async function POST() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 503 })
}
