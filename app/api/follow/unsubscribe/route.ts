import { NextResponse } from 'next/server'
import { repo, isDbConfigured } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'

/**
 * Leaving, in one click and without signing in.
 *
 * ## Both verbs, on purpose
 *
 * `GET` is what a person clicking the link at the bottom of a message does, and
 * they get a page telling them it is done.
 *
 * `POST` is what a *mail client* does. RFC 8058 one-click unsubscribe means the
 * provider posts to the `List-Unsubscribe` address itself when the reader
 * presses the button in Gmail or Outlook, and never renders anything. Supporting
 * only GET means those buttons appear to work and do nothing, which is worse
 * than not offering them — and the large providers now score a sender on
 * whether this actually functions, so getting it wrong eventually stops the
 * verification codes arriving too.
 *
 * ## No session, and no way to unsubscribe somebody else
 *
 * The token is the authority. It is a 256-bit secret that only ever existed in
 * one mailbox, and only its hash is stored. Requiring a sign-in here would mean
 * a reader who cannot get in cannot leave, which is the situation every rule
 * about unsubscribing exists to prevent.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function leave(request: Request): Promise<{ ok: boolean; message: string; status: number }> {
  if (!isDbConfigured()) {
    return { ok: false, message: 'This deployment has no database.', status: 503 }
  }
  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? ''
  const token = url.searchParams.get('token') ?? ''
  if (!id || !token) {
    return { ok: false, message: 'That link is incomplete.', status: 400 }
  }

  const row = await repo.followers.byId(id)
  if (!row || !verifyPassword(token, row.unsubscribeTokenHash)) {
    return { ok: false, message: 'That link is not valid.', status: 400 }
  }

  /**
   * Already gone is a success, not an error.
   *
   * A reader who presses the button twice, or whose mail client posts while
   * they also click, must not be told something went wrong — they asked to
   * leave and they have left. `unsubscribe` is written to be idempotent for
   * exactly this reason.
   */
  if (!row.unsubscribedAt) await repo.followers.unsubscribe(row.id)
  return { ok: true, message: 'You have been unsubscribed. Nothing further will be sent.', status: 200 }
}

/** What a mail provider calls. It renders nothing and reads only the status. */
export async function POST(request: Request) {
  const result = await leave(request)
  return NextResponse.json({ ok: result.ok, message: result.message }, { status: result.status })
}

/** What a person clicking the link gets. */
export async function GET(request: Request) {
  const result = await leave(request)
  const title = result.ok ? 'Unsubscribed' : 'That did not work'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Lambda</title></head>
<body style="margin:0;padding:24px;background:#0b0f14;color:#e6edf3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6">
<div style="max-width:520px;margin:8vh auto;background:#111820;border:1px solid #1f2933;border-radius:12px;padding:28px">
<div style="font-size:22px;font-weight:700;color:#4fc3f7">&#955; Lambda</div>
<h1 style="font-size:18px;margin:18px 0 8px">${title}</h1>
<p style="margin:0;color:#8b98a5;font-size:15px">${result.message}</p>
<p style="margin:22px 0 0"><a href="/" style="color:#4fc3f7">Open Lambda</a></p>
</div></body></html>`
  return new NextResponse(html, {
    status: result.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
