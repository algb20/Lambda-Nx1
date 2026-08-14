'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthForm, type AuthedUser } from '@/components/auth-form'
import { Avatar } from '@/components/avatar'

/**
 * Account: sign in, sign up, sign out, delete.
 *
 * This panel is why it exists at all. The app ships in Pi mode, where the only
 * way to become a user was the Pi SDK handshake — which completes *only* inside
 * the Pi Browser. In every ordinary browser the product was reachable (the
 * gateways are open by charter §1) but there was no path to an account
 * anywhere in the interface, and the users table stayed empty because nobody
 * could have filled it. Registration existed as an API and as a gate nobody
 * rendered.
 *
 * So the form lives here, in Preferences, in **both** modes: it never blocks
 * anything, it just makes an account possible for a visitor who wants their
 * investigations kept. Inside the Pi Browser the handshake still signs people in
 * automatically and this panel shows them as signed in instead.
 *
 * Deleting is in the same place as creating, deliberately. An account you can
 * only create is not an account you agreed to.
 */
export function AccountPanel() {
  const [user, setUser] = useState<AuthedUser | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const signOut = async () => {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
    } finally {
      setBusy(false)
    }
  }

  const deleteAccount = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data?.error ?? 'Could not delete the account')
      setUser(null)
      setConfirming(false)
      setConfirmText('')
      // The server has cleared the cookie; reload so nothing in the shell keeps
      // rendering as if the account still exists.
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account')
    } finally {
      setBusy(false)
    }
  }

  if (user === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your session…
        </CardContent>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4" />
            Account
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The gateways work without one. An account keeps your investigation history, your
            monitors, your groups and your picture across devices.
          </p>
        </CardHeader>
        <CardContent>
          <AuthForm onAuthenticated={loadMe} compact />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4" />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/*
              The picture belongs beside the name, not in a separate card three
              scrolls down. This is the profile — it should read as one.
            */}
            <Avatar src={user.avatarUrl} name={user.username} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user.handle ? `@${user.handle}` : user.username}
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
                {user.provider === 'pi' ? (
                  <>
                    Signed in with Pi Network
                    {/*
                      A pioneer never chose this name and cannot change it here:
                      it is the identity Pi verified, which is exactly what makes
                      it worth more than one somebody typed.
                    */}
                    <span className="opacity-70">— username from your Pi account</span>
                  </>
                ) : (
                  'Signed in'
                )}
                {user.plan === 'pro' ? (
                  <span className="rounded bg-primary/10 px-1 py-px font-medium text-primary">
                    Pro
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>

        <div className="rounded-md border border-destructive/30 p-3">
          <p className="text-sm font-medium">Delete this account</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Erases your account, saved investigations, monitors, groups and picture, immediately
            and permanently. Anything you published stays up but stops being attributed to you.
          </p>

          {confirming ? (
            <div className="mt-2 space-y-2">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || confirmText.trim() !== 'DELETE'}
                  onClick={deleteAccount}
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Delete permanently
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false)
                    setConfirmText('')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete account
            </Button>
          )}

          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
