'use client'

import { useState } from 'react'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Follow the brief by email, without an account.
 *
 * ## Why this is separate from signing up
 *
 * They are different asks and conflating them costs both. An account is for
 * somebody who wants their investigations, monitors and settings kept — it is
 * worth a password and a verification code. Following is for somebody who wants
 * to be told what happened, and asking them to choose a password first is how
 * you lose them. Most people who read a brief will never open the app.
 *
 * So this takes an address and nothing else, and the address is confirmed by a
 * link rather than a code: the reader is already in their mail client when they
 * decide, and sending them back to the app to type six digits would lose most
 * of them for no gain in certainty.
 *
 * The reply is deliberately the same whatever the server did — see
 * `lib/followers/subscription`.
 */
export function FollowByEmail() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (busy || !email.trim()) return
    setBusy(true)
    setError(null)
    try {
      const locale =
        typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not sign you up')
      setDone(data.message ?? 'Check your mail.')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you up')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Card className="flex items-start gap-2 p-3">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">{done}</p>
      </Card>
    )
  }

  return (
    <Card className="p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Mail className="h-3.5 w-3.5 text-primary" />
        Get the brief by email
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        What the world picture showed, with the sources behind it. No account needed.
      </p>
      <div className="mt-2 flex gap-1.5">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Email address"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          className="h-8 text-xs"
        />
        <Button onClick={submit} disabled={busy || !email.trim()} size="sm" className="h-8 shrink-0">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Follow'}
        </Button>
      </div>
      {/* Said before they type, not after. Somebody deciding whether to hand
          over an address needs to know that they can take it back, and that
          nothing arrives until they say so a second time. */}
      <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
        We send one message to check the address is yours. Nothing else arrives unless you click the
        link in it, and every message after that has one-click unsubscribe.
      </p>
      {error ? <p className="mt-1.5 text-[11px] text-destructive">{error}</p> : null}
    </Card>
  )
}
