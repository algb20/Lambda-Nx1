/**
 * Post shapes + pure helpers shared by the API, the feed and the permalink page.
 * Everything here is deterministic and DOM-free, so it is unit-tested directly;
 * the browser-only actions (clipboard, download, native share) live in
 * lib/share.ts.
 */

export type PostKind = 'post' | 'research' | 'signal'
export type PostVisibility = 'public' | 'unlisted'

/** The public shape returned by the API (no internal columns leak). */
export interface PublicPost {
  id: string
  kind: PostKind
  title: string
  body: string
  author: string | null
  sourceUrl: string | null
  refType: string | null
  refValue: string | null
  locale: string | null
  visibility: PostVisibility
  likeCount: number
  repostCount: number
  createdAt: string
}

export const POST_LIMITS = {
  title: 160,
  body: 8000,
} as const

/** The app signature used in shared/downloaded text — the λ glyph, no wordmark. */
export const LAMBDA_GLYPH = 'λ'

/** Validate + normalize a publish request. Returns the clean fields or an error. */
export function validatePostInput(input: {
  title?: unknown
  body?: unknown
  kind?: unknown
  sourceUrl?: unknown
  refType?: unknown
  refValue?: unknown
  locale?: unknown
  visibility?: unknown
}): { ok: true; value: CleanPostInput } | { ok: false; error: string } {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  if (title.length < 3) return { ok: false, error: 'Title is too short' }
  if (title.length > POST_LIMITS.title) return { ok: false, error: 'Title is too long' }
  if (body.length < 1) return { ok: false, error: 'Body is empty' }
  if (body.length > POST_LIMITS.body) return { ok: false, error: 'Body is too long' }

  const kind: PostKind =
    input.kind === 'research' || input.kind === 'signal' ? input.kind : 'post'
  const visibility: PostVisibility = input.visibility === 'unlisted' ? 'unlisted' : 'public'
  const sourceUrl = safeHttpUrl(input.sourceUrl)

  return {
    ok: true,
    value: {
      title,
      body,
      kind,
      visibility,
      sourceUrl,
      refType: shortStr(input.refType, 40),
      refValue: shortStr(input.refValue, 120),
      locale: shortStr(input.locale, 12),
    },
  }
}

export interface CleanPostInput {
  title: string
  body: string
  kind: PostKind
  visibility: PostVisibility
  sourceUrl: string | null
  refType: string | null
  refValue: string | null
  locale: string | null
}

/** Only accept http(s) URLs; reject anything else (javascript:, data:, …). */
export function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  try {
    const u = new URL(v.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

function shortStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

/** The stable public permalink for a post. */
export function postPermalink(origin: string, id: string): string {
  return `${origin.replace(/\/+$/, '')}/p/${id}`
}

/** A URL-safe filename stem from a title (for downloads). */
export function slugifyTitle(title: string, max = 60): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return slug || 'post'
}

/** Render a post as portable Markdown, signed with the λ glyph. */
export function postToMarkdown(post: PublicPost, permalink?: string): string {
  const lines: string[] = [`# ${post.title}`, '']
  const meta: string[] = []
  if (post.author) meta.push(`By ${post.author}`)
  meta.push(new Date(post.createdAt).toISOString().slice(0, 10))
  meta.push(post.kind)
  lines.push(`*${meta.join(' · ')}*`, '', post.body, '')
  if (post.sourceUrl) lines.push('', `Source: ${post.sourceUrl}`)
  lines.push('', '---', `${LAMBDA_GLYPH} Lambda NX${permalink ? ` · ${permalink}` : ''}`)
  return lines.join('\n')
}

/** Short text for a native share / clipboard, signed with the λ glyph. */
export function buildShareText(post: Pick<PublicPost, 'title' | 'body'>, permalink: string): string {
  const snippet = post.body.length > 200 ? `${post.body.slice(0, 197).trimEnd()}…` : post.body
  return `${post.title}\n\n${snippet}\n\n${LAMBDA_GLYPH} ${permalink}`
}
