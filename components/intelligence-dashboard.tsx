'use client'

import { useState } from 'react'
import { Search, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DomainReport } from '@/lib/modules/domain'

type EvidenceItem = DomainReport['sections']['dns'][number]

const SECTION_LABELS: Array<[keyof DomainReport['sections'], string]> = [
  ['registration', 'Registration (RDAP)'],
  ['dns', 'DNS records'],
  ['subdomains', 'Subdomains (CT logs)'],
  ['hosting', 'Hosting & technology'],
  ['ipExposure', 'IP exposure'],
  ['history', 'Archive history'],
]

function EvidenceRow({ e }: { e: EvidenceItem }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-sm">{e.claim}</span>
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
    </div>
  )
}

export function IntelligenceDashboard() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DomainReport | null>(null)

  const run = async () => {
    const value = domain.trim()
    if (!value || loading) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await fetch('/api/intelligence/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Investigation failed')
      setReport(data as DomainReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Investigation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Domain intelligence</h2>
      </div>

      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="example.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={loading}
        />
        <Button onClick={run} disabled={loading || !domain.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Investigate'}
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
        Passive & keyless — public sources only, the target is never contacted directly.
      </p>

      {error ? (
        <Card className="flex items-center gap-2 border-destructive/40 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </Card>
      ) : null}

      {report ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{report.subject}</h3>
              <span className="text-xs text-muted-foreground">
                {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {(
                [
                  ['Subdomains', report.summary.subdomains],
                  ['IPs', report.summary.resolvedIps],
                  ['Entities', report.summary.entities],
                  ['Sources ✓', report.summary.sourcesOk],
                  ['Sources ✗', report.summary.sourcesFailed],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-lg bg-muted/40 p-2">
                  <p className="text-lg font-bold">{n}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          {SECTION_LABELS.map(([key, label]) => {
            const items = report.sections[key]
            if (!items || items.length === 0) return null
            return (
              <Card key={key} className="p-4">
                <h4 className="mb-1 text-sm font-semibold">{label}</h4>
                <div>
                  {items.map((e, i) => (
                    <EvidenceRow key={`${key}-${i}`} e={e} />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
