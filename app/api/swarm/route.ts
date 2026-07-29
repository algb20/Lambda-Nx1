import { NextResponse } from 'next/server'

/**
 * Lambda NX — Swarm/orchestration API
 *
 * Project charter rule #1: no mock / fabricated data is ever served. The prior
 * version returned a simulated "agent swarm cycle" built from Math.random().
 * That has been removed. Real multi-source orchestration is delivered by the
 * engine (lib/engine, phase P2+); until then this endpoint reports honestly.
 */

const NOT_IMPLEMENTED = {
  status: 'not_implemented' as const,
  module: 'orchestration',
  message:
    'Real orchestration is not connected yet. It is built on top of the engine (phase P2+). No demo or fabricated data is served.',
}

export async function GET() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 503 })
}

export async function POST() {
  return NextResponse.json(NOT_IMPLEMENTED, { status: 503 })
}
