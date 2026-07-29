/**
 * Module 4 — Monitoring input validation (pure, testable). Monitors watch a
 * public target on an interval; the Radar engine (lib/radar) does the checking.
 */
import { normalizeDomain } from './domain'

export interface MonitorInput {
  targetType: 'domain'
  targetValue: string
  intervalMinutes: number
}

const MIN_INTERVAL = 60 // 1 hour
const MAX_INTERVAL = 43_200 // 30 days
const DEFAULT_INTERVAL = 1_440 // 1 day

export function validateMonitorInput(raw: {
  targetType?: unknown
  targetValue?: unknown
  intervalMinutes?: unknown
}): MonitorInput {
  if (raw.targetType !== 'domain') {
    throw new Error('Only domain monitors are supported today')
  }
  const targetValue = typeof raw.targetValue === 'string' ? normalizeDomain(raw.targetValue) : ''
  if (!targetValue || !targetValue.includes('.')) {
    throw new Error('Invalid domain')
  }
  const requested =
    typeof raw.intervalMinutes === 'number' && Number.isFinite(raw.intervalMinutes)
      ? Math.round(raw.intervalMinutes)
      : DEFAULT_INTERVAL
  const intervalMinutes = Math.max(MIN_INTERVAL, Math.min(requested, MAX_INTERVAL))
  return { targetType: 'domain', targetValue, intervalMinutes }
}
