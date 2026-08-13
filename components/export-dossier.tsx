'use client'

import { useState } from 'react'
import {
  Check,
  Download,
  Link2,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Quote,
  ShieldCheck,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Evidence } from '@/lib/engine/types'

/**
 * Take the work with you.
 *
 * Until now an investigation lived in a browser tab and died with it. An analyst
 * who cannot hand the findings to a colleague, an editor or a lawyer has not
 * finished the job — so every gateway result can now leave as a document, with
 * each finding numbered against the source that reported it.
 *
 * Two details are deliberate:
 *
 *  - **The printable dossier renders inside a sandboxed iframe.** The document
 *    embeds text from third-party providers. Every interpolation is escaped on
 *    the way in, but that is one layer, and one layer is not a boundary. The
 *    iframe is sandboxed *without* `allow-same-origin`, which puts the document
 *    in an opaque origin: even a total escaping failure could not read a cookie,
 *    a session or anything else belonging to the app. `allow-scripts` and
 *    `allow-modals` are the only permissions granted, and they exist solely so
 *    the document can raise the print dialog — which is how a PDF gets made,
 *    with the correct Arabic letter shaping and right-to-left layout that a
 *    hand-written PDF encoder would destroy.
 *
 *    (A `blob:` URL would *not* do this: blob URLs inherit the origin of the
 *    page that created them, so a new tab pointed at one runs in our origin.)
 *  - **The seal is shown after the first export.** It is the fingerprint of the
 *    exact findings that left, so the person receiving the file can be told
 *    which set it came from.
 */
const FORMATS = [
  { id: 'html', label: 'Print / PDF', icon: Printer, hint: 'Opens the print dialog' },
  { id: 'markdown', label: 'Report', icon: FileText, hint: 'Markdown' },
  { id: 'csv', label: 'Spreadsheet', icon: FileSpreadsheet, hint: 'CSV' },
  { id: 'json', label: 'Data', icon: FileJson, hint: 'JSON' },
  { id: 'citations', label: 'Citations', icon: Quote, hint: 'Numbered references' },
  { id: 'bibtex', label: 'BibTeX', icon: Quote, hint: 'For a bibliography' },
] as const

type FormatId = (typeof FORMATS)[number]['id']

export function ExportDossier({
  subject,
  kind,
  findings,
  note,
  author,
}: {
  subject: string
  kind: string
  findings: Evidence[]
  note?: string | null
  author?: string | null
}) {
  const [busy, setBusy] = useState<FormatId | 'share' | null>(null)
  const [seal, setSeal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<{ url: string; reused: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  if (findings.length === 0) return null

  const run = async (format: FormatId) => {
    if (busy) return
    setBusy(format)
    setError(null)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, kind, format, evidence: findings, note, author }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `Export failed (${res.status})`)
      }

      setSeal(res.headers.get('x-dossier-seal'))
      const filename =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        `lambda-export.${format}`
      const text = await res.text()

      if (format === 'html') printIsolated(text)
      else downloadText(text, filename, res.headers.get('content-type') ?? 'text/plain')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Give the dossier a public address. Separate from `run` because publishing
   * is a different act from downloading: it puts content at a URL under the
   * account's byline, and it is never something the user gets by accident.
   */
  const share = async () => {
    if (busy) return
    setBusy('share')
    setError(null)
    try {
      const res = await fetch('/api/export/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, kind, evidence: findings, note }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? `Could not publish (${res.status})`)
      setShared({ url: data.url, reused: Boolean(data.reused) })
      setSeal(data.seal ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
        <h3 className="text-[13px] font-semibold tracking-tight">Export this dossier</h3>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
          {findings.length} finding{findings.length === 1 ? '' : 's'}
        </span>
      </div>

      <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground">
        Every finding is numbered against the source that reported it and the time it was
        retrieved, so anyone you send this to can check it.
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {FORMATS.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            onClick={() => run(id)}
            disabled={busy !== null}
            title={hint}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-start text-[11px] ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy === id ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate">{label}</span>
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}

      {/* Publishing is never a side effect of exporting: downloading keeps the
          work private, and only this button gives it a public address. */}
      <div className="mt-2 border-t border-border/50 pt-2">
        {shared ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            <a
              href={shared.url}
              target="_blank"
              rel="noreferrer noopener"
              className="min-w-0 flex-1 truncate text-[11px] text-primary hover:underline"
            >
              {shared.url}
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shared.url)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                } catch {
                  /* clipboard refused; the link is on screen and selectable */
                }
              }}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] ring-1 ring-border transition-colors hover:bg-muted"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {shared.reused ? (
              <span className="w-full text-[10px] text-muted-foreground">
                These exact findings were already published — this is the same page, not a second one.
              </span>
            ) : null}
          </div>
        ) : (
          <button
            onClick={share}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] ring-1 ring-border transition-colors hover:bg-muted disabled:opacity-50"
          >
            {busy === 'share' ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            Publish a public link
          </button>
        )}
      </div>

      {seal ? (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
          <span>Seal</span>
          <span data-no-translate className="font-mono">
            {seal}
          </span>
          <span className="min-w-0 truncate">— a fingerprint of exactly these findings</span>
        </p>
      ) : null}
    </Card>
  )
}

/** Trigger a save without navigating the app away from the results. */
function downloadText(text: string, filename: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: contentType }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // The download has been handed to the browser by now; releasing the object
  // URL on the next tick keeps a long session from accumulating them.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * Render the dossier in an isolated document and raise the print dialog.
 *
 * `sandbox` without `allow-same-origin` is the whole point: the document holds
 * third-party text, and this puts it in an opaque origin where it cannot read
 * anything of ours even if the escaping upstream failed. `allow-scripts` and
 * `allow-modals` are granted only so the appended one-liner can open the print
 * dialog — the parent cannot call `print()` across an opaque origin, which is
 * exactly the isolation we asked for.
 */
function printIsolated(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts allow-modals')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
  // Set as a property, so the browser — not string concatenation — handles the
  // attribute encoding of a document that contains quotes and angle brackets.
  frame.srcdoc = `${html}<script>window.addEventListener('load',()=>window.print())<\/script>`

  const cleanup = () => frame.remove()
  // The dialog is modal and blocking; removing the frame afterwards keeps the
  // DOM clean without racing the print job.
  frame.addEventListener('load', () => window.setTimeout(cleanup, 60_000), { once: true })
  document.body.appendChild(frame)
}
