import { NextResponse } from 'next/server'
import {
  EmptyDossierError,
  buildDossier,
  renderDossier,
  type ExportFormat,
} from '@/lib/export/dossier'
import { MAX_FINDINGS, TooManyFindingsError, toEvidenceList } from '@/lib/export/payload'

/**
 * POST /api/export — turn a set of findings into a document.
 *
 * The client posts back the findings it is already displaying and gets a file:
 * JSON, CSV, Markdown, a numbered reference list, BibTeX, or a printable page.
 * Nothing is read from the database here, so there is no data to leak — the
 * caller can only get back a formatted version of what it sent.
 *
 * Rendering happens on the server for one reason: the dossier seal is computed
 * with the same `sealFindings` the rest of the platform uses, and that lives on
 * `node:crypto`. Pulling it into the browser bundle has broken this build twice
 * before. The seal has to be the *same* seal, or a cited document cannot be
 * checked against the platform that issued it.
 *
 * Every response is `Content-Disposition: attachment` with `nosniff`. That
 * matters most for the HTML rendering: the body contains third-party text, and
 * although every interpolation is escaped, serving it inline from our own origin
 * would turn an escaping mistake into a cross-site-scripting hole on the real
 * app. As an attachment the browser will never render it in our origin — and the
 * client prints it inside a sandboxed iframe (no `allow-same-origin`), which is
 * an opaque origin, so the document is isolated even if the escaping fails.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS: readonly ExportFormat[] = [
  'json',
  'csv',
  'markdown',
  'citations',
  'bibtex',
  'html',
] as const

const MAX_TEXT = 4_000
const str = (v: unknown, max = MAX_TEXT): string => (typeof v === 'string' ? v.slice(0, max) : '')

const isFormat = (v: unknown): v is ExportFormat =>
  typeof v === 'string' && (FORMATS as readonly string[]).includes(v)

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }

  const body = (payload ?? {}) as Record<string, unknown>
  const format = body.format
  if (!isFormat(format)) {
    return NextResponse.json({ error: 'Unsupported format', formats: FORMATS }, { status: 400 })
  }

  let evidence
  try {
    evidence = toEvidenceList(body.evidence)
  } catch (err) {
    if (err instanceof TooManyFindingsError) {
      return NextResponse.json({ error: err.message, limit: MAX_FINDINGS }, { status: 413 })
    }
    throw err
  }

  try {
    const dossier = buildDossier({
      subject: str(body.subject, 200) || 'Untitled',
      kind: str(body.kind, 120) || 'Investigation',
      evidence,
      note: str(body.note),
      author: str(body.author, 120),
    })
    const { body: rendered, contentType, filename } = renderDossier(dossier, format)

    return new NextResponse(rendered, {
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${filename}"`,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-store',
        // Surfaced so the client can show the seal next to the download.
        'x-dossier-seal': dossier.seal,
      },
    })
  } catch (err) {
    if (err instanceof EmptyDossierError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
