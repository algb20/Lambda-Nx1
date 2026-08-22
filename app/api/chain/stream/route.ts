import { chainRadar } from '@/lib/modules/chain-radar'
import { sharedChannel, streamChannel } from '@/lib/stream/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/**
 * A held-open connection, so the ceiling is not a request deadline but a
 * session length. Long enough that a reader watching a market is not
 * reconnected every minute; `retry` in the stream reconnects them when it ends.
 */
export const maxDuration = 300

/**
 * GET /api/chain/stream — the blockchain radar, pushed.
 *
 * `/api/chain` still exists and still answers, because a stream is not a
 * replacement for a request: the JSON route is what a fallback poll, a script
 * or an export uses. This is the same picture delivered without asking.
 */
export function GET(request: Request) {
  return streamChannel(request, sharedChannel('chain', 120_000, chainRadar))
}
