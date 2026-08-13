/**
 * The dossier — turning findings into a document someone else can check.
 *
 * The charter says the product's value is "pivoting, verification, confidence
 * grading and **documentation**". Everything up to here produced the first
 * three; the findings then lived inside a browser tab and died with it. An
 * analyst who cannot hand the work to a colleague, a lawyer or a court has not
 * finished the work.
 *
 * So a dossier is built around one rule: **every claim points back to who said
 * it and when.** Findings are numbered against a de-duplicated reference list,
 * exactly as a paper does — forty findings from six sources produce six
 * references, not forty — and the whole set carries the deterministic seal from
 * the Trust Lens, so any later change to the content is detectable.
 *
 * Five renderings, one model:
 *
 *  - **JSON** — the complete record, for another system.
 *  - **CSV** — one row per finding, for a spreadsheet.
 *  - **Markdown** — the readable report.
 *  - **Citations** — a numbered reference list or BibTeX, for anyone writing
 *    this up somewhere else.
 *  - **Printable HTML** — the page a browser prints to PDF.
 *
 * On that last one: we do not write PDF bytes ourselves. This product is
 * bilingual, and Arabic needs contextual letter shaping, bidirectional layout
 * and an embedded font — a hand-rolled PDF writer silently mangles all three and
 * produces a document that looks fine in review and is garbage to a reader. The
 * browser's print engine already does it correctly, on every platform, with the
 * user's own fonts. Handing it a well-built page is the better engineering, not
 * the lazier one.
 *
 * Pure functions over a plain model, so every rendering is testable without a
 * network, a database or a browser.
 */
import { assessTrust, sealFindings, type TrustScore } from '@/lib/engine/trust'
import type { Evidence } from '@/lib/engine/types'

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'citations' | 'bibtex' | 'html'

export interface DossierInput {
  /** What was investigated — a domain, an email, a company. */
  subject: string
  /** Which gateway produced it, e.g. "Domain & infrastructure". */
  kind: string
  evidence: Evidence[]
  /** ISO timestamp; defaults to now. */
  generatedAt?: string
  /** The analyst's own note, if they wrote one. Never invented. */
  note?: string | null
  /** Who is exporting, for the document header. */
  author?: string | null
}

/** One source, cited once however many findings came from it. */
export interface Reference {
  /** 1-based citation number, stable for this dossier. */
  n: number
  sourceKey: string
  url: string | null
  /** Earliest retrieval time we saw for this source. */
  retrievedAt: string
  /** How many findings cite it. */
  findings: number
}

export interface DossierFinding {
  claim: string
  entity: string | null
  sourceKey: string
  /** Citation number into `references`. */
  reference: number
  retrievedAt: string
  /** e.g. "A2", or null when the source carried no rating. */
  admiralty: string | null
  confidence: string
}

export interface Dossier {
  subject: string
  kind: string
  generatedAt: string
  author: string | null
  note: string | null
  /** Tamper-evident fingerprint of the findings. */
  seal: string
  trust: TrustScore
  findings: DossierFinding[]
  references: Reference[]
}

/** The product name that appears on every exported document. */
export const PLATFORM = 'Lambda'

/** Refuse to build a document out of nothing, rather than emit an empty one. */
export class EmptyDossierError extends Error {
  constructor() {
    super('A dossier needs at least one finding')
    this.name = 'EmptyDossierError'
  }
}

const entityOf = (e: Evidence): string | null =>
  e.entity ? `${e.entity.type}:${e.entity.value}` : null

const admiraltyOf = (e: Evidence): string | null =>
  e.admiralty ? `${e.admiralty.source}${e.admiralty.info}` : null

/**
 * Build the model. The reference list is the interesting part: findings are
 * keyed to `source + url`, because the same source can legitimately cite several
 * pages, and two sources can never share one reference number.
 */
