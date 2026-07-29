'use client'

import { ModulePlaceholder } from '@/components/module-placeholder'

/**
 * Personal workspace. The previous version rendered fabricated "AI assistant"
 * data (fake savings, balances, trips). Removed per charter rule #1.
 */
export function PersonalDashboard() {
  return (
    <ModulePlaceholder title="Your workspace" phase="P6">
      <p>
        Your saved investigations, watchlists and reports will live here — each backed by
        real engine results with sources and confidence grades. Nothing is shown until it is
        real.
      </p>
    </ModulePlaceholder>
  )
}
