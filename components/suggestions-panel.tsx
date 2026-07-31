'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, Loader2, ArrowBigUp, Sparkles, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'

type Kind = 'feature' | 'improvement' | 'bug' | 'integration' | 'data_source' | 'other'
const KINDS: Kind[] = ['feature', 'improvement', 'bug', 'integration', 'data_source', 'other']

interface Cluster {
  clusterKey: string
  title: string
  summary: string | null
  kind: Kind
  impact: 'low' | 'medium' | 'high' | 'critical'
  demand: number
  votes: number
  status: string
  items: Array<{ id: string }>
}

const IMPACT_STYLE: Record<Cluster['impact'], string> = {
  critical: 'border-destructive/60 text-destructive',
  high: 'border-destructive/50 text-destructive',
  medium: 'border-amber-500/50 text-amber-600',
  low: 'border-border text-muted-foreground',
}

export function SuggestionsPanel() {
  const { t, locale } = useI18n()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<Kind>('feature')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [configured, setConfigured] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/suggestions')
      if (!res.ok) return
      const data = await res.json()
      setClusters(data.clusters ?? [])
      setConfigured(data.configured !== false)
    } catch {
      /* offline / not configured — the form still works to show intent */
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async () => {
    if (sending || !title.trim() || !body.trim()) return
    setSending(true)
    setError(null)
    setThanks(false)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, kind, locale }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? t('common.error'))
      setThanks(true)
      setTitle('')
      setBody('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSending(false)
    }
  }

  const vote = async (id: string) => {
    await fetch('/api/suggestions/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{t('ideas.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('ideas.subtitle')}</p>

      {!configured ? (
        <Card className="flex items-start gap-2 border-amber-500/40 p-3 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          {t('ideas.needDb')}
        </Card>
      ) : null}

      {/* Compose */}
      <Card className="space-y-3 p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('ideas.form.titlePlaceholder')}
          maxLength={200}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('ideas.form.bodyPlaceholder')}
          rows={4}
          maxLength={5000}
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </select>
          <Button onClick={submit} disabled={sending || !title.trim() || !body.trim()} className="ms-auto">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('ideas.submit')}
          </Button>
        </div>
        {thanks ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Sparkles className="h-4 w-4" />
            {t('ideas.thanks')}
          </p>
        ) : null}
        {error ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}
      </Card>

      {/* Ranked, clustered backlog */}
      <h3 className="px-1 text-sm font-semibold">{t('ideas.top')}</h3>
      {clusters.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{t('ideas.empty')}</Card>
      ) : (
        <div className="space-y-2">
          {clusters.map((c) => (
            <Card key={c.clusterKey} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="font-semibold leading-tight">{c.title}</h4>
                    <Badge variant="outline" className={`text-[10px] ${IMPACT_STYLE[c.impact]}`}>
                      {c.impact}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {t(`kind.${c.kind}`)}
                    </Badge>
                  </div>
                  {c.summary ? <p className="mt-1 text-xs text-muted-foreground">{c.summary}</p> : null}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {c.demand} {t('ideas.demand')} · {c.votes} {t('ideas.votes')} · {c.status}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => vote(c.items[0]?.id)}
                  disabled={!c.items[0]?.id}
                >
                  <ArrowBigUp className="h-4 w-4" />
                  {c.votes}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
