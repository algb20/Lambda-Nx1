'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Radar, Loader2, ShieldCheck, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Standalone (off-Pi) auth gate. Used when NEXT_PUBLIC_AUTH_MODE=standalone: the
 * app runs as an independent web app with email/password sign-in (our own signed
 * sessions), talking to the existing /api/auth endpoints — no Pi dependency.
 */
type Mode = 'login' | 'register'

export function StandaloneAuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; username: string } | null | undefined>(undefined)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMe = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    }
  }
  useEffect(() => {
    loadMe()
  }, [])

  const submit = async () => {
    if (busy || !email.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Authentication failed')
      await loadMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (user) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-2">
          <Radar className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-none">Lambda NX</h1>
            <p className="text-[10px] text-muted-foreground">Intelligence platform</p>
          </div>
        </div>
        <h2 className="mb-3 text-sm font-semibold">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h2>
        <div className="space-y-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Password"
          />
          <Button onClick={submit} disabled={busy || !email.trim() || !password} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </div>
        {error ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          className="mt-3 text-xs text-primary hover:underline"
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Our own signed sessions — passwords hashed, never stored in plain text.
        </p>
      </Card>
    </div>
  )
}
