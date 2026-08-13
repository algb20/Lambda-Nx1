import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { repo, isDbConfigured } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth/server'
import { postPermalink } from '@/lib/posts'
import {
  EmptyDossierError,
  buildDossier,
  toMarkdown,
  type Dossier,
} from '@/lib/export/dossier'
import { toEvidenceList } from '@/lib/export/payload'

/**
 * POST /api/export/share — give a dossier a public address.
 *
 * A file you can download is a document. A link anyone can open is a citation —
 * a colleague, an editor or a court can check the work without being handed a
 * file and asked to trust it. This is the last step in making an investigation
 * something a reader can verify rather than believe.
 *
 * Four decisions:
 *
 *  - **Sign-in required.** Publishing puts content at a public URL under a
 *    byline. That is an act with consequences and it belongs to an account.
 *  - **Explicit.** It is never a side effect of exporting. Downloading a CSV
 *    keeps the work private; only this route publishes, and only when called.
 *  - **Idempotent on the seal.** The seal is a fingerprint of exactly these
 *    findings, so re-sharing the same investigation returns the link that
 *    already exists instead of minting a second address for identical content.
 *    Sharing twice is one page, not two.
 *  - **Markdown, not the printable page.** The public page renders the post's
 *    body, and storing raw HTML from third-party text at a public URL under our
 *    own origin is the one shape of this feature worth refusing.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REF_TYPE = 'dossier'

function permalinkFor(origin: string, id: string) {
  return { url: postPermalink(origin, id), id }
}

async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Sharing needs a database' }, { status: 503 })
  }
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to publish a dossier' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const body = (payload ?? {}) as Record<string, unknown>

  let dossier: Dossier
  try {
    dossier = buildDossier({
      subject: typeof body.subject === 'string' ? body.subject.slice(0, 200) : 'Untitled',
      kind: typeof body.kind === 'string' ? body.kind.slice(0, 120) : 'Investigation',
      evidence: toEvidenceList(body.evidence),
      note: typeof body.note === 'string' ? body.note.slice(0, 4000) : null,
    })
  } catch (err) {
    if (err instanceof EmptyDossierError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const origin = await requestOrigin()

  // Same findings ⇒ same seal ⇒ same page.
  const existing = await repo.posts.findByRef(REF_TYPE, dossier.seal)
  if (existing) {
    return NextResponse.json({ ...permalinkFor(origin, existing.id), seal: dossier.seal, reused: true })
  }

  const author = await repo.users.getById(userId)
  const post = await repo.posts.create({
    authorUserId: userId,
    authorName: author?.displayName ?? 'Analyst',
    kind: 'research',
    title: `${dossier.subject} — ${dossier.kind}`.slice(0, 200),
    body: toMarkdown(dossier),
    sourceUrl: dossier.references[0]?.url ?? null,
    refType: REF_TYPE,
    refValue: dossier.seal,
    locale: 'en',
    visibility: 'public',
  })

  return NextResponse.json({ ...permalinkFor(origin, post.id), seal: dossier.seal, reused: false })
}
