'use client'

import { useEffect, useState } from 'react'
import { Target, Loader2, AlertCircle, Check, Minus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Outcome = 'correct' | 'partial' | 'wrong'
interface Accuracy {
  resolved: number
  correct: number
  partial: number
  wrong: number
  accuracy: number | null
}
interface Scoreboard {
  total: number
  open: number
  overall: Accuracy
  byAuthor: Array<{ author: string; authorKind: 'us' | 'external' } & Accuracy>
  byConfidence: Array<{ confidence: string } & Accuracy>
}
interface Claim {
  id: string
  author: string
  authorKind: 'us' | 'external'
  claim: string
  status: 'open' | 'resolved'
  outcome: Outcome | null
  confidence: string
  horizon: string | null
}

function pct(a: number | null): string {
  return a === null ? '—' : `${Math.round(a * 100)}%`
}
function accuracyColor(a: number | null): string {
  if (a === null) return 'text-muted-foreground'
  if (a >= 0.7) return 'text-emerald-500'
  if (a >= 0.4) return 'text-amber-600'
  return 'text-destructive'
}

export function CalibrationScoreboard() {
  const [board, setBoard] = useState<Scoreboard | null>(null)
  const [claims, setClaims] = useState<Claim[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [claimText, setClaimText] = useState('')
  const [horizon, setHorizon] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/calibration')
      const data = await res.json()
      setBoard(data.scoreboard ?? null)
      setClaims(data.claims ?? [])
      setConfigured(data.configured !== false)
    } catch {
      setConfigured(false)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const record = async () => {
    if (sending || !claimText.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: claimText, authorKind: 'us', author: 'Lambda', horizon: horizon || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not record')
      setClaimText('')
      setHorizon('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  const resolve = async (id: string, outcome: Outcome) => {
    await fetch('/api/calibration/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, outcome }),
    })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Calibration</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        How accurate our — and others&apos; — published forecasts turn out to be. Honest, including
        our own misses. We record a claim with a horizon, then score it against reality.
      </p>

      {loading ? (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </Card>
      ) : !configured ? (
        <Card className="flex items-start gap-2 border-amber-500/40 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          The calibration ledger is not configured yet (it comes online at deploy). You can still
          record claims below.
        </Card>
      ) : null}

      {board ? (
        <>
          <Card className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">Overall accuracy</p>
                <p className={`text-3xl font-bold tabular-nums ${accuracyColor(board.overall.accuracy)}`}>
                  {pct(board.overall.accuracy)}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <p className="font-semibold tabular-nums text-emerald-500">{board.overall.correct}</p>
                  <p className="text-muted-foreground">correct</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-amber-600">{board.overall.partial}</p>
                  <p className="text-muted-foreground">partial</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums text-destructive">{board.overall.wrong}</p>
                  <p className="text-muted-foreground">wrong</p>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {board.overall.resolved} resolved · {board.open} open
            </p>
          </Card>

          {board.byAuthor.length > 0 ? (
            <Card className="p-4">
              <h4 className="mb-2 text-sm font-semibold">By author</h4>
              {board.byAuthor.map((a) => (
                <div key={a.author} className="flex items-center justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{a.author}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {a.authorKind}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{a.resolved} resolved</span>
                    <span className={`font-semibold tabular-nums ${accuracyColor(a.accuracy)}`}>{pct(a.accuracy)}</span>
                  </div>
                </div>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {/* Record a claim */}
      <Card className="space-y-2 p-4">
        <h4 className="text-sm font-semibold">Record a claim</h4>
        <Input value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="A testable statement (e.g. “X ships before Q4”)" />
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={horizon} onChange={(e) => setHorizon(e.target.value)} className="w-auto" title="Horizon — when to judge it" />
          <Button onClick={record} disabled={sending || !claimText.trim()} className="ms-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record'}
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </Card>

      {/* Recent claims + resolve controls */}
      {claims.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Recent claims</h4>
          {claims.map((c) => (
            <div key={c.id} className="border-b border-border/40 py-2 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">{c.claim}</span>
                {c.status === 'resolved' ? (
                  <Badge
                    variant="outline"
                    className={
                      c.outcome === 'correct'
                        ? 'border-emerald-500/40 text-emerald-500'
                        : c.outcome === 'partial'
                          ? 'border-amber-500/40 text-amber-600'
                          : 'border-destructive/40 text-destructive'
                    }
                  >
                    {c.outcome}
                  </Badge>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => resolve(c.id, 'correct')} title="Correct">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => resolve(c.id, 'partial')} title="Partial">
                      <Minus className="h-3.5 w-3.5 text-amber-600" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => resolve(c.id, 'wrong')} title="Wrong">
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {c.author} · {c.confidence}
                {c.horizon ? ` · by ${new Date(c.horizon).toLocaleDateString()}` : ''}
              </p>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  )
}
