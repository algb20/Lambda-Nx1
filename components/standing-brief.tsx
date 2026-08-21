'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Brain, Clock, EyeOff, Loader2, Radio, Scale } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NameList } from '@/components/panel-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { StandingBrief } from '@/lib/modules/brief-shared'
import type { ReadingStrength } from '@/lib/analysis/reasoning'

/**
 * The standing brief.
 *
 * ## What this screen is for
 *
 * Every comparable product puts a "summarise" button under a pile of rows, so
 * the analysis is something you ask for and only get if a key was bought. This
 * is the inverse: the reading is the page, it is computed from the evidence
 * with no model, and the rows are underneath it.
 *
 * ## The two things it will not do
 *
 * It does not write prose. Every headline on the screen is a sentence a source
 * published, and every number is counted from the report it came from — the
 * mechanical reading assembles sentences about *the shape of the evidence*, and
 * each one can be traced to the rows it was derived from.
 *
 * It does not hide what it could not see. Blind spots and quiet feeds are on
 * the same screen as the findings, at the same weight, because a picture built
 * from half the world's feeds looks identical to a complete one unless somebody
 * says otherwise.
 */

const STRENGTH: Record<ReadingStrength, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-emerald-500/10 text-emerald-500' },
  mixed: { label: 'Mixed', className: 'bg-sky-500/10 text-sky-500' },
  thin: { label: 'Thin', className: 'bg-amber-500/10 text-amber-500' },
  contested: { label: 'Contested', className: 'bg-rose-500/10 text-rose-500' },
}

