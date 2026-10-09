import type { WorldEvent } from '@/lib/modules/world-events-shared'
import { severityBand } from '@/lib/analysis/timeline'

/**
 * The severity tier a dashboard shows beside an event (R338 reference design:
 * Critical / Significant / Watch).
 *
 * Decided by what the source itself said first, then by what was measured —
 * never by how many outlets repeated it:
 *
 * - An agency's own alert level wins. GDACS red and an NWS "Extreme" are
 *   critical; GDACS orange and NWS "Severe" are significant.
 * - Otherwise the graded severity, through the timeline's own bands
 *   (`SEVERITY_BANDS`): its "Critical" band (≥ 0.85) is critical and its
 *   "High" band (≥ 0.6) significant — one definition of severity, not two.
 * - Everything else is "watch". An event with no grade is never promoted.
 *
 * A tier is a label for triage, not a probability or a truth value (S
 * invariant 14).
 */
export type Tier = 'critical' | 'significant' | 'watch'

const CRITICAL_LEVELS = new Set(['red', 'extreme'])
const SIGNIFICANT_LEVELS = new Set(['orange', 'severe'])

export function tierOf(event: Pick<WorldEvent, 'alertLevel' | 'severity'>): Tier {
  const level = (event.alertLevel ?? '').trim().toLowerCase()
  if (CRITICAL_LEVELS.has(level)) return 'critical'
  if (SIGNIFICANT_LEVELS.has(level)) return 'significant'
  const band = severityBand(event.severity)
  if (band === 'critical') return 'critical'
  if (band === 'high') return 'significant'
  return 'watch'
}

export const TIER_LABEL: Record<Tier, string> = {
  critical: 'Critical',
  significant: 'Significant',
  watch: 'Watch',
}

/** How many events sit in each tier. */
export function tierCounts(events: Array<Pick<WorldEvent, 'alertLevel' | 'severity'>>): Record<Tier, number> {
  const out: Record<Tier, number> = { critical: 0, significant: 0, watch: 0 }
  for (const e of events) out[tierOf(e)] += 1
  return out
}