export function buildDossier(input: DossierInput): Dossier {
  if (input.evidence.length === 0) throw new EmptyDossierError()

  const refs = new Map<string, Reference>()
  const findings: DossierFinding[] = []

  for (const e of input.evidence) {
    // Sanitise once, here, rather than in each rendering. A `javascript:` URL
    // arriving from a provider is a hazard in every container it reaches — a
    // clickable spreadsheet cell, a `\url{}` in a LaTeX bibliography, an anchor
    // in the printed page — and a renderer that forgets is a renderer that
    // ships it. The model refuses it, so none of them can.
    const url = safeHref(e.sourceUrl?.trim() || null)
    const key = `${e.sourceKey}|${url ?? ''}`
    let ref = refs.get(key)
    if (!ref) {
      ref = {
        n: refs.size + 1,
        sourceKey: e.sourceKey,
        url,
        retrievedAt: e.retrievedAt,
        findings: 0,
      }
      refs.set(key, ref)
    }
    ref.findings += 1
    // Cite the earliest retrieval, which is when the claim was actually seen.
    if (e.retrievedAt < ref.retrievedAt) ref.retrievedAt = e.retrievedAt

    findings.push({
      claim: e.claim,
      entity: entityOf(e),
      sourceKey: e.sourceKey,
      reference: ref.n,
      retrievedAt: e.retrievedAt,
      admiralty: admiraltyOf(e),
      confidence: e.confidence,
    })
  }

  return {
    subject: input.subject,
    kind: input.kind,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    author: input.author?.trim() || null,
    note: input.note?.trim() || null,
    seal: sealFindings(input.evidence),
    trust: assessTrust(input.evidence),
    findings,
    references: [...refs.values()],
  }
}

/**
 * A filename that survives every operating system and sorts by date.
 *
 * The subject is attacker-influenced — it is whatever was typed into the search
 * box — and it ends up in a `Content-Disposition` header, so it is sanitised
 * rather than trusted. A dot is allowed because domains contain them, but runs
 * of dots collapse and leading dots are stripped: `../../etc/passwd` must not
 * survive as anything path-shaped, and a name starting with `.` is hidden on
 * Unix, which is a poor thing to hand someone as a download.
 */
export function dossierFilename(d: Dossier, format: ExportFormat): string {
  const ext = format === 'citations' ? 'txt' : format === 'bibtex' ? 'bib' : format
  const safeSubject =
    d.subject
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 48)
      .replace(/^[.-]+|[.-]+$/g, '') || 'dossier'
  return `lambda-${safeSubject}-${d.generatedAt.slice(0, 10)}.${ext}`
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/**
 * A spreadsheet treats a leading `=`, `+`, `-` or `@` as the start of a formula,
 * so a claim beginning with one becomes executable content in the reader's
 * machine. Prefixing an apostrophe neutralises it while keeping the text
 * readable — the standard mitigation, and not optional when the text came from
 * a third party we do not control.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  // RFC 4180: quote when the field contains a delimiter, quote or line break.
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

const CSV_COLUMNS = [
  'claim',
  'entity',
  'source',
  'reference',
  'source_url',
  'retrieved_at',
  'admiralty',
  'confidence',
] as const

export function toCsv(d: Dossier): string {
  const urlOf = (n: number) => d.references.find((r) => r.n === n)?.url ?? ''
  const rows = [
    CSV_COLUMNS.join(','),
    ...d.findings.map((f) =>
      [
        f.claim,
        f.entity ?? '',
        f.sourceKey,
        f.reference,
        urlOf(f.reference),
        f.retrievedAt,
        f.admiralty ?? '',
        f.confidence,
      ]
        .map(csvCell)
        .join(','),
    ),
  ]
  // CRLF is what RFC 4180 specifies and what Excel expects.
  return `${rows.join('\r\n')}\r\n`
}

// ── JSON ─────────────────────────────────────────────────────────────────────

export function toJson(d: Dossier): string {
  return `${JSON.stringify({ platform: PLATFORM, ...d }, null, 2)}\n`
}

// ── Citations ────────────────────────────────────────────────────────────────

const isoDay = (iso: string): string => iso.slice(0, 10)

/**
 * A numbered reference list in the form used for online sources: who, what,
 * where, and — the part that matters for OSINT — *when it was retrieved*, since
 * the page may not say the same thing tomorrow.
 */
export function toCitations(d: Dossier): string {
  const lines = d.references.map((r) => {
    const parts = [`[${r.n}] ${r.sourceKey}.`, `"${d.subject}" (${d.kind}).`]
    if (r.url) parts.push(r.url)
    parts.push(`Retrieved ${isoDay(r.retrievedAt)}.`)
    return parts.join(' ')
  })
  return [
    `References — ${d.subject}`,
    `Collected by ${PLATFORM} on ${isoDay(d.generatedAt)}. Seal ${d.seal}.`,
    '',
    ...lines,
    '',
  ].join('\n')
}

