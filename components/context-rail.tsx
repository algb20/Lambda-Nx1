'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, CircleCheck, Radio } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { TimeStamp } from '@/components/time-stamp'
import type { Tab } from '@/lib/navigation'

/**
 * The right-hand rail, on wide screens only.
 *
 * ## Why a rail at all
 *
 * The shell was a phone layout wearing a browser: one 672px column, centred, on
 * a monitor two and a half times that wide. Raising the maximum width alone
 * would not have fixed it — a single column stretched to 1600px is *worse*,
 * because a 200-character line is unreadable and the page still has nothing on
 * either side. A wide screen is not a tall screen with more room; it is a
 * different arrangement, and it earns its width by putting a second thing next
 * to the first.
 *
 * ## What is in it, and why this and not more
 *
 * The one question a person keeps asking while doing something else: **is the
 * platform actually working, and what has just happened?** That is the standing
 * state of the engine — how many feeds answered, how many events are live, how
 * fresh the newest one is — plus the handful of most recent events.
 *
 * It is deliberately not a second dashboard. Everything here comes from a
 * single `/api/diagnose`-adjacent read that the platform already performs, it
 * refreshes on a slow cadence, and it never competes with the panel a user is
 * working in. A rail that demands attention is a rail that has to be closed.
 *
 * ## Why it is hidden below `xl`
 *
 * On a laptop the main column needs the whole width. Rendering the rail there
 * and hiding it with CSS would still cost the fetch, so it is gated on a real
 * media query in JavaScript and does not mount at all on a narrow screen.
 */
export function ContextRail({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const apply = () => setWide(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (!wide) return null
  return (
    <aside className="sticky top-20 hidden w-72 shrink-0 flex-col gap-3 self-start xl:flex">
      <EngineState onNavigate={onNavigate} />
    </aside>
  )
}

interface WorldSummary {
  generatedAt?: string
  events?: Array<{ title: string; observedAt: string | null; at: string; color: string; categoryLabel: string }>
  sourceHealth?: Array<{ status: string }>
}

function EngineState({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [data, setData] = useState<WorldSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const load = () => {
      fetch('/api/world')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: WorldSummary) => live && (setData(d), setFailed(false)))
        .catch(() => live && setFailed(true))
    }
    load()
    // Slow on purpose. The rail is peripheral; polling it hard would spend the
    // provider budget the main panel needs.
    const timer = setInterval(load, 120_000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  const health = data?.sourceHealth ?? []
  const ok = health.filter((s) => s.status === 'ok' || s.status === 'cached').length
  const broken = health.filter((s) => s.status === 'failed').length
  const events = (data?.events ?? []).slice(0, 6)

  return (
    <>
      <Card className="p-3.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Radio className="h-3.5 w-3.5" />
          Engine
        </h3>

        {failed && !data ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Could not reach the world feed. The gateways are unaffected — this panel only reports.
          </p>
        ) : !data ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Reading…</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="feeds answering" value={ok} tone="good" />
              {/* Failures are shown even at zero. A count that only appears when
                  it is non-zero teaches the reader that its absence means
                  nothing was checked. */}
              <Stat label="feeds failing" value={broken} tone={broken > 0 ? 'bad' : 'muted'} />
            </div>
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              {data.events?.length ?? 0} events live
              {data.generatedAt ? (
                <>
                  {' · swept '}
                  <TimeStamp iso={data.generatedAt} />
                </>
              ) : null}
            </p>
          </>
        )}
      </Card>

      {events.length > 0 ? (
        <Card className="p-3.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Just in
          </h3>
          <ul className="mt-2 space-y-2">
            {events.map((e, i) => (
              <li key={`${e.title}-${i}`} className="flex gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: e.color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[12px] leading-snug">{e.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {e.categoryLabel} ·{' '}
                    {/* The event's own time, not the sweep's. */}
                    <TimeStamp iso={e.observedAt ?? e.at} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => onNavigate('globe')}
            className="mt-2.5 text-[11px] text-primary hover:underline"
          >
            Open the world picture
          </button>
        </Card>
      ) : null}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'bad' | 'muted' }) {
  const Icon = tone === 'bad' ? AlertTriangle : CircleCheck
  const color =
    tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-destructive' : 'text-muted-foreground'
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <p className={`flex items-center gap-1 text-lg font-semibold tabular-nums leading-none ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}
