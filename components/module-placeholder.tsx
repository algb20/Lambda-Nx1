'use client'

import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Construction } from 'lucide-react'

/**
 * Honest placeholder for a capability that is not built yet.
 * Charter rule #1: never display demo or fabricated data. A module shows this
 * until its real engine is connected.
 */
export function ModulePlaceholder({
  title,
  phase,
  children,
}: {
  title: string
  phase: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Construction className="h-6 w-6 text-primary shrink-0" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              Under construction ({phase}). No demo or fabricated data is shown — by design.
            </p>
          </div>
        </div>
        {children ? (
          <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
        ) : null}
      </Card>
    </div>
  )
}
