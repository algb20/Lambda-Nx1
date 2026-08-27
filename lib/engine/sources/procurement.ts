/**
 * Procurement & public-contracts sources — passive, keyless, public money trails.
 *
 * "Who receives public money, and for what?" is a core intelligence question
 * (the lawful, public-data version of what heavyweight platforms do). We read
 * only official, published award/contract records:
 *   - USAspending.gov : US federal awards/contracts by recipient (POST API).
 *   - World Bank       : development project financing by name/country.
 *
 * Every fact is an official published record with its source and timestamp.
 */
import type { Evidence, Source } from '../types'
import { expectOk } from '../fetch-guard'

function fmtUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

// ── USAspending (capability: procurement — US federal awards) ────────────────
interface UsaAward {
  'Award ID'?: string
  'Recipient Name'?: string
  'Award Amount'?: number
  'Awarding Agency'?: string
  'Period of Performance Start Date'?: string
}
interface UsaResponse {
  results?: UsaAward[]
}

export const usaspending: Source = {
  key: 'usaspending',
  capability: 'procurement',
  passive: true,
  hosts: ['api.usaspending.gov'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 3) return []
    const body = {
      filters: { keywords: [q], award_type_codes: ['A', 'B', 'C', 'D'] },
      fields: [
        'Award ID',
        'Recipient Name',
        'Award Amount',
        'Awarding Agency',
        'Period of Performance Start Date',
      ],
      page: 1,
      limit: 5,
      sort: 'Award Amount',
      order: 'desc',
    }
    const res = await ctx.fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expectOk('usaspending', res)
    const j = (await res.json().catch(() => null)) as UsaResponse | null
    const results = j?.results ?? []
    return results.slice(0, 5).map<Evidence>((r) => {
      const recipient = r['Recipient Name'] ?? q
      const amount = typeof r['Award Amount'] === 'number' ? r['Award Amount'] : null
      const agency = r['Awarding Agency'] ?? ''
      const awardId = r['Award ID'] ?? ''
      const start = r['Period of Performance Start Date'] ?? ''
      return {
        claim:
          `US federal award — ${recipient}` +
          (amount !== null ? `: ${fmtUsd(amount)}` : '') +
          (agency ? ` from ${agency}` : '') +
          (start ? ` (from ${start})` : ''),
        entity: { type: 'company', value: recipient },
        sourceKey: 'usaspending',
        sourceUrl: awardId
          ? `https://www.usaspending.gov/award/${encodeURIComponent(awardId)}`
          : 'https://www.usaspending.gov',
        retrievedAt: new Date().toISOString(),
        admiralty: { source: 'A', info: 1 },
        confidence: 'confirmed',
        data: { recipient, amount, agency, awardId, start },
      }
    })
  },
}

// ── World Bank projects (capability: procurement — development finance) ───────
interface WbProject {
  id?: string
  project_name?: string
  countryshortname?: string
  totalcommamt?: number | string
  boardapprovaldate?: string
  status?: string
}
interface WbResponse {
  projects?: Record<string, WbProject>
}

function toAmount(v: number | string | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

export const worldbankProjects: Source = {
  key: 'worldbank_projects',
  capability: 'procurement',
  passive: true,
  hosts: ['search.worldbank.org'],
  minIntervalMs: 1000,
  async run(input, ctx) {
    const q = input.value.trim()
    if (q.length < 3) return []
    const url = `https://search.worldbank.org/api/v2/projects?format=json&rows=5&qterm=${encodeURIComponent(q)}`
    const res = await ctx.fetch(url)
    expectOk('worldbank_projects', res)
    const j = (await res.json().catch(() => null)) as WbResponse | null
    const projects = j?.projects ? Object.values(j.projects) : []
    return projects
      .filter((p) => p.project_name)
      .slice(0, 5)
      .map<Evidence>((p) => {
        const amount = toAmount(p.totalcommamt)
        const country = p.countryshortname ?? ''
        const date = p.boardapprovaldate ? p.boardapprovaldate.slice(0, 10) : ''
        return {
          claim:
            `World Bank project — ${p.project_name}` +
            (country ? ` [${country}]` : '') +
            (amount !== null ? `: ${fmtUsd(amount)} committed` : '') +
            (date ? ` (approved ${date})` : ''),
          entity: { type: 'organization', value: p.project_name! },
          sourceKey: 'worldbank_projects',
          sourceUrl: p.id
            ? `https://projects.worldbank.org/en/projects-operations/project-detail/${p.id}`
            : 'https://projects.worldbank.org',
          retrievedAt: new Date().toISOString(),
          admiralty: { source: 'A', info: 2 },
          confidence: 'probable',
          data: { id: p.id, name: p.project_name, country, amount, date, status: p.status },
        }
      })
  },
}