/** A BibTeX key that is unique within the document and legal in the format. */
export function bibKey(d: Dossier, r: Reference): string {
  const stem = `${r.sourceKey}-${d.subject}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40)
  return `lambda${stem}${r.n}`
}

/** BibTeX reserves these; leaving them raw produces a file that will not parse. */
export function bibEscape(value: string): string {
  return value.replace(/([{}$&%#_])/g, '\\$1')
}

export function toBibtex(d: Dossier): string {
  return `${d.references
    .map((r) =>
      [
        `@misc{${bibKey(d, r)},`,
        `  title        = {${bibEscape(d.subject)} — ${bibEscape(d.kind)}},`,
        `  author       = {${bibEscape(r.sourceKey)}},`,
        `  year         = {${d.generatedAt.slice(0, 4)}},`,
        r.url ? `  howpublished = {\\url{${bibEscape(r.url)}}},` : null,
        `  note         = {Retrieved ${isoDay(r.retrievedAt)} via ${PLATFORM}; seal ${d.seal}},`,
        '}',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')}\n`
}

// ── Markdown ─────────────────────────────────────────────────────────────────

/** A pipe inside a cell ends the cell, so it has to be escaped in a table. */
const mdCell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ')

export function toMarkdown(d: Dossier): string {
  const out: string[] = [
    `# ${d.subject}`,
    '',
    `**${d.kind}** · collected by ${PLATFORM} on ${isoDay(d.generatedAt)}${
      d.author ? ` · ${d.author}` : ''
    }`,
    '',
    '## Assessment',
    '',
    `- Findings: ${d.trust.evidenceCount}`,
    `- Independent sources: ${d.trust.independentSources} (${d.trust.reliableSources} rated A/B)`,
    `- Corroboration: ${d.trust.corroboration} — ${d.trust.corroboratedTopics} topic(s) backed by two or more sources`,
    `- Neutrality: ${d.trust.neutrality}/100`,
    `- Overall confidence: ${d.trust.confidence}`,
    `- Seal: \`${d.seal}\``,
    '',
  ]

  if (d.note) out.push('## Analyst note', '', d.note, '')

  out.push(
    '## Findings',
    '',
    '| # | Finding | Entity | Grade | Confidence | Source |',
    '|---|---|---|---|---|---|',
    ...d.findings.map(
      (f, i) =>
        `| ${i + 1} | ${mdCell(f.claim)} | ${mdCell(f.entity ?? '—')} | ${
          f.admiralty ?? '—'
        } | ${f.confidence} | [${f.reference}] |`,
    ),
    '',
    '## References',
    '',
    ...d.references.map(
      (r) =>
        `${r.n}. **${r.sourceKey}** — ${r.url ? `<${r.url}>` : 'no public URL'} — retrieved ${isoDay(
          r.retrievedAt,
        )} (${r.findings} finding${r.findings === 1 ? '' : 's'})`,
    ),
    '',
    '---',
    '',
    `Collected passively from public sources by ${PLATFORM}. Every finding above carries the source that reported it and the time it was retrieved; nothing is inferred beyond what those sources said. The seal is a fingerprint of the findings — recompute it to prove this document is unaltered.`,
    '',
  )
  return out.join('\n')
}

// ── Printable HTML ───────────────────────────────────────────────────────────

/**
 * Escape before interpolation, always. Claims and URLs come from third-party
 * providers, and this document is opened in a browser — an unescaped `<script>`
 * in a claim would execute in the reader's page.
 */
export function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Only http(s) links are rendered as links. A `javascript:` URL arriving in a
 * source's payload must never become a clickable anchor in a document we hand
 * to someone.
 */
export function safeHref(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

/** Arabic, Hebrew, Persian — the document direction follows its content. */
export function dominantDirection(text: string): 'rtl' | 'ltr' {
  const rtl = (text.match(/[֐-׿؀-ۿ܀-ݏ]/g) ?? []).length
  const ltr = (text.match(/[A-Za-z]/g) ?? []).length
  return rtl > ltr ? 'rtl' : 'ltr'
}

export function toPrintableHtml(d: Dossier): string {
  const dir = dominantDirection(`${d.subject} ${d.note ?? ''} ${d.findings.map((f) => f.claim).join(' ')}`)
  const e = htmlEscape

  const link = (url: string | null) => {
    const href = safeHref(url)
    return href ? `<a href="${e(href)}">${e(href)}</a>` : '<span class="muted">no public URL</span>'
  }

  return `<!doctype html>
<html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}">
<meta charset="utf-8">
<title>${e(d.subject)} — ${e(PLATFORM)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /* Print first: this page exists to become a PDF. */
  @page { size: A4; margin: 18mm 16mm; }
  :root { --ink:#0f172a; --muted:#64748b; --line:#cbd5e1; --accent:#15803d; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; color: var(--ink); background: #fff;
    font: 13px/1.55 ui-sans-serif, system-ui, "Segoe UI", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, sans-serif;
  }
  .sheet { max-width: 900px; margin: 0 auto; }
  header { border-bottom: 2px solid var(--accent); padding-bottom: 10px; margin-bottom: 18px; }
  h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
  .kind { color: var(--muted); font-size: 12px; }
  h2 { font-size: 14px; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
  dl.assess { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; }
  dl.assess dt { color: var(--muted); }
  dl.assess dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: start; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  td.n, td.grade { white-space: nowrap; font-variant-numeric: tabular-nums; }
  ol.refs { padding-inline-start: 20px; font-size: 12px; }
  ol.refs li { margin-bottom: 5px; }
  a { color: var(--accent); word-break: break-all; }
  .muted { color: var(--muted); }
  .note { border-inline-start: 3px solid var(--line); padding-inline-start: 12px; }
  .seal { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
  /* Rows must not be split across a page break, or a claim loses its citation. */
  tr, li { break-inside: avoid; }
  thead { display: table-header-group; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
<div class="sheet">
<header>
  <h1>${e(d.subject)}</h1>
  <div class="kind">${e(d.kind)} · collected by ${e(PLATFORM)} on ${e(isoDay(d.generatedAt))}${
    d.author ? ` · ${e(d.author)}` : ''
  }</div>
</header>

<h2>Assessment</h2>
<dl class="assess">
  <dt>Findings</dt><dd>${d.trust.evidenceCount}</dd>
  <dt>Independent sources</dt><dd>${d.trust.independentSources} <span class="muted">(${
    d.trust.reliableSources
  } rated A/B)</span></dd>
  <dt>Corroboration</dt><dd>${e(d.trust.corroboration)} <span class="muted">— ${
    d.trust.corroboratedTopics
  } topic(s) backed by two or more sources</span></dd>
  <dt>Neutrality</dt><dd>${d.trust.neutrality}/100</dd>
  <dt>Confidence</dt><dd>${e(d.trust.confidence)}</dd>
  <dt>Seal</dt><dd class="seal">${e(d.seal)}</dd>
</dl>
${d.note ? `<h2>Analyst note</h2><p class="note">${e(d.note)}</p>` : ''}

<h2>Findings</h2>
<table>
  <thead><tr><th>#</th><th>Finding</th><th>Entity</th><th>Grade</th><th>Confidence</th><th>Ref</th></tr></thead>
  <tbody>
${d.findings
  .map(
    (f, i) => `    <tr>
      <td class="n">${i + 1}</td>
      <td>${e(f.claim)}</td>
      <td class="muted">${e(f.entity ?? '—')}</td>
      <td class="grade">${e(f.admiralty ?? '—')}</td>
      <td class="grade">${e(f.confidence)}</td>
      <td class="n">[${f.reference}]</td>
    </tr>`,
  )
  .join('\n')}
  </tbody>
</table>

<h2>References</h2>
<ol class="refs">
${d.references
  .map(
    (r) =>
      `  <li><strong>${e(r.sourceKey)}</strong> — ${link(r.url)} — retrieved ${e(
        isoDay(r.retrievedAt),
      )} <span class="muted">(${r.findings} finding${r.findings === 1 ? '' : 's'})</span></li>`,
  )
  .join('\n')}
</ol>

<footer>
  Collected passively from public sources by ${e(PLATFORM)}. Every finding carries the source that
  reported it and the time it was retrieved; nothing is inferred beyond what those sources said.
  The seal <span class="seal">${e(d.seal)}</span> is a fingerprint of the findings — recompute it to
  prove this document is unaltered.
</footer>
</div>
</html>
`
}

// ── One entry point ──────────────────────────────────────────────────────────

export interface RenderedDossier {
  body: string
  contentType: string
  filename: string
}

export function renderDossier(d: Dossier, format: ExportFormat): RenderedDossier {
  const filename = dossierFilename(d, format)
  switch (format) {
    case 'json':
      return { body: toJson(d), contentType: 'application/json; charset=utf-8', filename }
    case 'csv':
      return { body: toCsv(d), contentType: 'text/csv; charset=utf-8', filename }
    case 'markdown':
      return { body: toMarkdown(d), contentType: 'text/markdown; charset=utf-8', filename }
    case 'citations':
      return { body: toCitations(d), contentType: 'text/plain; charset=utf-8', filename }
    case 'bibtex':
      return { body: toBibtex(d), contentType: 'application/x-bibtex; charset=utf-8', filename }
    case 'html':
      return { body: toPrintableHtml(d), contentType: 'text/html; charset=utf-8', filename }
  }
}