function relative(iso: string | null): string {
  if (!iso) return 'not stated'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms)) return 'not stated'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function StandingBriefPanel() {
  const [brief, setBrief] = useState<StandingBrief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/brief')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not build the brief')
      setBrief(data as StandingBrief)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the brief')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!brief) {
    return (
      <Card className="p-6 text-center">
        {loading ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the world picture…
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{error ?? 'No brief yet.'}</p>
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        )}
      </Card>
    )
  }

  const reading = brief.verdict.reading
  const strength = reading ? STRENGTH[reading.strength] : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Brief</h2>
        <div className="flex items-center gap-2">
          {/*
            Whether a model ran is stated, never implied. `model` is null for the
            mechanical reading, and a reader is entitled to know which of the two
            wrote the sentence they are about to act on.
          */}
          <span className="text-[11px] text-muted-foreground">
            {brief.verdict.model ? `${brief.verdict.provider} · ${brief.verdict.model}` : 'computed — no model'}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <Radio className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── The bottom line ─────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Brain className="h-4 w-4" />
            Bottom line
          </h3>
          {strength ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${strength.className}`}
              title={reading?.strengthReason}
            >
              {strength.label} evidence
            </span>
          ) : null}
        </div>
        {/*
          ## One copy of each sentence, not three

          This card printed `verdict.summary`, then `reading.bottomLine` as
          bullets, and the cards below then printed those same readings a third
          time — because with no model running, the summary *is* the bottom line
          joined into a paragraph, and each bottom-line entry *is* the reading
          that Support / Age / What it rests on expand with their own numbers.

          A reader met the same four sentences three times in a row and
          reasonably concluded the page was repeating itself. It was.

          So: when a model wrote the summary it is genuinely new prose and is
          shown. When it was computed, the readings are left to the sections
          that give them their numbers, and this card carries only the judgement
          it exists for — the grade, and why.
        */}
        {brief.verdict.model ? (
          <p className="text-sm leading-relaxed">{brief.verdict.summary}</p>
        ) : null}
        {reading ? (
          <p className={`text-[13px] leading-relaxed ${brief.verdict.model ? 'mt-3 border-t border-border/40 pt-2 italic text-muted-foreground' : ''}`}>
            {reading.strengthReason}
          </p>
        ) : null}
        {reading && !brief.verdict.model ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            What that rests on is set out below — support, age, and what the picture is made of.
          </p>
        ) : null}
      </Card>

      {/* ── What the picture is made of ─────────────────────────────────── */}
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">The picture</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Events" value={String(brief.picture.events)} />
          {/*
            Origins next to events, never instead of them. The number of feeds
            that answered says how much traffic there was; the number of
            independent origins says how much of it is corroboration.
          */}
          <Stat label="Independent origins" value={String(brief.picture.origins)} />
          <Stat label="Stories" value={String(brief.storyAnalysis.stories)} />
          <Stat label="Newest" value={relative(brief.picture.newestAt)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{brief.storyAnalysis.headline}</p>
      </Card>

      {/* ── Corroboration and disagreement ──────────────────────────────── */}
      {reading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Scale className="h-4 w-4" />
              Support
            </h3>
            <p className="text-xs text-muted-foreground">{reading.corroboration.reading}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {reading.corroboration.corroborated} corroborated
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {reading.corroboration.repeated} repeated
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {reading.corroboration.single} single-origin
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4" />
              Age
            </h3>
            <p className="text-xs text-muted-foreground">{reading.temporal.reading}</p>
            {reading.temporal.undated.length > 0 ? (
              <p className="mt-1 text-[11px] text-amber-500">
                {reading.temporal.undated.length} carry no publication date — un-ageable, which is
                not the same as old.
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      {reading && reading.contradictions.length > 0 ? (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Sources disagree
          </h3>
          {/*
            Disagreement is promoted, not averaged away. Two agencies giving
            different figures for one event is the most informative thing on the
            board, and every feed that silently picks one of them is throwing
            away its best finding.
          */}
          {reading.contradictions.map((c, i) => (
            <div key={i} className="border-b border-border/40 py-2 text-xs last:border-0">
              <p>
                <span className="font-medium">{c.subject}</span> — {c.detail}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                between {c.origins.join(' and ')}
              </p>
            </div>
          ))}
        </Card>
      ) : null}

      {reading ? (
        <Card className="p-4">
          <h3 className="mb-1 text-sm font-semibold">What it rests on</h3>
          <p className="text-xs text-muted-foreground">{reading.sourceMix.reading}</p>
        </Card>
      ) : null}

      {/* ── The gaps ────────────────────────────────────────────────────── */}
      {reading && reading.gaps.length > 0 ? (
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Before acting on this</h3>
          {reading.gaps.map((g, i) => (
            <div key={i} className="border-b border-border/40 py-2 last:border-0">
              <p className="text-xs">{g.detail}</p>
              <p className="mt-0.5 text-[11px] text-primary">{g.check}</p>
            </div>
          ))}
        </Card>
      ) : null}

      {/* ── Where we cannot see ─────────────────────────────────────────── */}
      {brief.blindSpots.length > 0 || brief.quietSources.length > 0 ? (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <EyeOff className="h-4 w-4" />
            Where we cannot see
          </h3>
          {brief.blindSpots.map((r) => (
            <div key={r.region} className="border-b border-border/40 py-1.5 last:border-0">
              <p className="text-xs">
                <span className="font-medium">{r.label}</span> — {r.explanation}
              </p>
            </div>
          ))}
          {/*
            The count is the finding; the roll-call is a lookup.

            This joined all 167 quiet feed keys into one sentence — a paragraph
            of monospace identifiers running the width of the card, which nobody
            reads and everybody scrolls past, putting the evidence below it on
            the far side of that scroll. The names are still here, one tap away,
            because which feed went quiet genuinely matters when you go looking.
          */}
          {brief.quietSources.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              <NameList
                names={brief.quietSources.map((s) => s.sourceKey)}
                label="feeds contributed nothing this run"
                tone="warn"
                limit={8}
              />
              <p className="text-[11px] text-muted-foreground">
                An empty region may be quiet or may be unwatched, and those are not the same thing.
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── The evidence itself ─────────────────────────────────────────── */}
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">Leading stories</h3>
        {brief.stories.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing on the board right now.
          </p>
        ) : (
          brief.stories.map((s) => (
            <div key={s.id} className="border-b border-border/40 py-2 last:border-0">
              <div className="flex items-start justify-between gap-3">
                {s.reports[0]?.sourceUrl ? (
                  <a
                    href={s.reports[0].sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm leading-snug hover:underline"
                  >
                    {s.headline}
                  </a>
                ) : (
                  <span className="text-sm leading-snug">{s.headline}</span>
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground" title={s.gradeReason}>
                  {s.independentOrigins} origin{s.independentOrigins === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {s.lastReportedAt ? relative(s.lastReportedAt) : 'no date stated'}
                {s.countries.length > 0 ? ` · ${s.countries.join(', ')}` : ''}
              </p>
            </div>
          ))
        )}
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground">
        The reading is computed from the evidence above — corroboration, disagreement, age and
        source mix are arithmetic, not opinion, and every sentence can be traced to the rows it
        came from. Where a model also ran, it is named at the top.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}
