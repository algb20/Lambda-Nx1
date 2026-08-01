'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Globe,
  AtSign,
  Mail,
  Image as ImageIcon,
  ShieldAlert,
  Landmark,
  LineChart,
  Gavel,
  Network,
  Newspaper,
  Radio,
  Gauge,
  ScanSearch,
  Crosshair,
  Microscope,
  Zap,
  Loader2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  MapPin,
} from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DomainReport } from '@/lib/modules/domain'
import type { UsernameReport, EmailReport } from '@/lib/modules/identity'
import type { MediaReport } from '@/lib/modules/media'
import type { ThreatReport } from '@/lib/modules/threat'
import type { FinanceReport } from '@/lib/modules/finance'
import type { MarketsReport } from '@/lib/modules/markets'
import type { ProcurementReport } from '@/lib/modules/procurement'
import type { OwnershipReport } from '@/lib/modules/ownership'
import type { NewsReport } from '@/lib/modules/news'
import type { MarketsBoardReport } from '@/lib/modules/markets-board'
import type { NexusReport } from '@/lib/modules/nexus'
import type { GeoReport } from '@/lib/modules/geo'
import type { ResearchReport } from '@/lib/modules/research'
import { TargetTracker } from '@/components/target-tracker'
import { DataGlobe } from '@/components/data-globe'
import { pointsFromCountries, type GlobePoint } from '@/lib/geo/centroids'
import { PREDICATE_LABEL } from '@/lib/engine/ontology'
import { proposePivots } from '@/lib/modules/copilot'
import type { Evidence } from '@/lib/engine/types'
import type { AnalystVerdict, Severity } from '@/lib/ai/types'

type Mode =
  | 'nexus'
  | 'track'
  | 'domain'
  | 'username'
  | 'email'
  | 'threat'
  | 'finance'
  | 'markets'
  | 'procurement'
  | 'ownership'
  | 'news'
  | 'board'
  | 'geo'
  | 'research'
  | 'media'
type Result =
  | { kind: 'nexus'; data: NexusReport }
  | { kind: 'track'; data: { query: string } }
  | { kind: 'domain'; data: DomainReport }
  | { kind: 'username'; data: UsernameReport }
  | { kind: 'email'; data: EmailReport }
  | { kind: 'threat'; data: ThreatReport }
  | { kind: 'finance'; data: FinanceReport }
  | { kind: 'markets'; data: MarketsReport }
  | { kind: 'procurement'; data: ProcurementReport }
  | { kind: 'ownership'; data: OwnershipReport }
  | { kind: 'news'; data: NewsReport }
  | { kind: 'board'; data: MarketsBoardReport }
  | { kind: 'geo'; data: GeoReport }
  | { kind: 'research'; data: ResearchReport }
  | { kind: 'media'; data: MediaReport }

const MODES: Array<{ id: Mode; label: string; icon: typeof Globe; placeholder: string }> = [
  { id: 'nexus', label: 'Unified', icon: ScanSearch, placeholder: 'anything — domain, IP, email, company, wallet, hash…' },
  { id: 'track', label: 'Track', icon: Crosshair, placeholder: 'track a target live — stock, coin, company, domain…' },
  { id: 'domain', label: 'Domain', icon: Globe, placeholder: 'example.com' },
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'octocat' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'name@example.com' },
  { id: 'threat', label: 'Threat', icon: ShieldAlert, placeholder: 'IP, domain, URL or hash' },
  { id: 'finance', label: 'Finance', icon: Landmark, placeholder: 'company name or BTC address' },
  { id: 'board', label: 'Board', icon: Gauge, placeholder: 'live market board — press Load' },
  { id: 'markets', label: 'Markets', icon: LineChart, placeholder: 'BTC, AAPL, or USD/EUR' },
  { id: 'procurement', label: 'Contracts', icon: Gavel, placeholder: 'company, agency or project name' },
  { id: 'ownership', label: 'Ownership', icon: Network, placeholder: 'company / legal-entity name' },
  { id: 'geo', label: 'Geo', icon: MapPin, placeholder: 'place, "lat,lon", or aircraft ICAO24 hex' },
  { id: 'research', label: 'Research', icon: Microscope, placeholder: 'a topic, technology or research question' },
  { id: 'news', label: 'News', icon: Newspaper, placeholder: 'topic (optional) — empty = top world events' },
  { id: 'media', label: 'Media', icon: ImageIcon, placeholder: 'https://…/image.jpg' },
]

