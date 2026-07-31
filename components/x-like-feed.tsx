'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Radar, Globe, AtSign, Image, Bell, ShieldCheck, ShieldAlert, Landmark, LineChart, Gavel, Network, Sparkles } from 'lucide-react'

/**
 * Home screen. The previous version rendered a fabricated social feed
 * (hardcoded fake posts). Removed per charter rule #1. This is honest product
 * content — a description and the real module roadmap with live status.
 */

const modules = [
  {
    icon: Globe,
    title: 'Domain & Infrastructure',
    desc: 'DNS, RDAP/WHOIS, certificate-transparency subdomains, tech fingerprint, archive history, IP exposure.',
    status: 'Ready',
  },
  {
    icon: AtSign,
    title: 'Email & Username footprint',
    desc: 'Breach-exposure checks and public-profile presence across many platforms.',
    status: 'Ready',
  },
  {
    icon: ShieldAlert,
    title: 'Threat intelligence (CTI)',
    desc: 'Check an IP, domain, URL or hash against public threat feeds (abuse.ch).',
    status: 'Ready',
  },
  {
    icon: Landmark,
    title: 'Financial / sanctions',
    desc: 'Sanctions/PEP + legal-entity screening (OpenSanctions, GLEIF) and Bitcoin ledger facts.',
    status: 'Ready',
  },
  {
    icon: LineChart,
    title: 'Markets & economy',
    desc: 'Live crypto markets (CoinGecko), public company filings (SEC EDGAR) and ECB reference FX — facts with source and time. It reports the market, it never predicts it.',
    status: 'Ready',
  },
  {
    icon: Gavel,
    title: 'Procurement & contracts',
    desc: 'Who receives public money and contracts — US federal awards (USAspending) and World Bank development finance, from official published records.',
    status: 'Ready',
  },
  {
    icon: Network,
    title: 'Ownership & control',
    desc: 'Who owns and controls a company — parents, ultimate parents and subsidiaries mapped into a control graph from GLEIF Level-2 filed relationships.',
    status: 'Ready',
  },
  {
    icon: Image,
    title: 'Media verification',
    desc: 'Reverse-image links, EXIF metadata, AI-generated-content indicators.',
    status: 'Ready',
  },
  {
    icon: Bell,
    title: 'Monitoring & alerts',
    desc: 'Watch a domain and get alerted when its public footprint changes.',
    status: 'Ready',
  },
  {
    icon: Sparkles,
    title: 'AI analyst',
    desc: 'Triages any report — summarizes, grades severity, suggests the next pivot. It sorts the evidence, it never verifies for you.',
    status: 'Ready',
  },
]

function statusVariant(status: string) {
  return status === 'Ready' ? 'default' : 'secondary'
}

export function XLikeFeed() {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Lambda NX</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A real, legal open-source-intelligence platform. Every result is built from
          public, lawful sources and carries its source link, timestamp and a confidence
          grade — analysis, not guesswork. It runs inside Pi Network and as a standalone app.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-green-500" />
          Passive only — never touches a target. Public data, respecting robots.txt and rate limits.
        </div>
      </Card>

      <div className="grid gap-3">
        {modules.map((m) => (
          <Card key={m.title} className="p-4">
            <div className="flex items-start gap-3">
              <m.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{m.title}</h3>
                  <Badge variant={statusVariant(m.status)} className="text-xs">
                    {m.status}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
