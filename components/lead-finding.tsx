'use client'

import { ExternalLink, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { leadFinding, whyLead } from '@/lib/analysis/salience'
import type { Evidence } from '@/lib/engine/types'

/**
 * The finding to look at first.
 *
 * Result cards were uniform regardless of importance, which meant a page of
 * forty findings handed the analyst's first and hardest judgement — *what
 * should I look at?* — straight back to them. That is the judgement an analysis
 * product exists to help with.
 *
 * Two rules keep this honest:
 *
 *  - **It says why.** The reason is always about grading and corroboration —
 *    "rated A1 · reported by two independent sources" — never about truth. We
 *    rank evidence; we do not certify claims.
 *  - **It renders nothing rather than something weak.** When the set is
 *    uniformly poor, or the top two are indistinguishable, there is no most
 *    significant finding, and inventing one is a false signal. `leadFinding`
 *    returns null and this component disappears.
 */
export function LeadFinding({ findings }: { findings: Evidence[] }) {
  const lead = leadFinding(findings)
  if (!lead) return null

  const { evidence } = lead
  const href =
    evidence.sourceUrl && /^https?:\/\//i.test(evidence.sourceUrl) ? evidence.sourceUrl : null

  return (
    <Card className="border-primary/40 bg-primary/5 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Start here
        </h3>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          {lead.score}/100
        </span>
      </div>

      <p className="text-sm font-medium leading-snug">{evidence.claim}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
        <span className="rounded bg-background/60 px-1.5 py-0.5 ring-1 ring-border">
          {whyLead(lead)}
        </span>
        <span data-no-translate className="font-mono">
          {evidence.sourceKey}
        </span>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            source <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
      </div>
    </Card>
  )
}
