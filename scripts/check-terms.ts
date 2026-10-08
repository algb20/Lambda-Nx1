/**
 * Re-read every quoted licence clause in the registry and report what changed
 * (GL-06, R323).
 *
 * For each registry record, each quote is checked against the page it was
 * quoted from (see lib/engine/licensing/terms-check.ts for the states). Each
 * page is fetched once, read-only, with a few requests in flight at a time.
 *
 * It changes nothing. A record whose quotes went `missing` is a candidate for
 * EXPIRED_OR_CHANGED; a person re-reads the page and decides, as the licence
 * rules require (R317). The report is written to
 * docs/reconciliation/TERMS_CHECK_<date>.json.
 *
 * Usage:  npx tsx scripts/check-terms.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SOURCE_LICENSE_REGISTRY } from '../lib/engine/licensing/registry'
import { checkEvidence, htmlToText, recordState, type QuoteState } from '../lib/engine/licensing/terms-check'

const CONCURRENCY = 6
const TIMEOUT_MS = 25_000
const USER_AGENT = `LambdaNX-terms-check/1.0 (+${process.env.ENGINE_CONTACT ?? 'licence review'})`

type Page = { status: number | 'error'; text: string; error?: string }

async function fetchPage(url: string): Promise<Page> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    })
    const type = res.headers.get('content-type') ?? ''
    // A PDF or other binary licence text cannot be compared as page text.
    if (res.ok && !/html|text|xml|json/.test(type)) return { status: 'error', text: '', error: `unreadable content-type ${type}` }
    const body = await res.text()
    return { status: res.status, text: res.ok ? htmlToText(body) : '' }
  } catch (e) {
    return { status: 'error', text: '', error: String(e).slice(0, 160) }
  }
}

async function main() {
  const urls = [
    ...new Set(SOURCE_LICENSE_REGISTRY.flatMap((r) => r.evidence_reference.map((e) => e.url)).filter((u) => /^https?:\/\//.test(u))),
  ]
  const pages = new Map<string, Page>()
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < urls.length) {
        const url = urls[next++]
        pages.set(url, await fetchPage(url))
      }
    }),
  )

  const records = SOURCE_LICENSE_REGISTRY.map((r) => {
    const quotes = r.evidence_reference.map((e) => {
      const page = pages.get(e.url)
      const state: QuoteState | 'unreachable' =
        !page ? 'not-checkable' : page.status !== 200 ? 'unreachable' : checkEvidence(page.text, e)
      return { url: e.url, read_at: e.read_at, state, http: page?.status ?? null }
    })
    const checkable = quotes.filter((q) => q.state !== 'unreachable').map((q) => q.state as QuoteState)
    const state = checkable.length === 0 ? (quotes.length ? 'unreachable' : 'not-checkable') : recordState(checkable)
    return { source_id: r.source_id, license_status: r.license_status, state, quotes }
  })

  const counts = records.reduce<Record<string, number>>((acc, r) => ((acc[r.state] = (acc[r.state] ?? 0) + 1), acc), {})
  const day = new Date().toISOString().slice(0, 10)
  const report = {
    checked_at: new Date().toISOString(),
    pages: urls.length,
    counts,
    changed: records.filter((r) => r.state === 'missing' || r.state === 'partial'),
    records,
  }
  const out = join(process.cwd(), `docs/reconciliation/TERMS_CHECK_${day}.json`)
  writeFileSync(out, JSON.stringify(report, null, 1) + '\n')
  console.log(`terms check: ${urls.length} pages, ${records.length} records`, counts)
  for (const r of report.changed) console.log(`  ${r.state.padEnd(8)} ${r.source_id} (${r.license_status})`)
  console.log(`→ ${out}`)
}

main()
