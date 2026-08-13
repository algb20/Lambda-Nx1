'use client'

import { Lightbulb, Ban } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { GatewayGuidance } from '@/lib/gateways'

export { GATEWAY_GUIDANCE, type GatewayGuidance } from '@/lib/gateways'

/**
 * What a gateway looks like before you have asked it anything.
 *
 * Sixteen gateways opened onto sixteen empty boxes. An empty box is not neutral
 * — it reads as "broken" or "nothing here", and the user's next move is to
 * leave. Worse, it hides the two things they actually need: an example that
 * works, and the limits of what this gateway will do.
 *
 * So each one states three things in the user's own reading order:
 *
 *  1. **What it answers** — one sentence, no marketing.
 *  2. **Try this** — a real, working example they can press. Not a placeholder;
 *     something that returns a genuine result from a public source.
 *  3. **What it will not do** — the passive-only boundary in concrete terms, so
 *     nobody wastes an afternoon expecting a port scan. This is the charter's
 *     §3 guardrail said out loud, at the moment it is relevant.
 */

export function GatewayEmpty({
  guidance,
  onTry,
}: {
  guidance: GatewayGuidance
  /** Fills the search box with the example and runs it. */
  onTry?: (example: string) => void
}) {
  return (
    <Card className="p-4">
      <p className="text-sm leading-snug">{guidance.answers}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Lightbulb className="h-3 w-3 shrink-0" />
          Try
        </span>
        {onTry ? (
          <button
            onClick={() => onTry(guidance.example)}
            className="rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-border transition-colors hover:bg-muted"
          >
            {guidance.example}
          </button>
        ) : (
          <span className="font-mono text-[11px]">{guidance.example}</span>
        )}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <Ban className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{guidance.limit}</span>
      </p>
    </Card>
  )
}
