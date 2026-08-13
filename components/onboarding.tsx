'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Check, Link2, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { GATEWAY_GUIDANCE, type Mode } from '@/lib/gateways'

/**
 * The first run.
 *
 * Sixteen gateways and an empty search box is a demonstration of nothing. A new
 * user cannot tell what a "finding" is here, why it is more trustworthy than a
 * search engine's answer, or what the letters next to it mean — and they will
 * not read a manual to find out.
 *
 * So this does not explain; it *runs*. One press investigates a real subject
 * through a real gateway against real public sources, and the three things that
 * make the result different from a search engine are named beside it before the
 * user sees them:
 *
 *  1. every finding carries the source that reported it, as a link;
 *  2. every finding carries a grade for how reliable that source is;
 *  3. nothing here touched the subject — it is all public record.
 *
 * It appears once. The dismissal is remembered locally rather than in the
 * account, because a returning visitor who has already seen it should not have
 * to sign in to stop seeing it.
 */
const SEEN_KEY = 'lambda.onboarding.seen.v1'

/** The subject the walkthrough investigates. */
export const WORKED_EXAMPLE: { gateway: Mode; subject: string } = {
  gateway: 'domain',
  // A domain that is public, uncontroversial, permanently online, and returns a
  // rich result from several independent sources — so the first thing a new user
  // sees is the product working, not an empty section.
  subject: 'wikipedia.org',
}

export const ONBOARDING_POINTS = [
  {
    icon: Link2,
    title: 'Every finding links to its source',
    body: 'Not a summary of the web — the actual record, with the page it came from and the moment it was read.',
  },
  {
    icon: ShieldCheck,
    title: 'Every finding is graded',
    body: 'A letter for how reliable the source is and a number for how credible the claim is (the Admiralty scale), plus a confidence grade from how many independent sources agree.',
  },
  {
    icon: Check,
    title: 'Nothing here touches the subject',
    body: 'Only public records are read. No scanning, no probing, no contact with what you are investigating — by design, and enforced in the engine.',
  },
] as const

/** Whether the walkthrough has been seen. Safe before hydration. */
export function useFirstRun(): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(SEEN_KEY) !== '1')
    } catch {
      // Private mode or storage disabled: show it, and it simply returns next
      // time. Better than hiding the introduction from everyone in that state.
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* nothing to do — the panel is already gone for this session */
    }
  }

  return { show, dismiss }
}

export function Onboarding({
  onRunExample,
}: {
  /** Runs the worked example through the real gateway. */
  onRunExample: (gateway: Mode, subject: string) => void
}) {
  const { show, dismiss } = useFirstRun()
  if (!show) return null

  const guidance = GATEWAY_GUIDANCE[WORKED_EXAMPLE.gateway]

  return (
    <Card className="relative border-primary/30 bg-primary/5 p-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss the introduction"
        className="absolute end-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Start with a real one</h3>
      </div>

      <p className="mb-3 text-[13px] leading-snug text-muted-foreground">
        {guidance.answers}
      </p>

      <ul className="mb-3 space-y-2">
        {ONBOARDING_POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-2">
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-xs font-medium leading-tight">{title}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            dismiss()
            onRunExample(WORKED_EXAMPLE.gateway, WORKED_EXAMPLE.subject)
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Investigate
          <span data-no-translate className="font-mono">
            {WORKED_EXAMPLE.subject}
          </span>
          <ArrowRight className="h-3 w-3" />
        </button>
        <button
          onClick={dismiss}
          className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          I&apos;ll explore myself
        </button>
      </div>

      <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground">{guidance.limit}</p>
    </Card>
  )
}
