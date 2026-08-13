'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Radar, Loader2, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AuthForm, type AuthedUser } from '@/components/auth-form'

/**
 * Standalone (off-Pi) auth gate. Used when NEXT_PUBLIC_AUTH_MODE=standalone: the
 * app runs as an independent web app with our own signed sessions, talking to
 * the existing /api/auth endpoints — no Pi dependency.
 *
 * The form itself lives in `auth-form.tsx`, shared with the account panel in
 * Preferences, so there is exactly one sign-in implementation to keep correct.
 */
export function StandaloneAuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null | undefined>(undefined)

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = (await res.json()) as { user?: AuthedUser | null }
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

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
            <h1 className="text-lg font-bold leading-none">Lambda</h1>
            <p className="text-[10px] text-muted-foreground">Intelligence platform</p>
          </div>
        </div>
        <h2 className="mb-3 text-sm font-semibold">Sign in or create an account</h2>

        <AuthForm onAuthenticated={loadMe} />

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Our own signed sessions — passwords hashed, never stored in plain text.
        </p>
      </Card>
    </div>
  )
}