const BODY_KEY: Partial<Record<Mode, string>> = {
  nexus: 'query',
  threat: 'indicator',
  finance: 'query',
  markets: 'query',
  procurement: 'query',
  ownership: 'query',
  news: 'query',
  geo: 'query',
  research: 'query',
}

/** Modes where an empty query is valid (returns a top/overview result). */
const EMPTY_OK: Partial<Record<Mode, boolean>> = { news: true, board: true }

type EvidenceItem = DomainReport['sections']['dns'][number]

function SourceTag({ e }: { e: EvidenceItem }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {e.admiralty ? (
        <Badge variant="outline" className="text-[10px]" title="Admiralty rating">
          {e.admiralty.source}
          {e.admiralty.info}
        </Badge>
      ) : null}
      <Badge variant="secondary" className="text-[10px]">
        {e.sourceKey}
      </Badge>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function ReportHeader({ title, at }: { title: string; at: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="font-semibold break-all">{title}</h3>
      <span className="text-xs text-muted-foreground">{new Date(at).toLocaleString()}</span>
    </div>
  )
}

const DOMAIN_SECTIONS: Array<[keyof DomainReport['sections'], string]> = [
  ['registration', 'Registration (RDAP)'],
  ['dns', 'DNS records'],
  ['subdomains', 'Subdomains (CT logs)'],
  ['hosting', 'Hosting & technology'],
  ['ipExposure', 'IP exposure'],
  ['history', 'Archive history'],
]

function DomainView({ r }: { r: DomainReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ReportHeader title={r.subject} at={r.generatedAt} />
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Stat label="Subdomains" value={r.summary.subdomains} />
          <Stat label="IPs" value={r.summary.resolvedIps} />
          <Stat label="Entities" value={r.summary.entities} />
          <Stat label="Sources ✓" value={r.summary.sourcesOk} />
          <Stat label="Sources ✗" value={r.summary.sourcesFailed} />
        </div>
      </Card>
      {DOMAIN_SECTIONS.map(([key, label]) => {
        const items = r.sections[key]
        if (!items || items.length === 0) return null
        return (
          <Card key={key} className="p-4">
            <h4 className="mb-1 text-sm font-semibold">{label}</h4>
            {items.map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                <span className="text-sm">{e.claim}</span>
                <SourceTag e={e} />
              </div>
            ))}
          </Card>
        )
      })}
    </div>
  )
}

