/**
 * US national airspace status — ground stops, ground delays and closures.
 *
 * ## Why this is a coded source and not a catalogue record
 *
 * It was a catalogue record, declaring `kind: 'json'`. The endpoint answers
 * XML, and has for years: `<AIRPORT_STATUS_INFORMATION>`, not RSS, not Atom,
 * not GeoJSON — a bespoke document with a DTD from `fly.faa.gov`. So every
 * sweep failed with *"Unexpected token '<'"* and the whole aviation topic was
 * silently absent from the board. The declarative adapter reads four shapes it
 * knows; a fifth shape needs code, and pretending otherwise is how a catalogue
 * accumulates records that have never once returned a finding.
 *
 * ## Why this signal is worth the code
 *
 * Air-traffic disruption is a leading indicator that reads across disciplines:
 * severe weather before it makes the news, volcanic ash, infrastructure
 * failure, security incidents. None of the platforms surveyed in
 * `docs/COMPETITORS.md` carry it keylessly. It is published by the authority
 * that issues the orders, so it grades A/1 — not a report of a delay, the delay
 * itself.
 *
 * ## Why nothing here carries a coordinate
 *
 * The feed names airports by IATA code and nothing else. Turning `DEN` into a
 * point needs an airport dataset we do not have, and writing coordinates from
 * memory would put a ground stop in the wrong place while looking entirely
 * confident — the exact failure mode the charter forbids. These are therefore
 * country-level findings, resolved to the United States, exactly as WHO
 * outbreak reports are. Airport-level precision waits for a real dataset.
 *
 * Passive, keyless, read-only.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { publicationTime } from '../observed'

/** First `<Tag>…</Tag>` body in a fragment, unescaped and trimmed. */
function tag(fragment: string, name: string): string | null {
  const m = fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return null
  const text = m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0 ? text : null
}

/** Every `<Tag>…</Tag>` block in a fragment, as raw fragments. */
function blocks(fragment: string, name: string): string[] {
  return fragment.match(new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, 'gi')) ?? []
}

/**
 * The four programme types, each with the severity the FAA's own action
 * implies.
 *
 * These are not severities we invented for display: a ground stop means no
 * aircraft may depart for that airport, a closure means the field is shut.
 * They are ordered by what the authority has actually done, which is the only
 * severity scale we are entitled to use.
 */
interface Programme {
  /** The `<Name>` the FAA gives the delay type. */
  name: string
  /** The element holding one airport's entry inside that type. */
  item: string
  severity: number
  label: string
}

const PROGRAMMES: Programme[] = [
  { name: 'Airport Closures', item: 'Airport', severity: 1, label: 'Airport closure' },
  { name: 'Ground Stop Programs', item: 'Program', severity: 0.9, label: 'Ground stop' },
  { name: 'Ground Delay Programs', item: 'Ground_Delay', severity: 0.6, label: 'Ground delay' },
  {
    name: 'General Arrival/Departure Delay Info',
    item: 'Delay',
    severity: 0.4,
    label: 'Arrival/departure delay',
  },
]

/**
 * The FAA stamps the document, not the individual programmes.
 *
 * A document time is a real publication time for every programme in it: the
 * FAA republishes the whole picture on each update, so nothing in the document
 * is older than the stamp.
 *
 * `Fri Aug 14 23:58:22 2026 GMT` happens to be readable by V8 as-is, but only
 * because the zone is spelled out. The FAA has published this stamp without a
 * zone, and a zoneless date is read as *local* time — which would silently
 * shift every timestamp by the host's offset, differently on a laptop and on
 * the deployed server. Normalising into RFC-822 order with an explicit GMT
 * makes the assumption the same everywhere and states it in one place.
 */
export function faaUpdateTime(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\d{4})\s*(\w+)?$/)
  if (!m) return publicationTime(raw)
  const [, mon, day, time, year, zone] = m
  return publicationTime(`${day} ${mon} ${year} ${time} ${zone ?? 'GMT'}`)
}

/** One programme entry as a sentence a reader can act on. */
function describe(programme: Programme, item: string, airport: string): string {
  const reason = tag(item, 'Reason')
  const parts = [`${airport} — ${programme.label}`]

  // Ground delays publish an average and a maximum; arrival/departure delays
  // publish a range and a trend. Both are quoted rather than reduced to one
  // number, because "up to three hours and rising" is the operationally useful
  // half and an average alone hides it.
  const avg = tag(item, 'Avg')
  const max = tag(item, 'Max')
  const min = tag(item, 'Min')
  const trend = tag(item, 'Trend')
  if (avg) parts.push(`avg ${avg}`)
  else if (min) parts.push(`${min}–${max ?? 'unknown'}`)
  if (max && avg) parts.push(`max ${max}`)
  if (trend) parts.push(trend.toLowerCase())

  const reopen = tag(item, 'Reopen')
  if (reopen) parts.push(`reopens ${reopen}`)

  // Closure reasons are raw NOTAM text — useful, but only the first clause
  // reads as a sentence, and the rest is airfield shorthand.
  if (reason) parts.push(reason.length > 120 ? `${reason.slice(0, 117)}…` : reason)

  return parts.join(' · ')
}

export const faaAirspaceStatus: Source = {
  key: 'faa_nasstatus',
  capability: 'world_events',
  passive: true,
  hosts: ['nasstatus.faa.gov'],
  minIntervalMs: 900_000,
  async run(_input: SourceInput, ctx: SourceContext) {
    const res = await ctx.fetch('https://nasstatus.faa.gov/api/airport-status-information', {
      headers: {
        'User-Agent': 'LambdaNX/1.0 (+https://github.com/algb20/Lambda-Nx1)',
        Accept: 'application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    })
    if (!res.ok) throw new Error(`faa_nasstatus: provider answered ${res.status}`)
    const xml = await res.text()

    const retrievedAt = new Date().toISOString()
    const publishedAt = faaUpdateTime(tag(xml, 'Update_Time'))
    const out: Evidence[] = []
    const seen = new Set<string>()

    for (const section of blocks(xml, 'Delay_type')) {
      const name = tag(section, 'Name')
      const programme = PROGRAMMES.find((p) => p.name === name)
      if (!programme) continue

      for (const item of blocks(section, programme.item)) {
        const airport = tag(item, 'ARPT')
        if (!airport) continue

        const claim = describe(programme, item, airport)
        // The FAA repeats `<Delay_type>Airport Closures</Delay_type>` once per
        // closed field rather than listing them in one block, so the same entry
        // can be reached twice. Two identical findings would read as two
        // independent confirmations of one closure, which is precisely the
        // inflation the fusion layer exists to prevent.
        if (seen.has(claim)) continue
        seen.add(claim)

        out.push({
          claim,
          entity: { type: 'other', value: airport },
          sourceKey: 'faa_nasstatus',
          sourceUrl: 'https://nasstatus.faa.gov/',
          retrievedAt,
          publishedAt,
          // The authority that issues the order, reporting its own action.
          admiralty: { source: 'A', info: 1 },
          confidence: 'confirmed',
          data: {
            category: 'manmade',
            categoryLabel: programme.label,
            country: 'United States of America',
            assignedSeverity: programme.severity,
            airport,
            topics: ['aviation'],
            independence: 'faa',
            kind: 'world_event',
          },
        })
      }
    }
    return out
  },
}
