'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle, AtSign, MailCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeUsername, usernameError, usernameProblem } from '@/lib/auth/policy'

/**
 * The one sign-in / sign-up / recovery form.
 *
 * It exists on its own because it is needed in two places that are not the same
 * shape: the standalone gate (which blocks the app until you are in) and the
 * account panel in Preferences (which never blocks anything — the gateways are
 * open without an account by charter §1). Writing it twice would mean two
 * password fields that drift apart, and the one that drifts is a security
 * control.
 *
 * ## Three flows, two steps
 *
 * Sign-in is one step. Sign-up and recovery are both *address, then code*, which
 * is deliberately the same two screens in the same order — a person who has done
 * one already knows how to do the other.
 *
 * The code step is a separate screen rather than a field that appears below the
 * others, because it is a different moment: the user has left the app, gone to
 * their mail, and come back. Showing them the form they already filled in, with
 * one more empty box in it, invites them to fill it in again.
 *
 * ## What it does not decide for itself
 *
 * Whether email sign-up and recovery are possible at all is a property of the
 * deployment (is there a mail provider?), so it is asked for rather than
 * assumed — see `/api/auth/methods`. Offering a "Forgot password?" link that
 * leads to a 503 makes a correctly-configured-for-Pi deployment look broken.
 */
export type AuthMode = 'login' | 'register' | 'forgot'
type Step = 'identify' | 'code'

export interface AuthedUser {
  id: string
  /** What to show. Falls back to older fields for pre-handle accounts. */
  username: string
  /** The handle proper, or null if this account predates handles. */
  handle?: string | null
  plan?: 'free' | 'pro'
  avatarUrl?: string | null
  provider?: string
  /** The owner's own real name. Only ever sent to the account it belongs to. */
  fullName?: string | null
  /** Whether other people see that name beside the handle. */
  showRealName?: boolean
}

interface Methods {
  accounts: boolean
  emailSignUp: boolean
  passwordReset: boolean
}

