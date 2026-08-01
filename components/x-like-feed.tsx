'use client'

import {
  Radar,
  Globe,
  AtSign,
  Image as ImageIcon,
  Bell,
  ShieldCheck,
  ShieldAlert,
  Landmark,
  LineChart,
  Gauge,
  Gavel,
  Network,
  Sparkles,
  Newspaper,
  Lightbulb,
  ScanSearch,
  Crosshair,
  Globe2,
  Search,
  ArrowRight,
  Activity,
  Microscope,
  MapPin,
  Boxes,
  Building2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n'

/**
 * Home — an intelligence feed (Twitter-like stream, analyst aesthetic). It is the
 * showcase of everything the platform now does: every live gateway, grouped by
 * family, plus the honest roadmap of what's coming. No fabricated content; each
 * card opens a real tool. Keeps the app's shadcn/Tailwind visual language.
 */

type NavTab = 'intelligence' | 'swarm' | 'ideas' | 'calibration' | 'globe' | 'preferences'

interface FeedItem {
  icon: LucideIcon
  title: string
  desc: string
  status: 'Live' | 'Planned'
  tab?: NavTab
  tag: string
}

interface Family {
  group: string
  blurb: string
  items: FeedItem[]
}

const FAMILIES: Family[] = [
  {
    group: 'Flagship',
    blurb: 'One query, the whole picture — fast.',
    items: [
      { icon: ScanSearch, title: 'Unified investigation (Nexus)', desc: 'Type anything — domain, IP, email, company, wallet, hash. We classify it and run every relevant gateway in parallel into one graded dossier with a link graph and AI triage. Instant, auditable.', status: 'Live', tab: 'intelligence', tag: 'nexus' },
      { icon: Crosshair, title: 'Live target tracking', desc: 'A radar per target: static identity kept apart from a live event stream (partnerships, filings, price, decisions) + published outlook + our correlation. Streamed over an always-open door — no polling.', status: 'Live', tab: 'intelligence', tag: 'track' },
    ],
  },
  {
    group: 'OSINT core',
    blurb: 'The founding discipline — public-footprint intelligence.',
    items: [
      { icon: Globe, title: 'Domain & infrastructure', desc: 'DNS, RDAP/WHOIS, CT-log subdomains, tech fingerprint, archive history, IP exposure.', status: 'Live', tab: 'intelligence', tag: 'domain' },
      { icon: AtSign, title: 'Email & username footprint', desc: 'Breach-exposure checks and public-profile presence across many platforms.', status: 'Live', tab: 'intelligence', tag: 'identity' },
      { icon: ImageIcon, title: 'Media verification', desc: 'Reverse-image links, EXIF/GPS metadata, AI-generation indicators — read locally.', status: 'Live', tab: 'intelligence', tag: 'media' },
    ],
  },
  {
    group: 'Threat & risk',
    blurb: 'Is this safe to deal with?',
    items: [
      { icon: ShieldAlert, title: 'Threat intelligence (CTI)', desc: 'Check an IP, domain, URL or hash against public threat feeds (abuse.ch).', status: 'Live', tab: 'intelligence', tag: 'threat' },
      { icon: Landmark, title: 'Financial / sanctions', desc: 'Sanctions/PEP + legal-entity screening (OpenSanctions, GLEIF) and Bitcoin ledger facts.', status: 'Live', tab: 'intelligence', tag: 'finance' },
    ],
  },
  {
    group: 'Money & power',
    blurb: 'Follow the assets, the money, and the control.',
    items: [
      { icon: Gauge, title: 'Markets board (live)', desc: 'Top prices at a glance — crypto, commodities & raw materials, stock indices and FX. Auto-refreshing, organized, from primary sources.', status: 'Live', tab: 'intelligence', tag: 'board' },
      { icon: LineChart, title: 'Markets & economy', desc: 'Single-asset deep dive: crypto, public company filings (SEC EDGAR) and ECB reference FX.', status: 'Live', tab: 'intelligence', tag: 'markets' },
      { icon: Gavel, title: 'Procurement & contracts', desc: 'Who receives public money — US federal awards and World Bank development finance.', status: 'Live', tab: 'intelligence', tag: 'contracts' },
      { icon: Network, title: 'Ownership & control', desc: 'Parents, ultimate parents and subsidiaries mapped into a control graph (GLEIF L2).', status: 'Live', tab: 'intelligence', tag: 'ownership' },
    ],
  },
  {
    group: 'Intelligence layer',
    blurb: 'On top of every gateway.',
    items: [
      { icon: Newspaper, title: 'News & signals', desc: 'Top world events and topic coverage from primary sources — live, non-stop, linking to origin. We surface and grade, we don’t reprint.', status: 'Live', tab: 'intelligence', tag: 'news' },
      { icon: Globe2, title: 'Live world map (3D globe)', desc: 'Where today’s top events are being reported, plotted on our own 3D globe. Drag to spin; the same globe maps any geolocated signal.', status: 'Live', tab: 'globe', tag: 'globe' },
      { icon: Sparkles, title: 'AI analyst', desc: 'Triages any report — summarizes, grades severity, suggests the next pivot. Sorts, never verifies.', status: 'Live', tab: 'intelligence', tag: 'ai' },
      { icon: Bell, title: 'Monitoring & radar', desc: 'Watch a subject and get alerted when its public footprint changes.', status: 'Live', tab: 'swarm', tag: 'radar' },
      { icon: Lightbulb, title: 'Ideas & feedback', desc: 'Send suggestions in any language. Each is AI-triaged and clustered so the most-wanted rise to the top — the community shapes the roadmap.', status: 'Live', tab: 'ideas', tag: 'ideas' },
    ],
  },
  {
    group: 'Coming online',
    blurb: 'Built the same way — passive, lawful, keyless-first. Roadmap, honestly labelled.',
    items: [
      { icon: MapPin, title: 'Geospatial & transport', desc: 'Geocode a place, reverse-geocode coordinates (OpenStreetMap), or read a live public flight state (OpenSky). Maritime + real-estate overlay next.', status: 'Live', tab: 'intelligence', tag: 'geo' },
      { icon: Microscope, title: 'Research & tech-trend', desc: 'The R&D frontier — papers and citations from open scholarship (OpenAlex, Crossref). Patents & trend signals next.', status: 'Live', tab: 'intelligence', tag: 'research' },
      { icon: Activity, title: 'Calibration scoreboard', desc: 'Track published forecasts vs outcomes — whose foresight proved right, including ours. Honest accuracy, by author and confidence.', status: 'Live', tab: 'calibration', tag: 'foresight' },
      { icon: Boxes, title: 'Supply-chain & trade', desc: 'Trade exposure and dependency mapping from public customs/trade data.', status: 'Planned', tag: 'trade' },
    ],
  },
]

function StatusChip({ status }: { status: FeedItem['status'] }) {
  return status === 'Live' ? (
    <Badge className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]" variant="outline">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Live
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      Planned
    </Badge>
  )
}

