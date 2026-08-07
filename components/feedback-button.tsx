'use client'

import { useEffect, useRef, useState } from 'react'
import { Lightbulb, X, Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'

/**
 * The floating idea button — reachable from every screen.
 *
 * Feedback that requires navigating to a dedicated tab is feedback that mostly
 * does not get written: the thought arrives while the user is looking at the
 * thing that prompted it, and by the time they have found the right page it is
 * gone. So this sits above every page and opens in place.
 *
 * It posts to the same /api/suggestions endpoint as the Ideas panel — one
 * pipeline, one AI triage, one clustering pass. This is a second door onto the
 * existing room, never a parallel one.
 */
type Kind = 'feature' | 'improvement' | 'bug' | 'integration' | 'data_source' | 'other'

const QUICK_KINDS: Array<{ key: Kind; label: string }> = [
  { key: 'improvement', label: 'Improvement' },
  { key: 'feature', label: 'Idea' },
  { key: 'bug', label: 'Something broken' },
]

export function FeedbackButton() {
  const { locale } = useI18n()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('improvement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    setError(null)
    if (sent) {
      // Reset only after a successful send, so a failed attempt keeps the text
      // the user typed rather than making them write it again.
      setSent(false)
      setTitle('')
      setBody('')
    }
  }

  const submit = async () => {
    if (sending || title.trim().length < 3) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), kind, locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        // The raw "Not authenticated" tells the user nothing they can act on.
        throw new Error('Sign in first, then send this — it takes one tap.')
      }
      if (!res.ok) throw new Error(data?.error ?? 'Could not send that just now')
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that just now')
    } finally {
      setSending(false)
    }
  }

  // Operator screens are not where product ideas get filed, and the button
  // would sit on top of their primary action.
  if (pathname?.startsWith('/admin')) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send an idea or report a problem"
        // Sits above the bottom navigation, and clears the iOS home indicator.
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Lightbulb className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Send an idea"
          >
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Tell us what would make this better</h2>
              <button
                onClick={close}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-3 py-2">
                <p className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  Sent. It is grouped with similar requests, and the most-wanted rise to the top of
                  the roadmap on the Ideas page.
                </p>
                <Button onClick={close} variant="outline" className="w-full">
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_KINDS.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => setKind(k.key)}
                      aria-pressed={kind === k.key}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        kind === k.key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <Input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="In one line — what is it?"
                  maxLength={160}
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Any detail that helps (optional)"
                  rows={4}
                  maxLength={4000}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />

                <Button
                  onClick={submit}
                  disabled={sending || title.trim().length < 3}
                  className="w-full gap-1.5"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send
                    </>
                  )}
                </Button>

                {error ? (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </p>
                ) : null}

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Write in any language — we read it as it comes. Each note is triaged and grouped
                  with similar ones, so what the most people ask for is what rises.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
