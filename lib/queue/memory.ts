import type { Queue, JobHandler } from './types'

/**
 * In-process queue — a real, working default. enqueue() runs the registered
 * handler asynchronously in the same process, without blocking the caller.
 * Durable, scheduled execution (pg_cron / pgmq) is registered for the Radar in
 * phase P4 via getQueue(); handlers and callers stay unchanged.
 */
class MemoryQueue implements Queue {
  readonly name = 'memory'
  private readonly handlers = new Map<string, JobHandler>()

  register<T>(jobName: string, handler: JobHandler<T>): void {
    this.handlers.set(jobName, handler as JobHandler)
  }

  async enqueue<T>(jobName: string, payload: T): Promise<void> {
    const handler = this.handlers.get(jobName)
    if (!handler) throw new Error(`No handler registered for job "${jobName}"`)
    queueMicrotask(() => {
      handler(payload).catch((err) => {
        console.error(`[queue] job "${jobName}" failed:`, err)
      })
    })
  }
}

export const memoryQueue: Queue = new MemoryQueue()
