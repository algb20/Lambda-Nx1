'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Posture } from '@/lib/security/posture'

/**
 * The compliance badge, reading a live check instead of a constant.
 *
 * ## What it replaced
 *
 * A green shield reading "Passive · Lawful", hardcoded. It said the same words
 * in the same colour whether the guardrail was enforcing anything or had been
 * deleted — and it is the most consequential claim on the page, a statement
 * about law and ethics made to a reader with no other way to check it.
 *
 * ## Three states, and why "unknown" is not "lawful"
 *
 * - **Lawful** — every check in `lib/security/posture` passed just now.
 * - **Not lawful** — one did not, and the badge names it. Amber rather than
 *   green, and it says which guarantee is off.
 * - **Unknown** — the check has not answered yet, or could not run. This is
 *   deliberately *not* the green state: a badge that assumes compliance while
 *   it waits is the hardcoded badge again with a delay in front of it.
 *
 * The first paint is therefore the neutral shield, not the green one. That
 * costs a moment of reassurance and buys the only thing that makes the
 * reassurance worth anything.
 */
/** Where the session's answer lives. Per tab, cleared when the tab closes. */
const CACHE_KEY = 'lambda.posture.v1'

function readCachedPosture(): Posture | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Posture
    // Shape-checked, not trusted: storage is editable and survives a deploy.
    return Array.isArray(parsed?.checks) && typeof parsed.lawful === 'boolean' ? parsed : null
  } catch {
    return null
  }
}

function cachePosture(posture: Posture): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(posture))
  } catch {
    /* Storage blocked or full — the badge just asks again next time. */
  }
}

export function PostureBadge({ label }: { label: string }) {
  const [posture, setPosture] = useState<Posture | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true

    /**
     * Once a session, not once a page.
     *
     * This first fetched on every mount, and the browser suite caught what that
     * costs: a **429** on `/api/posture` across five routes. The gateway limit
     * is 30 requests a minute per address, so a badge that re-checks on every
     * navigation spends a thirtieth of a reader's whole budget re-answering a
     * question whose answer is a property of the *deployment* — it cannot change
     * between two clicks, only between two deploys.
     *
     * `sessionStorage` is the right store for exactly that lifetime: it clears
     * when the tab closes, so a redeploy is picked up by the next visit, and it
     * is per-tab, so nothing is shared with another origin or another session.
     * A blocked or full store is not an error — the badge simply falls back to
     * asking, which is what it did before.
     */
    const cached = readCachedPosture()
    if (cached) {
      setPosture(cached)
      return () => {
        alive = false
      }
    }

    fetch('/api/posture', { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json()) as Posture & { error?: string }
        if (!alive) return
        if (!res.ok || body.error) {
          setFailed(true)
          return
        }
        setPosture(body)
        cachePosture(body)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  /* Unknown — waiting, or the checker could not run. Never green. */
  if (!posture) {
    return (
      <Badge
        variant="outline"
        className="hidden border-border/60 text-xs text-muted-foreground sm:flex"
        title={
          failed
            ? 'The compliance check could not run, so this deployment’s guarantees are unverified. That is not the same as a failure — it is an absence of evidence.'
            : 'Checking that this deployment’s own guarantees are switched on…'
        }
      >
        <ShieldQuestion className="me-1 h-3 w-3" />
        {failed ? 'Unverified' : 'Checking…'}
      </Badge>
    )
  }

  const broken = posture.checks.filter((c) => c.state === 'fail')

  if (broken.length > 0) {
    return (
      <Badge
        variant="outline"
        className="hidden border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 sm:flex dark:text-amber-400"
        title={broken.map((c) => `${c.label}: ${c.detail}`).join('\n')}
      >
        <ShieldAlert className="me-1 h-3 w-3" />
        {broken.length === 1 ? broken[0].label : `${broken.length} guarantees off`}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="hidden border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-500 sm:flex"
      /*
        Every check and its evidence, so the claim can be inspected rather than
        taken. A badge whose only content is the word "Lawful" asks for trust;
        this one shows its working.
      */
      title={posture.checks.map((c) => `✓ ${c.label} — ${c.detail}`).join('\n')}
    >
      <ShieldCheck className="me-1 h-3 w-3" />
      {label}
    </Badge>
  )
}