function UsernameView({ r }: { r: UsernameReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ReportHeader title={`@${r.subject}`} at={r.generatedAt} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Platforms" value={r.summary.platformsFound} />
          <Stat label="Sources ✓" value={r.summary.sourcesOk} />
          <Stat label="Sources ✗" value={r.summary.sourcesFailed} />
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Accounts found</h4>
        {r.found.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No public accounts found on the checked platforms.</p>
        ) : (
          r.found.map((e, i) => {
            const d = e.data as { platform: string; url: string }
            return (
              <div key={i} className="flex items-center justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  {d.platform}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <SourceTag e={e} />
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}

function EmailView({ r }: { r: EmailReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ReportHeader title={r.subject} at={r.generatedAt} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Breaches" value={r.summary.breachCount} />
          <Stat label="Gravatar" value={r.summary.hasGravatar ? 'Yes' : 'No'} />
          <Stat label="Sources ✓" value={r.summary.sourcesOk} />
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Breach exposure</h4>
        {r.breaches.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No known breach exposure for this address.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {r.breaches.map((e, i) => (
              <Badge key={i} variant="outline" className="border-destructive/40 text-destructive">
                {(e.data as { breach: string }).breach}
              </Badge>
            ))}
          </div>
        )}
      </Card>
      {r.profiles.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Public profiles</h4>
          {r.profiles.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              <span className="text-sm">{e.claim}</span>
              <SourceTag e={e} />
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  )
}

function FinanceView({ r }: { r: FinanceReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.subject}</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.type} · {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">{r.summary.matches} match{r.summary.matches === 1 ? '' : 'es'}</Badge>
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">
          {r.type === 'wallet' ? 'Ledger facts' : 'Screening results'}
        </h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No matches in the checked registries. This is not a clearance.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              <span className="text-sm">{e.claim}</span>
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function MarketsView({ r }: { r: MarketsReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.subject}</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.kind === 'fx' ? 'currency pair' : 'asset / company'} ·{' '}
              {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">
            {r.summary.matches} fact{r.summary.matches === 1 ? '' : 's'}
          </Badge>
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Market &amp; disclosure facts</h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No public market data or filings matched. Try a ticker, coin, company name, or a
            pair like USD/EUR.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {e.claim}
                </a>
              ) : (
                <span className="text-sm">{e.claim}</span>
              )}
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function ResearchView({ r }: { r: ResearchReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.subject}</h3>
            <p className="text-[11px] text-muted-foreground">
              research frontier · {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">{r.summary.papers} paper{r.summary.papers === 1 ? '' : 's'}</Badge>
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Papers &amp; findings</h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No open-scholarship match. Papers are claims — corroborate before relying on them.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {e.claim}
                </a>
              ) : (
                <span className="text-sm">{e.claim}</span>
              )}
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function geoPoints(r: GeoReport): GlobePoint[] {
  const pts: GlobePoint[] = []
  for (const e of r.findings) {
    const d = (e.data ?? {}) as { lat?: number | string; lon?: number | string }
    const lat = typeof d.lat === 'string' ? Number(d.lat) : d.lat
    const lon = typeof d.lon === 'string' ? Number(d.lon) : d.lon
    if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
      pts.push({ lat, lon, label: e.claim.slice(0, 60), weight: 1 })
    }
  }
  return pts
}

function GeoView({ r }: { r: GeoReport }) {
  const pts = geoPoints(r)
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.subject}</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.kind} · {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">{r.summary.matches} result{r.summary.matches === 1 ? '' : 's'}</Badge>
        </div>
      </Card>

      {pts.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataGlobe points={pts} height={300} focus={{ lat: pts[0].lat, lon: pts[0].lon }} />
        </Card>
      ) : null}
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Geospatial results</h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No public geospatial match. Try a place, a &quot;lat,lon&quot; pair, or an aircraft
            ICAO24 hex.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {e.claim}
                </a>
              ) : (
                <span className="text-sm">{e.claim}</span>
              )}
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function ProcurementView({ r }: { r: ProcurementReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.subject}</h3>
            <p className="text-[11px] text-muted-foreground">
              public contracts &amp; awards · {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge variant="secondary">
            {r.summary.matches} record{r.summary.matches === 1 ? '' : 's'}
          </Badge>
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">Award &amp; contract records</h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No public award records matched. This is not a clearance — many
            jurisdictions are not yet indexed.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {e.claim}
                </a>
              ) : (
                <span className="text-sm">{e.claim}</span>
              )}
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function OwnershipView({ r }: { r: OwnershipReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ReportHeader title={r.resolvedEntity ?? r.subject} at={r.generatedAt} />
        {r.resolvedEntity && r.resolvedEntity !== r.subject ? (
          <p className="text-[11px] text-muted-foreground">matched from “{r.subject}”</p>
        ) : null}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Parents" value={r.summary.parents} />
          <Stat label="Ultimate" value={r.summary.ultimateParents} />
          <Stat label="Subsidiaries" value={r.summary.subsidiaries} />
        </div>
      </Card>

      {r.graph.edges.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Control map</h4>
          <div className="space-y-1.5">
            {r.graph.edges.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium break-all">{r.resolvedEntity ?? r.subject}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {e.relation}
                </Badge>
                <span className="break-all text-muted-foreground">{e.to.replace(/^company:/, '')}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <h4 className="mb-1 text-sm font-semibold">GLEIF records</h4>
        {r.findings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No GLEIF legal-entity match. Absence of a filed relationship is not a claim of
            independence.
          </p>
        ) : (
          r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              {e.sourceUrl ? (
                <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {e.claim}
                </a>
              ) : (
                <span className="text-sm">{e.claim}</span>
              )}
              <SourceTag e={e} />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return ''
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function NewsView({ r, onReload, loading }: { r: NewsReport; onReload: () => void; loading: boolean }) {
  const [auto, setAuto] = useState(true)
  const reloadRef = useRef(onReload)
  reloadRef.current = onReload

  // Non-stop: while auto is on, refresh every 60s (only when the tab is visible).
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) reloadRef.current()
    }, 60000)
    return () => clearInterval(id)
  }, [auto])

  const country = (e: EvidenceItem) => (e.data as { country?: string } | undefined)?.country
  const domain = (e: EvidenceItem) => (e.data as { domain?: string } | undefined)?.domain
  const mapPoints = pointsFromCountries(r.items.map((e) => country(e)))

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{r.topic ? `News · ${r.topic}` : 'Top world events'}</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.summary.count} signal{r.summary.count === 1 ? '' : 's'} ·{' '}
              {r.summary.sources.length} source{r.summary.sources.length === 1 ? '' : 's'} ·
              updated {new Date(r.generatedAt).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => setAuto((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              auto ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
            }`}
            title={auto ? 'Live — refreshing every 60s' : 'Auto-refresh paused'}
          >
            <Radio className={`h-3.5 w-3.5 ${auto && loading ? 'animate-pulse' : ''}`} />
            {auto ? 'Live' : 'Paused'}
          </button>
        </div>
      </Card>

      {mapPoints.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <DataGlobe points={mapPoints} height={280} />
        </Card>
      ) : null}

      <Card className="p-4">
        {r.items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No signals right now. Sources may be rate-limited — Live will retry.
          </p>
        ) : (
          r.items.map((e, i) => (
            <div key={i} className="border-b border-border/40 py-2.5 last:border-0">
              <div className="flex items-start justify-between gap-3">
                {e.sourceUrl ? (
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm leading-snug hover:underline">
                    {e.claim}
                  </a>
                ) : (
                  <span className="text-sm leading-snug">{e.claim}</span>
                )}
                <SourceTag e={e} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {domain(e) ? <span className="font-mono">{domain(e)}</span> : null}
                {country(e) ? <span>· {country(e)}</span> : null}
                <span>· {relativeTime(e.retrievedAt)}</span>
              </div>
            </div>
          ))
        )}
      </Card>
      <p className="px-1 text-[11px] text-muted-foreground">
        Signals from primary-leaning public sources — we link to the origin, never republish.
        Headlines are reports, not confirmed facts; corroborate before relying on them.
      </p>
    </div>
  )
}

function NexusView({ r, onPivot }: { r: NexusReport; onPivot: (selector: string) => void }) {
  const active = r.sections.filter((s) => s.findings.length > 0)
  const pivots = proposePivots(r.ontology)
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold break-all">{r.input}</h3>
            <Badge variant="outline" className="text-[10px] uppercase">
              {r.selectorType}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Zap className={`h-3.5 w-3.5 ${r.speed.cacheHit ? 'text-amber-500' : 'text-emerald-500'}`} />
            {r.speed.cacheHit ? 'cached · instant' : `${r.speed.elapsedMs}ms`}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Stat label="Findings" value={r.summary.findings} />
          <Stat label="Entities" value={r.summary.entities} />
          <Stat label="Links" value={r.graph.edges.length} />
          <Stat label="Gateways ✓" value={r.summary.sourcesOk} />
          <Stat label="Fastest" value={r.speed.fastestMs !== null ? `${r.speed.fastestMs}ms` : '—'} />
        </div>
      </Card>

      {/* Trust Lens — our visible, auditable neutrality & corroboration measure. */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Trust Lens</h4>
          <span className="font-mono text-[10px] text-muted-foreground" title="Tamper-evident dossier seal">
            {r.seal}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Neutrality</span>
              <span className="font-semibold tabular-nums">{r.trust.neutrality}/100</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  r.trust.neutrality >= 70 ? 'bg-emerald-500' : r.trust.neutrality >= 40 ? 'bg-amber-500' : 'bg-destructive'
                }`}
                style={{ width: `${r.trust.neutrality}%` }}
              />
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              r.trust.corroboration === 'strong'
                ? 'border-emerald-500/40 text-emerald-500'
                : r.trust.corroboration === 'single'
                  ? 'border-destructive/40 text-destructive'
                  : 'border-amber-500/40 text-amber-600'
            }
          >
            {r.trust.corroboration}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Ind. sources" value={r.trust.independentSources} />
          <Stat label="Reliable" value={r.trust.reliableSources} />
          <Stat label="Countries" value={r.trust.sourceCountries.length} />
          <Stat label="Corroborated" value={r.trust.corroboratedTopics} />
        </div>
      </Card>

      {/* Ontology — one typed model of entities & relations across gateways. */}
      {r.ontology.edges.length > 0 ? (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Ontology</h4>
            <span className="text-[10px] text-muted-foreground">
              {r.ontology.stats.nodes} entities · {r.ontology.stats.edges} relations
            </span>
          </div>
          <div className="space-y-1.5">
            {r.ontology.edges.slice(0, 24).map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium break-all">{r.input}</span>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {PREDICATE_LABEL[e.predicate]}
                </Badge>
                <span className="break-all text-muted-foreground">{e.to.replace(/^[^:]+:/, '')}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
                  {e.confidence} · {e.sources.length}×
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Pivot Copilot — executable next steps from the ontology (you approve each). */}
      {pivots.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Next pivots</h4>
          <p className="mb-2 text-[11px] text-muted-foreground">
            The copilot proposes the strongest passive next step — you approve each run.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pivots.map((p, i) => (
              <button
                key={i}
                onClick={() => onPivot(p.selector)}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
                title={`${p.reason} · ${p.confidence}`}
              >
                <span className="font-medium break-all">{p.selector}</span>
                <span className="text-[10px] text-muted-foreground">{p.reason}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Coverage strip — every gateway that ran, with its latency. */}
      <Card className="p-4">
        <h4 className="mb-2 text-sm font-semibold">Coverage</h4>
        <div className="flex flex-wrap gap-1.5">
          {r.sections.map((s) => (
            <span
              key={s.gateway}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                s.findings.length > 0
                  ? 'border-emerald-500/30 text-foreground'
                  : 'border-border text-muted-foreground'
              }`}
              title={`${s.capability} · ${s.ms}ms`}
            >
              {s.gateway}
              <span className="tabular-nums text-muted-foreground">{s.findings.length}</span>
              <span className="text-[10px] text-muted-foreground/70">{s.ms}ms</span>
            </span>
          ))}
        </div>
      </Card>

      {active.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No public findings across the gateways for this selector. Absence of a record is not a
          conclusion.
        </Card>
      ) : (
        active.map((s) => (
          <Card key={s.gateway} className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-semibold">{s.gateway}</h4>
              <Badge variant="secondary" className="text-[10px]">
                {s.findings.length} · {s.ms}ms
              </Badge>
            </div>
            {s.findings.slice(0, 12).map((e, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                {e.sourceUrl ? (
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                    {e.claim}
                  </a>
                ) : (
                  <span className="text-sm">{e.claim}</span>
                )}
                <SourceTag e={e} />
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  )
}

function fmtBoardPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toPrecision(4)
}

function BoardView({ r, onReload, loading }: { r: MarketsBoardReport; onReload: () => void; loading: boolean }) {
  const [auto, setAuto] = useState(true)
  const reloadRef = useRef(onReload)
  reloadRef.current = onReload

  // Live: refresh every 45s while visible (markets move faster than news).
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) reloadRef.current()
    }, 45000)
    return () => clearInterval(id)
  }, [auto])

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Markets board</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.summary.instruments} instruments · updated {new Date(r.generatedAt).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={() => setAuto((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              auto ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
            }`}
            title={auto ? 'Live — refreshing every 45s' : 'Auto-refresh paused'}
          >
            <Radio className={`h-3.5 w-3.5 ${auto && loading ? 'animate-pulse' : ''}`} />
            {auto ? 'Live' : 'Paused'}
          </button>
        </div>
      </Card>

      {r.sections.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No quotes right now. Sources may be rate-limited — Live will retry.
        </Card>
      ) : (
        r.sections.map((section) => (
          <Card key={section.key} className="p-4">
            <h4 className="mb-2 text-sm font-semibold">{section.title}</h4>
            <div className="divide-y divide-border/40">
              {section.rows.map((row) => {
                const px = row.unit && row.unit !== '' ? '$' : ''
                const up = row.change !== null && row.change >= 0
                return (
                  <div key={row.symbol} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
                          {row.name}
                        </a>
                      ) : (
                        <span className="text-sm font-medium">{row.name}</span>
                      )}
                      <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{row.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-sm tabular-nums">
                        {px}
                        {fmtBoardPrice(row.price)}
                      </span>
                      {row.change !== null ? (
                        <span
                          className={`w-16 text-xs tabular-nums ${up ? 'text-emerald-500' : 'text-destructive'}`}
                        >
                          {up ? '+' : ''}
                          {row.change.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="w-16 text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ))
      )}
      <p className="px-1 text-[11px] text-muted-foreground">
        Quotes from public sources (CoinGecko · Stooq · ECB), shown as published — never a
        prediction. Change shown is intraday vs. session open where available.
      </p>
    </div>
  )
}

function ThreatView({ r }: { r: ThreatReport }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold break-all">{r.indicator}</h3>
            <p className="text-[11px] text-muted-foreground">
              {r.type} · {new Date(r.generatedAt).toLocaleString()}
            </p>
          </div>
          <Badge
            variant={r.flagged ? 'outline' : 'secondary'}
            className={r.flagged ? 'border-destructive/50 text-destructive' : 'text-green-600'}
          >
            {r.flagged ? `Flagged (${r.summary.hits})` : 'No known threat'}
          </Badge>
        </div>
      </Card>

      {r.findings.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Threat findings</h4>
          {r.findings.map((e, i) => (
            <div key={i} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
              <span className="text-sm">{e.claim}</span>
              <SourceTag e={e} />
            </div>
          ))}
        </Card>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">
          No entries in the checked public threat feeds. This is not a guarantee of safety.
        </Card>
      )}
    </div>
  )
}

function MediaView({ r }: { r: MediaReport }) {
  const m = r.metadata
  const rows: Array<[string, string | undefined]> = [
    ['Camera', [m.make, m.model].filter(Boolean).join(' ') || undefined],
    ['Lens', m.lens],
    ['Software', m.software],
    ['Taken', m.dateTaken],
    ['Dimensions', m.width && m.height ? `${m.width}×${m.height}` : undefined],
  ]
  const hasRows = rows.some(([, v]) => v)
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <ReportHeader title="Media analysis" at={r.generatedAt} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="EXIF" value={r.hasExif ? 'Present' : 'None'} />
          <Stat label="GPS" value={m.gps ? 'Yes' : 'No'} />
        </div>
      </Card>

      {hasRows ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">Metadata</h4>
          {rows.map(([k, v]) =>
            v ? (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
                <span className="text-sm text-muted-foreground">{k}</span>
                <span className="text-sm text-right">{v}</span>
              </div>
            ) : null,
          )}
          {r.gpsMapUrl ? (
            <a href={r.gpsMapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <MapPin className="h-4 w-4" />
              View capture location
            </a>
          ) : null}
        </Card>
      ) : null}

      {r.aiIndicators.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-1 text-sm font-semibold">AI-generation indicators</h4>
          {r.aiIndicators.map((ind, i) => (
            <p key={i} className="border-b border-border/40 py-2 text-sm text-muted-foreground last:border-0">
              {ind}
            </p>
          ))}
        </Card>
      ) : null}

      {r.reverseLinks.length > 0 ? (
        <Card className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Reverse image search</h4>
          <div className="flex flex-wrap gap-2">
            {r.reverseLinks.map((l) => (
              <a key={l.engine} href={l.url} target="_blank" rel="noreferrer">
                <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                  {l.engine}
                </Badge>
              </a>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

/**
 * Pull the graded evidence out of any report so the AI analyst can triage it.
 * We strip the raw `data` payload — the analyst reasons over the claims, sources
 * and grades, not the bytes — which keeps the request lean. Media analysis is
 * local/metadata and has no Evidence[] model, so it opts out.
 */
function collectFindings(result: Result): { subject: string; gateway: string; findings: Evidence[] } | null {
  const slim = (list: Evidence[]): Evidence[] =>
    list.map(({ claim, entity, sourceKey, sourceUrl, retrievedAt, admiralty, confidence }) => ({
      claim,
      entity,
      sourceKey,
      sourceUrl,
      retrievedAt,
      admiralty,
      confidence,
    }))

  switch (result.kind) {
    case 'track':
      return null // the tracker streams its own signature; no static AI panel
    case 'nexus':
      return { subject: result.data.input, gateway: result.data.selectorType, findings: slim(result.data.findings) }
    case 'domain': {
      const findings = Object.values(result.data.sections).flat() as Evidence[]
      return { subject: result.data.subject, gateway: 'domain', findings: slim(findings) }
    }
    case 'username':
      return { subject: result.data.subject, gateway: 'username', findings: slim(result.data.found) }
    case 'email':
      return {
        subject: result.data.subject,
        gateway: 'email',
        findings: slim([...result.data.breaches, ...result.data.profiles]),
      }
    case 'threat':
      return { subject: result.data.indicator, gateway: 'threat', findings: slim(result.data.findings) }
    case 'finance':
      return { subject: result.data.subject, gateway: 'finance', findings: slim(result.data.findings) }
    case 'markets':
      return { subject: result.data.subject, gateway: 'markets', findings: slim(result.data.findings) }
    case 'procurement':
      return { subject: result.data.subject, gateway: 'procurement', findings: slim(result.data.findings) }
    case 'ownership':
      return {
        subject: result.data.resolvedEntity ?? result.data.subject,
        gateway: 'ownership',
        findings: slim(result.data.findings),
      }
    case 'news':
      return {
        subject: result.data.topic ?? 'Top world events',
        gateway: 'news',
        findings: slim(result.data.items),
      }
    case 'board':
      return { subject: 'Markets board', gateway: 'markets', findings: slim(result.data.findings) }
    case 'geo':
      return { subject: result.data.subject, gateway: 'geo', findings: slim(result.data.findings) }
    case 'research':
      return { subject: result.data.subject, gateway: 'research', findings: slim(result.data.findings) }
    case 'media':
      return null
  }
}

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'border-destructive/60 text-destructive',
  high: 'border-destructive/50 text-destructive',
  medium: 'border-amber-500/50 text-amber-600',
  low: 'border-border text-muted-foreground',
  info: 'border-border text-muted-foreground',
}

function AiAnalystPanel({ subject, gateway, findings }: { subject: string; gateway: string; findings: Evidence[] }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<AnalystVerdict | null>(null)

  const run = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, gateway, findings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Analysis failed')
      setVerdict(data as AnalystVerdict)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">AI analyst</h4>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading || findings.length === 0}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : verdict ? 'Re-analyze' : 'Analyze with AI'}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Triages the findings above — it summarizes and prioritizes, it never adds or verifies facts.
      </p>

      {error ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {verdict ? (
        !verdict.configured ? (
          <p className="mt-3 text-sm text-muted-foreground">{verdict.summary}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={SEVERITY_STYLE[verdict.severity]}>
                {verdict.severity.toUpperCase()}
              </Badge>
              {verdict.confidenceCaveat ? (
                <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                  Low-confidence evidence
                </Badge>
              ) : null}
              {verdict.model ? (
                <span className="text-[10px] text-muted-foreground">{verdict.model}</span>
              ) : null}
            </div>
            <p className="text-sm leading-relaxed">{verdict.summary}</p>
            {verdict.keyPoints.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Key points</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {verdict.keyPoints.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {verdict.nextSteps.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Suggested next pivots</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {verdict.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {verdict.needsVerification.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-amber-600">Needs independent verification</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {verdict.needsVerification.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </Card>
  )
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function IntelligenceDashboard() {
  const [mode, setMode] = useState<Mode>('nexus')
  const [query, setQuery] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = MODES.find((m) => m.id === mode)!
  const aiInput = result ? collectFindings(result) : null

  /** Copilot: run a unified investigation on a proposed pivot (user-approved). */
  const pivotTo = async (selector: string) => {
    setMode('nexus')
    setQuery(selector)
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/intelligence/nexus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: selector }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Investigation failed')
      setResult({ kind: 'nexus', data } as Result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Investigation failed')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setQuery('')
    setFile(null)
    reset()
  }

  const run = async () => {
    if (loading) return
    setLoading(true)
    reset()
    try {
      let endpoint: string
      let payload: Record<string, unknown>
      if (mode === 'media') {
        if (!file && !query.trim()) throw new Error('Choose an image or paste an image URL.')
        endpoint = '/api/intelligence/media'
        payload = {
          imageBase64: file ? await readFileAsBase64(file) : undefined,
          imageUrl: query.trim() || undefined,
        }
      } else if (mode === 'track') {
        const value = query.trim()
        if (!value) throw new Error('Enter a target to track.')
        setResult({ kind: 'track', data: { query: value } })
        setLoading(false)
        return
      } else if (mode === 'board') {
        endpoint = '/api/intelligence/board'
        payload = {}
      } else {
        const value = query.trim()
        if (!value && !EMPTY_OK[mode]) throw new Error('Enter a value to investigate.')
        endpoint = `/api/intelligence/${mode}`
        payload = { [BODY_KEY[mode] ?? mode]: value }
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Investigation failed')
      setResult({ kind: mode, data } as Result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Investigation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Intelligence</h2>

      <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
        {MODES.map((m) => {
          const Icon = m.icon
          const isActive = m.id === mode
          return (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              title={m.label}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          )
        })}
      </div>

      {mode === 'media' ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading} className="flex-1">
              {file ? file.name : 'Choose image (EXIF is read locally)'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="…or image URL for reverse search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={loading}
            />
            <Button onClick={run} disabled={loading || (!file && !query.trim())}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyze'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder={active.placeholder}
            inputMode={mode === 'email' ? 'email' : 'text'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={loading}
          />
          <Button onClick={run} disabled={loading || (!query.trim() && !EMPTY_OK[mode])}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'board' ? (
              'Load'
            ) : mode === 'news' ? (
              'Fetch'
            ) : mode === 'track' ? (
              'Track'
            ) : (
              'Investigate'
            )}
          </Button>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
        Passive &amp; keyless — public sources only, the subject is never contacted directly.
      </p>

      {error ? (
        <Card className="flex items-center gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      ) : null}

      {result?.kind === 'nexus' ? <NexusView r={result.data} onPivot={pivotTo} /> : null}
      {result?.kind === 'track' ? <TargetTracker query={result.data.query} /> : null}
      {result?.kind === 'domain' ? <DomainView r={result.data} /> : null}
      {result?.kind === 'username' ? <UsernameView r={result.data} /> : null}
      {result?.kind === 'email' ? <EmailView r={result.data} /> : null}
      {result?.kind === 'threat' ? <ThreatView r={result.data} /> : null}
      {result?.kind === 'finance' ? <FinanceView r={result.data} /> : null}
      {result?.kind === 'markets' ? <MarketsView r={result.data} /> : null}
      {result?.kind === 'procurement' ? <ProcurementView r={result.data} /> : null}
      {result?.kind === 'ownership' ? <OwnershipView r={result.data} /> : null}
      {result?.kind === 'news' ? <NewsView r={result.data} onReload={run} loading={loading} /> : null}
      {result?.kind === 'board' ? <BoardView r={result.data} onReload={run} loading={loading} /> : null}
      {result?.kind === 'geo' ? <GeoView r={result.data} /> : null}
      {result?.kind === 'research' ? <ResearchView r={result.data} /> : null}
      {result?.kind === 'media' ? <MediaView r={result.data} /> : null}

      {aiInput && aiInput.findings.length > 0 ? (
        <AiAnalystPanel
          key={`${aiInput.gateway}:${aiInput.subject}`}
          subject={aiInput.subject}
          gateway={aiInput.gateway}
          findings={aiInput.findings}
        />
      ) : null}
    </div>
  )
}
