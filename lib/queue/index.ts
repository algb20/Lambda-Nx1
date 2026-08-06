/**
 * lib/queue — the app's only queue entry point. Selects the provider by env
 * (QUEUE_PROVIDER, default 'memory'). A durable provider (pgmq/pg_cron) is
 * registered here for the Radar in phase P4 without caller changes.
 */
import type { Queue } from './types'
import { memoryQueue } from './memory'

export * from './types'

export function getQueue(): Queue {
  const name = process.env.QUEUE_PROVIDER ?? 'memory'
  switch (name) {
    case 'memory':
      return memoryQueue
    default:
      throw new Error(
        `QUEUE_PROVIDER="${name}" is not configured. Available: memory (durable added in P4).`,
      )
  }
}
