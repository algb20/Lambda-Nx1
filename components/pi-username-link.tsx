'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/policy'
import { discardBody } from '@/lib/http/discard'

/**
 * Link a Pi Network username for sign-in outside the Pi Browser.
 *
 * The Pi SDK only exists inside the Pi Browser, so a Pi user previously had no
 * way into their account from a laptop. Setting a passphrase here turns their
 * (already Pi-verified) username into a second sign-in identifier. The username
 * itself is never typed — the server reads it from the verified session, which
 * is what stops anyone claiming a username they do not own.
 *
 * Renders nothing at all for accounts that are not Pi-verified.
 */
interface ClaimState {
  eligible: boolean
  piUsername: string | null
  claimed: boolean
}

export function PiUsernameLink() {
  const [state, setState] = useState<ClaimState | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/pi/claim')
      .then((res) => {
        // See lib/http/discard.ts: a body nobody reads holds the connection.
        if (!res.ok) {
          discardBody(res)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data) setState(data as ClaimState)
      })
      .catch(() => {
        /* the panel simply does not appear */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!state?.eligible || !state.piUsername) return null

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password
  const ready = password.length >= MIN_PASSWORD_LENGTH && confirm === password

  const submit = async () => {
    if (busy || !ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/pi/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Could not link this username')
      setDone(true)
      setState({ ...state, claimed: true })
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link this username')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Sign in outside the Pi Browser</h3>
        {state.claimed ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Linked
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Set a passphrase for{' '}
        <span className="font-mono text-foreground">@{state.piUsername}</span> and you can sign in
        with that username from any browser.{' '}
        {state.claimed
          ? 'Setting a new one replaces the old passphrase.'
          : 'Pi has already verified this account is yours.'}
      </p>

      <div className="mt-3 space-y-2">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Passphrase (at least ${MIN_PASSWORD_LENGTH} characters)`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Repeat the passphrase"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button onClick={submit} disabled={busy || !ready} className="w-full">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state.claimed ? (
            'Replace passphrase'
          ) : (
            'Link my Pi username'
          )}
        </Button>
      </div>

      {tooShort ? (
        <p className="mt-2 text-xs text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      ) : null}
      {mismatch ? (
        <p className="mt-2 text-xs text-muted-foreground">The two passphrases do not match.</p>
      ) : null}
      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done — sign in anywhere with @{state.piUsername} and this passphrase.
        </p>
      ) : null}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        Stored as a scrypt hash, never in plain text. Your Pi wallet and keys are never involved —
        this is a password for this app only.
      </p>
    </Card>
  )
}
