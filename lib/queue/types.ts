/**
 * Queue port. The engine and Radar enqueue background work through this
 * interface, never a specific broker (charter rule #4).
 */
export type JobHandler<T = unknown> = (payload: T) => Promise<void>

export interface Queue {
  readonly name: string
  register<T>(jobName: string, handler: JobHandler<T>): void
  enqueue<T>(jobName: string, payload: T): Promise<void>
}
