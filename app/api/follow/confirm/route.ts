import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { confirmationExpired } from '@/lib/followers/subscription'

/**
 * GET /api/follow/confirm?id=…&token=… — the click that starts a subscription.
 *
 * A `GET` because it is reached from a link in a mail client, which is the whole
 * point of the flow, and mail clients issue GETs. That normally makes a
 * state-changing GET the wrong thing — but the state it changes is only ever
 * "this person agreed", the token is a 256-bit secret that reached one mailbox,
 * and nothing destructive is possible: the worst a prefetching mail client can
 * do is confirm a subscription its own user asked for.
 *
 * ## Why it answers with a page rather than JSON
 *
 * The reader arrives in a browser, from their mail. A wall of JSON is a broken
 * product to them however correct it is.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** A plain, self-contained page. No script, no font, nothing to fetch. */
function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Lambda</title></head>
<body style="margin:0;padding:24px;background:#0b0f14;color:#e6edf3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6">
<div style="max-width:520px;margin:8vh auto;background:#111820;border:1px solid #1f2933;border-radius:12px;padding:28px">
<div style="font-size:22px;font-weight:700;color:#4fc3f7">&#955; Lambda</div>
<h1 style="font-size:18px;margin:18px 0 8px">${title}</h1>
<p style="margin:0;color:#8b98a5;font-size:15px">${body}</p>
<p style="margin:22px 0 0"><a href="/" style="color:#4fc3f7">Open Lambda</a></p>
</div></body></html>`
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function GET(request: Request) {
  if (!isDbConfigured()) return page('Not available', 'This deployment has no database.', 503)

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const token = url.searchParams.get('token') ?? ''
  if (!id || !token) return page('That link is incomplete', 'Ask for a new confirmation.', 400)

  const found = await repo.followers.byId(id)
  /**
   * The same answer for a wrong id and a wrong token.
   *
   * Distinguishing them would let somebody walk ids and learn which ones exist,
   * and an id that exists is an address that asked to follow us.
   */
  if (!found || !verifyPassword(token, found.confirmTokenHash)) {
    return page('That link is not valid', 'It may already have been used, or replaced by a newer one. Ask for a new confirmation.', 400)
  }

  if (confirmationExpired(found)) {
    return page('That link has expired', 'Confirmations are good for seven days. Ask for a new one and it will arrive straight away.', 400)
  }

  await repo.followers.confirm(found.id)
  return page(
    'You are following Lambda',
    'The brief will start arriving. Every message carries a one-click unsubscribe, and leaving takes effect immediately.',
  )
}
