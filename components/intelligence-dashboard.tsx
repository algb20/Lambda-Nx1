'use client'

import { ModulePlaceholder } from '@/components/module-placeholder'

/**
 * Intelligence view. The previous version rendered fabricated data from
 * getMockIntelligenceData(); that has been removed (charter rule #1). This
 * becomes the real Domain/Infrastructure module in phase P3.
 */
export function IntelligenceDashboard() {
  return (
    <ModulePlaceholder title="Lambda NX Intelligence" phase="Module 1 · P3">
      <p>
        This will run real, passive, keyless OSINT — DNS, RDAP/WHOIS,
        certificate-transparency subdomains, technology fingerprinting, archive history and
        IP exposure — with every finding carrying its source link, timestamp, Admiralty
        rating and confidence grade.
      </p>
    </ModulePlaceholder>
  )
}
