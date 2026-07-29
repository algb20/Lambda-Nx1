'use client'

import { ModulePlaceholder } from '@/components/module-placeholder'

/**
 * Team / enterprise workspace. The previous version rendered fabricated
 * enterprise metrics. Removed per charter rule #1.
 */
export function EnterpriseDashboard() {
  return (
    <ModulePlaceholder title="Team & bulk investigations" phase="P6">
      <p>
        Shared cases, bulk lookups and exportable reports for teams — built on the same
        passive, lawful engine. Real data only, once the modules ship.
      </p>
    </ModulePlaceholder>
  )
}