export function XLikeFeed({ onNavigate }: { onNavigate?: (tab: NavTab) => void }) {
  const t = useT()
  const liveCount = FAMILIES.flatMap((f) => f.items).filter((i) => i.status === 'Live').length

  return (
    <div className="space-y-4">
      {/* Identity / hero */}
      <Card className="overflow-hidden">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
          <div className="flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Lambda NX</h1>
            <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
              {liveCount} live gateways
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            One engine, many gateways. Every result is built from public, lawful sources and
            carries its source, timestamp and a confidence grade — analysis, not guesswork.
            Runs inside Pi Network and as a standalone app.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Passive — never touches a target
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Public data · robots &amp; rate limits respected
            </span>
          </div>
        </div>

        {/* Compose / search — Twitter's prompt, for intelligence */}
        <button
          onClick={() => onNavigate?.('intelligence')}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Search className="h-4 w-4 text-primary" />
          </span>
          <span className="flex-1">
            <span className="block text-sm text-foreground">{t('feed.hero.title')}</span>
            <span className="block text-[11px] text-muted-foreground">{t('feed.hero.sub')}</span>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {t('feed.open')} <ArrowRight className="h-3 w-3" />
          </span>
        </button>
      </Card>

      {/* Feed — families of gateways */}
      {FAMILIES.map((family) => (
        <section key={family.group} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold tracking-tight">{family.group}</h2>
            <span className="text-[11px] text-muted-foreground">{family.blurb}</span>
          </div>
          <div className="grid gap-2">
            {family.items.map((item) => {
              const Icon = item.icon
              const clickable = Boolean(item.tab)
              return (
                <Card
                  key={item.title}
                  onClick={clickable ? () => onNavigate?.(item.tab!) : undefined}
                  className={`group p-4 transition-colors ${
                    clickable ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30' : 'opacity-95'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold leading-tight">{item.title}</h3>
                        <StatusChip status={item.status} />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground/70">#{item.tag}</span>
                        {clickable ? (
                          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            Open <ArrowRight className="h-3 w-3" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      ))}

      <p className="px-1 pt-1 text-center text-[11px] text-muted-foreground">
        The AI analyst sorts evidence — it never verifies for you. Every finding is auditable
        to its source.
      </p>
    </div>
  )
}