/** Seconds a resend stays disabled — mirrors RESEND_COOLDOWN_MS on the server. */
const RESEND_SECONDS = 60

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
  const [step, setStep] = useState<Step>('identify')
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [methods, setMethods] = useState<Methods | null>(null)
  const codeInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    fetch('/api/auth/methods')
      .then((r) => r.json())
      .then((d: Methods) => live && setMethods(d))
      // A failed probe must not disable the form: assume the flows exist and let
      // the real request say otherwise, rather than hiding sign-up over a blip.
      .catch(() => live && setMethods({ accounts: true, emailSignUp: true, passwordReset: true }))
    return () => {
      live = false
    }
  }, [])

  // One ticking timer for the resend countdown, cleaned up on every change so a
  // component that unmounts mid-countdown does not keep a timer alive.
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus()
  }, [step])

  const reset = useCallback((next: AuthMode) => {
    setMode(next)
    setStep('identify')
    setError(null)
    setNotice(null)
    setCode('')
    setPassword('')
    setUsername('')
  }, [])

  const handleProblem = mode === 'register' && username ? usernameProblem(username) : null
  const digits = code.replace(/\D/g, '')

  const canSubmit = (() => {
    if (busy) return false
    if (step === 'identify') {
      if (mode === 'login') return Boolean(identifier.trim() && password)
      return Boolean(identifier.trim())
    }
    if (digits.length !== 6) return false
    if (mode === 'register') return Boolean(username.trim()) && !handleProblem && password.length >= 8
    return password.length >= 8
  })()

  /** POST helper. Returns the parsed body, or throws with the server's message. */
  const post = async (path: string, payload: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(data?.error ?? 'Something went wrong')
    return data
  }

  const locale = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined

  const sendCode = async (resend = false) => {
    const email = identifier.trim()
    if (mode === 'register') {
      await post('/api/auth/verify/request', { email, locale })
    } else {
      await post('/api/auth/password/forgot', { email, locale })
    }
    setStep('code')
    setCooldown(RESEND_SECONDS)
    setNotice(
      resend
        ? `A new code is on its way to ${email}.`
        : mode === 'register'
          ? `We sent a six-digit code to ${email}. Enter it below to finish.`
          : `If ${email} has an account, a six-digit code is on its way. Enter it below with your new password.`,
    )
  }

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      if (step === 'identify') {
        if (mode === 'login') {
          await post('/api/auth/login', { identifier: identifier.trim(), password })
          setPassword('')
          await onAuthenticated()
        } else {
          await sendCode()
        }
      } else if (mode === 'register') {
        await post('/api/auth/verify/confirm', {
          email: identifier.trim(),
          code: digits,
          password,
          username: normalizeUsername(username),
          fullName: fullName.trim(),
        })
        setPassword('')
        await onAuthenticated()
      } else {
        await post('/api/auth/password/reset', { email: identifier.trim(), code: digits, password })
        setPassword('')
        await onAuthenticated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (cooldown > 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send another code')
    } finally {
      setBusy(false)
    }
  }

  const emailFlowsOff = methods !== null && !methods.emailSignUp

  // ── The code screen ────────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <div className="space-y-2">
        <button
          onClick={() => {
            setStep('identify')
            setError(null)
            setNotice(null)
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        {notice ? (
          <p className="flex items-start gap-1.5 rounded-md bg-emerald-500/10 p-2 text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400">
            <MailCheck className="mt-px h-3.5 w-3.5 shrink-0" />
            {notice}
          </p>
        ) : null}

        {/*
          dir="ltr" and inputMode="numeric": the digits must read and type the
          same way in Arabic as in English, and a phone should open the number
          pad rather than a full keyboard for a six-digit code.
        */}
        <Input
          ref={codeInput}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩۰-۹]/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />

        {mode === 'register' ? (
          <div className="space-y-1">
            {/*
              Optional, and marked optional. A required real name on a platform
              that analyses public information would be collecting an identity
              it has no use for — and it is hidden by default in any case.
            */}
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name (optional)"
              autoComplete="name"
              maxLength={80}
            />
            <p className="text-[11px] text-muted-foreground">
              Hidden by default — other people see only your username. You can reveal it any time
              with the eye in Preferences.
            </p>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                maxLength={30}
              />
            </div>
            {handleProblem ? (
              <p className="text-[11px] text-destructive">{usernameError(handleProblem)}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                This is how other people see you. Lowercase letters, numbers and underscores.
              </p>
            )}
          </div>
        ) : null}

        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={mode === 'register' ? 'Password (8+ characters)' : 'New password (8+ characters)'}
          autoComplete="new-password"
        />

        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === 'register' ? (
            'Confirm and create account'
          ) : (
            'Set new password'
          )}
        </Button>

        <button
          onClick={resend}
          disabled={cooldown > 0 || busy}
          className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0 ? `Send another code in ${cooldown}s` : 'Send another code'}
        </button>

        {error ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  // ── The address / sign-in screen ───────────────────────────────────────────
  return (
    <div className={compact ? 'space-y-2' : 'space-y-2'}>
      <Input
        type={mode === 'login' ? 'text' : 'email'}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && mode !== 'login' && submit()}
        placeholder={mode === 'login' ? 'Email or Pi username' : 'name@example.com'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete={mode === 'login' ? 'username' : 'email'}
      />

      {mode === 'login' ? (
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Password or Pi passphrase"
          autoComplete="current-password"
        />
      ) : null}

      <Button onClick={submit} disabled={!canSubmit} className="w-full">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === 'login' ? (
          'Sign in'
        ) : mode === 'register' ? (
          'Send verification code'
        ) : (
          'Send reset code'
        )}
      </Button>

      {mode === 'login' ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Signing in with a Pi Network username works once you have linked it from inside the Pi
          Browser, under Preferences.
        </p>
      ) : mode === 'register' ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          We send a six-digit code to confirm the address is yours. We store your username, your
          email address and a hash of your password — nothing else is required. See the{' '}
          <a href="/privacy" className="text-primary hover:underline">
            privacy notice
          </a>
          .
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          We answer the same way whether or not the address has an account here — so nobody can use
          this form to find out who uses Lambda.
        </p>
      )}

      {emailFlowsOff ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          This deployment has no mail provider configured, so email sign-up and password reset are
          unavailable. Sign in with Pi Network instead.
        </p>
      ) : null}

      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          onClick={() => reset(mode === 'login' ? 'register' : 'login')}
          className="text-xs text-primary hover:underline"
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        {mode !== 'forgot' && methods?.passwordReset !== false ? (
          <button onClick={() => reset('forgot')} className="text-xs text-muted-foreground hover:underline">
            Forgot password?
          </button>
        ) : null}
      </div>
    </div>
  )
}
