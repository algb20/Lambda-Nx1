'use client'

import { useEffect, useRef, useState } from 'react'
// `User`, not `IdCard`: IdCard is a recent lucide addition, and hosts that
// resolve lucide-react from their own bundle (v0 / App Studio previews) may ship
// an older build without it — which fails at import time and takes the app down.
// Long-established icons are the safe currency here.
import { Radio, Fingerprint, Clock, CalendarClock, User, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TargetProfile, TimelineEvent } from '@/lib/modules/target'

type ConnState = 'connecting' | 'live' | 'error'

const KIND_STYLE: Record<TimelineEvent['kind'], string> = {
  partnership: 'text-emerald-500',
  filing: 'text-primary',
  price: 'text-amber-500',
  news: 'text-muted-foreground',
  event: 'text-muted-foreground',
}

function EventRow({ e }: { e: TimelineEvent }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <div className="min-w-0">
        {e.sourceUrl ? (
          <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm leading-snug hover:underline">
            {e.title}
          </a>
        ) : (
          <span className="text-sm leading-snug">{e.title}</span>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className={`font-medium uppercase ${KIND_STYLE[e.kind]}`}>{e.kind}</span>
          <span className="font-mono">{e.sourceKey}</span>
          <span>· {new Date(e.at).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export function TargetTracker({ query }: { query: string }) {
  const [profile, setProfile] = useState<TargetProfile | null>(null)
  const [state, setState] = useState<ConnState>('connecting')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!query) return
    setProfile(null)
    setState('connecting')
    const es = new EventSource(`/api/track?q=${encodeURIComponent(query)}`)
    esRef.current = es
    es.addEventListener('open', () => setState('live'))
    es.addEventListener('target', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data)
        setProfile(data.profile as TargetProfile)
        setState('live')
        setUpdatedAt(new Date().toLocaleTimeString())
      } catch {
        /* ignore malformed frame */
      }
    })
    es.onerror = () => setState('error')
    return () => {
      es.close()
      esRef.current = null
    }
  }, [query])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{query}</h3>
            <p className="text-[11px] text-muted-foreground">
              {profile ? `${profile.type} · ${profile.speed.elapsedMs}ms` : 'connecting…'}
              {updatedAt ? ` · updated ${updatedAt}` : ''}
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              state === 'live'
                ? 'bg-emerald-500/10 text-emerald-500'
                : state === 'error'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${state === 'live' ? 'animate-pulse' : ''}`} />
            {state === 'live' ? 'Live' : state === 'error' ? 'Reconnecting…' : 'Connecting…'}
          </span>
        </div>
      </Card>

      {/* Our signature — correlation across time & similar cases */}
      {profile?.signature.summary ? (
        <Card className="p-4">
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <Fingerprint className="h-4 w-4 text-primary" /> Signature
          </h4>
          <p className="text-sm leading-relaxed">{profile.signature.summary}</p>
          {profile.signature.watch.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
              {profile.signature.watch.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {/* Horizon — published, forward-looking (never fabricated) */}
      {profile && profile.horizon.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="h-4 w-4 text-primary" /> Horizon
            <Badge variant="outline" className="text-[10px]">
              published outlook
            </Badge>
          </h4>
          {profile.horizon.map((e, i) => (
            <EventRow key={i} e={e} />
          ))}
        </Card>
      ) : null}

      {/* Live timeline — past → now */}
      <Card className="p-4">
        <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" /> Live timeline
        </h4>
        {!profile ? (
          <p className="py-2 text-sm text-muted-foreground">Opening the live stream…</p>
        ) : profile.timeline.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No live events yet — the stream stays open.</p>
        ) : (
          profile.timeline.map((e, i) => <EventRow key={i} e={e} />)
        )}
      </Card>

      {/* Identity — the static profile, kept apart from the live stream */}
      {profile && profile.identity.static.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" /> Identity <span className="text-[10px] text-muted-foreground">(static)</span>
          </h4>
          {profile.identity.static.slice(0, 20).map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              <span className="text-sm">{e.claim}</span>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {e.sourceKey}
              </Badge>
            </div>
          ))}
        </Card>
      ) : null}

      {state === 'error' && !profile ? (
        <Card className="flex items-center gap-2 border-destructive/40 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Live stream interrupted — it will retry automatically.
        </Card>
      ) : null}
    </div>
  )
}
