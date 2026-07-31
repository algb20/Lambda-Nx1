'use client'

import { useRef, useState } from 'react'
import {
  Globe,
  AtSign,
  Mail,
  Image as ImageIcon,
  ShieldAlert,
  Landmark,
  LineChart,
  Gavel,
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
import type { Evidence } from '@/lib/engine/types'
import type { AnalystVerdict, Severity } from '@/lib/ai/types'

type Mode = 'domain' | 'username' | 'email' | 'threat' | 'finance' | 'markets' | 'procurement' | 'media'
type Result =
  | { kind: 'domain'; data: DomainReport }
  | { kind: 'username'; data: UsernameReport }
  | { kind: 'email'; data: EmailReport }
  | { kind: 'threat'; data: ThreatReport }
  | { kind: 'finance'; data: FinanceReport }
  | { kind: 'markets'; data: MarketsReport }
  | { kind: 'procurement'; data: ProcurementReport }
  | { kind: 'media'; data: MediaReport }

const MODES: Array<{ id: Mode; label: string; icon: typeof Globe; placeholder: string }> = [
  { id: 'domain', label: 'Domain', icon: Globe, placeholder: 'example.com' },
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'octocat' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'name@example.com' },
  { id: 'threat', label: 'Threat', icon: ShieldAlert, placeholder: 'IP, domain, URL or hash' },
  { id: 'finance', label: 'Finance', icon: Landmark, placeholder: 'company name or BTC address' },
  { id: 'markets', label: 'Markets', icon: LineChart, placeholder: 'BTC, AAPL, or USD/EUR' },
  { id: 'procurement', label: 'Contracts', icon: Gavel, placeholder: 'company, agency or project name' },
  { id: 'media', label: 'Media', icon: ImageIcon, placeholder: 'https://…/image.jpg' },
]

const BODY_KEY: Partial<Record<Mode, string>> = {
  threat: 'indicator',
  finance: 'query',
  markets: 'query',
  procurement: 'query',
}

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
  const [mode, setMode] = useState<Mode>('domain')
  const [query, setQuery] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const active = MODES.find((m) => m.id === mode)!
  const aiInput = result ? collectFindings(result) : null

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
      } else {
        const value = query.trim()
        if (!value) throw new Error('Enter a value to investigate.')
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

      <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted/50 p-1 sm:grid-cols-8">
        {MODES.map((m) => {
          const Icon = m.icon
          const isActive = m.id === mode
          return (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
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
          <Button onClick={run} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Investigate'}
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

      {result?.kind === 'domain' ? <DomainView r={result.data} /> : null}
      {result?.kind === 'username' ? <UsernameView r={result.data} /> : null}
      {result?.kind === 'email' ? <EmailView r={result.data} /> : null}
      {result?.kind === 'threat' ? <ThreatView r={result.data} /> : null}
      {result?.kind === 'finance' ? <FinanceView r={result.data} /> : null}
      {result?.kind === 'markets' ? <MarketsView r={result.data} /> : null}
      {result?.kind === 'procurement' ? <ProcurementView r={result.data} /> : null}
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
