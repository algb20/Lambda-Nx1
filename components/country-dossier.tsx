'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Eye, Loader2, Radio, Ship } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { NameList } from '@/components/panel-section'
import { TimeStamp } from '@/components/time-stamp'
import type { CountryRisk } from '@/lib/analysis/country-risk'
import type { CorridorWatch } from '@/lib/analysis/corridors'
import { discardBody } from '@/lib/http/discard'

/**
 * Country instability, shown the way it has to be shown.
 *
 * Every comparable product renders one number per country and ranks nations on
 * it. This renders **two, side by side and the same size**, because the second
 * one decides what the first one means: a signal of 0 at an observability of 24
 * is a country we cannot see, and a reader shown only the 0 concludes the
 * opposite of the truth.
 *
 * The layout carries the argument. The bands are separate blocks with their own
 * headings rather than rows of one table, because a single table *is* the claim
 * that every row is comparable — and across countries seen through very
 * different amounts of coverage, it is not. There is deliberately no way to
 * merge them in the interface.
 */

interface BandGroup {
  label: string
  note: string
  minObservability: number
  countries: CountryRisk[]
}

interface Payload {
  generatedAt: string
  counted: number
  method: string
  bands: BandGroup[]
  corridors?: CorridorWatch[]
}

export function CountryDossier() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<CountryRisk | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/countries?corridors=1', { cache: 'no-store' })
      if (!res.ok) throw new Error(`The country board answered ${res.status}`)
      setData((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the country board')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCountry = useCallback(
    async (iso: string) => {
      if (open === iso) {
        setOpen(null)
        setDetail(null)
        return
      }
      setOpen(iso)
      setDetail(null)
      try {
        const res = await fetch(`/api/countries?iso=${encodeURIComponent(iso)}`, { cache: 'no-store' })
        if (!res.ok) return discardBody(res)
        setDetail(((await res.json()) as { country: CountryRisk }).country)
      } catch {
        /* the row stays open with the summary it already has */
      }
    },
    [open],
  )

  if (error) {
    return (
      <Card className="flex items-start gap-2 border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-muted-foreground">{error}</span>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Scoring every country in the live feed…
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          <Eye className="h-3.5 w-3.5 text-primary" />
          Country instability — with what we can actually see
        </h3>
        <p className="mt-1 max-w-prose text-[11px] leading-relaxed text-muted-foreground">
          {data.method}
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {data.counted} countries appear in the feed right now · generated{' '}
          <TimeStamp iso={data.generatedAt} />
        </p>
      </Card>

      {/*
        When no country is in any band there is one fact, not three.

        The three bands each rendered a full card — heading, method note, and
        "No country currently falls in this band" — so an empty run produced
        three blocks of explanation about an empty result. The bands are a real
        distinction and they come back the moment there is anything to put in
        them; they are simply not worth three cards to say nothing.
      */}
      {data.bands.every((b) => b.countries.length === 0) ? (
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground">
            No country has enough in the current feed to score. The three observability bands
            appear here as soon as any country does — a low score in a thinly observed band means
            we cannot see the country, never that it is calm.
          </p>
        </Card>
      ) : (
        data.bands.map((band) => (
        <Card key={band.label} className="p-3">
          <h4 className="text-xs font-semibold">{band.label}</h4>
          <p className="mt-0.5 max-w-prose text-[10px] leading-relaxed text-muted-foreground">
            {band.note}
          </p>

          {band.countries.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No country currently falls in this band.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {band.countries.slice(0, 12).map((c) => (
                <li key={c.iso}>
                  <button
                    onClick={() => void openCountry(c.iso)}
                    aria-expanded={open === c.iso}
                    className="flex w-full items-center gap-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground">
                      {c.iso}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px]">{c.country}</span>
                    {/* The two numbers, deliberately the same weight. Making the
                        signal larger would restore the exact hierarchy this
                        component exists to refuse. */}
                    <Pair label="signal" value={c.signal} tone="signal" />
                    <Pair label="seen" value={c.observability} tone="observability" />
                    <span className="hidden w-20 shrink-0 text-right text-[10px] text-muted-foreground sm:inline">
                      {c.origins} origin{c.origins === 1 ? '' : 's'}
                    </span>
                  </button>

                  {open === c.iso ? <Detail risk={detail ?? c} loading={!detail} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        ))
      )}

      {data.corridors ? <Corridors watches={data.corridors} /> : null}
    </div>
  )
}

function Pair({ label, value, tone }: { label: string; value: number; tone: 'signal' | 'observability' }) {
  const strong = tone === 'signal' ? value >= 55 : value >= 67
  const weak = tone === 'signal' ? value < 20 : value < 34
  return (
    <span className="flex w-16 shrink-0 items-baseline justify-end gap-1">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`w-6 text-right text-[11px] font-semibold tabular-nums ${
          strong ? 'text-amber-500' : weak ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </span>
  )
}

function Detail({ risk, loading }: { risk: CountryRisk; loading: boolean }) {
  return (
    <div className="space-y-2 border-l-2 border-primary/30 bg-muted/30 px-3 py-2">
      <p className="text-[11px] leading-relaxed">{risk.summary}</p>

      {risk.components.length > 0 ? (
        <ul className="space-y-1">
          {risk.components.slice(0, 6).map((comp) => (
            <li key={comp.category} className="text-[10px] leading-relaxed">
              <span className="font-medium">{comp.label}</span>
              <span className="text-muted-foreground">
                {' '}
                — {comp.count} report{comp.count === 1 ? '' : 's'}, {comp.measured} measured,
                contributing {comp.contribution}
              </span>
              {comp.strongest ? (
                <div className="text-muted-foreground">
                  ↳{' '}
                  {comp.strongest.sourceUrl ? (
                    <a
                      href={comp.strongest.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline-offset-2 hover:underline"
                    >
                      {comp.strongest.title}
                    </a>
                  ) : (
                    comp.strongest.title
                  )}{' '}
                  · {comp.strongest.sourceKey} · <TimeStamp iso={comp.strongest.at} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Not collapsed, not behind a link, not smaller than the score. The
          caveat is the finding as much as the number is. */}
      <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
        <p className="text-[10px] font-medium">What this score does not cover</p>
        <ul className="mt-1 space-y-1">
          {risk.blindSpots.map((spot) => (
            <li key={spot} className="text-[10px] leading-relaxed text-muted-foreground">
              · {spot}
            </li>
          ))}
        </ul>
      </div>

      {loading ? (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading the full dossier…
        </p>
      ) : null}
    </div>
  )
}

function Corridors({ watches }: { watches: CorridorWatch[] }) {
  const active = watches.filter((w) => w.signals.length > 0)
  const quiet = watches.filter((w) => w.signals.length === 0)
  return (
    <Card className="p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold">
        <Ship className="h-3.5 w-3.5 text-primary" />
        Critical corridors
      </h4>
      {/* First, before any number. The strongest comparable product shows AIS
          vessel counts here; a reader who assumes these are the same thing
          would be badly misled, and that assumption is entirely reasonable. */}
      <p className="mt-1 max-w-prose rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[10px] leading-relaxed">
        <span className="font-medium">Not a vessel count.</span> We carry no AIS. This is published
        activity near each corridor that could affect transit — the causes, which appear before a
        transit count moves. A corridor can be badly disrupted with nothing here.
      </p>

      {/*
        Only the corridors that have something to report get a block.

        All twelve used to render in full — name, what it carries, a summary
        sentence — so a quiet day produced twelve paragraphs saying "No
        published activity in the watch radius during this window," one after
        another. That is the same fact twelve times, at the size of a finding,
        and it buried the one corridor that might actually matter.

        The silent ones are still named below, because "we watched these and saw
        nothing" is itself worth knowing. It costs one line instead of twelve
        blocks.
      */}
      <ul className="mt-2 divide-y divide-border/60">
        {active.map((w) => (
          <li key={w.corridor.key} className="py-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                {w.corridor.name}
              </span>
              <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                pressure
              </span>
              <span
                className={`w-6 text-right text-[11px] font-semibold tabular-nums ${
                  w.pressure >= 60 ? 'text-amber-500' : w.pressure === 0 ? 'text-muted-foreground' : ''
                }`}
              >
                {w.pressure}
              </span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">{w.corridor.carries}</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground">{w.summary}</p>
            {w.signals.slice(0, 3).map((s) => (
              <p key={`${s.sourceKey}-${s.title}`} className="text-[10px] text-muted-foreground">
                ↳{' '}
                {s.sourceUrl ? (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline-offset-2 hover:underline"
                  >
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}{' '}
                · {s.distanceKm} km · {s.categoryLabel} · <TimeStamp iso={s.at} />
              </p>
            ))}
          </li>
        ))}
      </ul>

      {active.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          None of the {watches.length} corridors we watch has published activity in this window.
        </p>
      ) : null}

      {quiet.length > 0 ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <NameList
            names={quiet.map((w) => w.corridor.name)}
            label="corridors watched with nothing published in this window — unobserved is not the same as clear"
            limit={6}
          />
        </div>
      ) : null}

      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Radio className="h-3 w-3" />
        {active.length} of {watches.length} corridors have any published activity in the current
        window. The rest are unobserved, which is not the same as clear.
      </p>
    </Card>
  )
}
