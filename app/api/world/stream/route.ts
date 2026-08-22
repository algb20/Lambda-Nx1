import { getWorldEvents } from '@/lib/modules/world-events'
import { sharedChannel, streamChannel } from '@/lib/stream/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/world/stream — the live world picture, pushed.
 *
 * The globe and the context rail both draw this. Before, each open tab polled
 * it on its own two-minute timer; now one producer serves them all and they see
 * a new reading the moment it lands.
 */
export function GET(request: Request) {
  return streamChannel(request, sharedChannel('world', 120_000, getWorldEvents))
}
