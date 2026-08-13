'use client'

import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * The one sign-in / sign-up form.
 *
 * It exists on its own because it is needed in two places that are not the same
 * shape: the standalone gate (which blocks the app until you are in) and the
 * account panel in Preferences (which never blocks anything — the gateways are
 * open without an account by charter §1). Writing it twice would mean two
 * password fields that drift apart, and the one that drifts is a security
 * control.
 *
 * Sign-in takes a single identifier field that accepts either an email address
 * or a Pi Network username; the server decides which. A Pi username only reaches
 * an account after its owner has claimed it from inside the Pi Browser, so a
 * public username is not a way in.
 */
export type AuthMode = 'login' | 'register'

export interface AuthedUser {
  id: string
  username: string
}

export function AuthForm({
  onAuthenticated,
  compact = false,
}: {
  /** Called after the session cookie is set, so the caller can reload identity. */
  onAuthenticated: () => void | Promise<void>
  /** Tighter spacing for the settings panel; the gate uses the roomy version. */
  compact?: boolean
}) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (busy || !identifier.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { identifier: identifier.trim(), password }
            : { email: identifier.trim(), password },
        ),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data?.error ?? 'Authentication failed')
      // Clear the password from state the moment it is no longer needed.
      setPassword('')
      await onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2'}>
      <Input
        type={mode === 'login' ? 'text' : 'email'}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder={mode === 'login' ? 'Email or Pi username' : 'name@example.com'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete={mode === 'login' ? 'username' : 'email'}
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={mode === 'login' ? 'Password or Pi passphrase' : 'Password (8+ characters)'}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />
      <Button onClick={submit} disabled={busy || !identifier.trim() || !password} className="w-full">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === 'login' ? (
          'Sign in'
        ) : (
          'Create account'
        )}
      </Button>

      {mode === 'login' ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Signing in with a Pi Network username works once you have linked it from inside the Pi
          Browser, under Preferences.
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          We store your email address and a hash of your password — nothing else is required. See
          the{' '}
          <a href="/privacy" className="text-primary hover:underline">
            privacy notice
          </a>
          .
        </p>
      )}

      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setError(null)
        }}
        className="text-xs text-primary hover:underline"
      >
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
  )
}
