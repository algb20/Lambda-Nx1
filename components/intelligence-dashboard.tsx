'use client'

import { useState } from 'react'
import { Globe, AtSign, Mail, Loader2, ShieldCheck, AlertCircle, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DomainReport } from '@/lib/modules/domain'
import type { UsernameReport, EmailReport } from '@/lib/modules/identity'

type Mode = 'domain' | 'username' | 'email'
type Result =
  | { kind: 'domain'; data: DomainReport }
  | { kind: 'username'; data: UsernameReport }
  | { kind: 'email'; data: EmailReport }

const MODES: Array<{ id: Mode; label: string; icon: typeof Globe; placeholder: string; bodyKey: string; endpoint: string }> = [
  { id: 'domain', label: 'Domain', icon: Globe, placeholder: 'example.com', bodyKey: 'domain', endpoint: '/api/intelligence/domain' },
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'octocat', bodyKey: 'username', endpoint: '/api/intelligence/username' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'name@example.com', bodyKey: 'email', endpoint: '/api/intelligence/email' },
]

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{r.subject}</h3>
          <span className="text-xs text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</span>
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">@{r.subject}</h3>
          <span className="text-xs text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</span>
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{r.subject}</h3>
          <span className="text-xs text-muted-foreground">{new Date(r.generatedAt).toLocaleString()}</span>
        </div>
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

export function IntelligenceDashboard() {
  const [mode, setMode] = useState<Mode>('domain')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const active = MODES.find((m) => m.id === mode)!

  const run = async () => {
    const value = query.trim()
    if (!value || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(active.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [active.bodyKey]: value }),
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

  const switchMode = (m: Mode) => {
    setMode(m)
    setResult(null)
    setError(null)
    setQuery('')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Intelligence</h2>

      {/* Segmented mode control */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1">
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
              {m.label}
            </button>
          )
        })}
      </div>

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
    </div>
  )
}
