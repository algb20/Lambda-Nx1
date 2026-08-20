'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Your real name, and one eye that decides whether anybody else sees it.
 *
 * ## Why the eye, and not a checkbox labelled "public"
 *
 * The eye is the only control here, and each press flips the state — so the
 * question "is my name visible right now?" is answered by looking at the icon
 * rather than by reading a sentence. An open eye means people see it; a struck
 * eye means they do not. That reads identically in Arabic, in Chinese, and to
 * someone who is not going to read the caption at all.
 *
 * ## Why it starts closed
 *
 * A real name that is visible until its owner finds the setting has already
 * been published — the setting arrives too late to be a choice. So the default
 * is hidden, the eye starts struck through, and revealing is the deliberate act.
 *
 * ## What is not on offer
 *
 * Per-viewer visibility. The eye promises one thing — "other people can see
 * this" — and a name visible to some viewers and not others would be a much
 * larger promise wearing the same icon.
 */
export function RealNameControl({
  initialName,
  initialVisible,
}: {
  initialName: string | null
  initialVisible: boolean
}) {
  const [name, setName] = useState(initialName ?? '')
  const [visible, setVisible] = useState(initialVisible)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The tick is an acknowledgement, not a state: it should fade rather than sit
  // there implying the last thing you did is still happening.
  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [saved])

  const save = async (patch: { fullName?: string; showRealName?: boolean }) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as { error?: string; fullName?: string | null; showRealName?: boolean }
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      if (typeof data.showRealName === 'boolean') setVisible(data.showRealName)
      if (data.fullName !== undefined) setName(data.fullName ?? '')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      // Put the switch back where it was, rather than showing a state the
      // server did not accept.
      if (patch.showRealName !== undefined) setVisible(!patch.showRealName)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== (initialName ?? '') && save({ fullName: name })}
          onKeyDown={(e) => e.key === 'Enter' && save({ fullName: name })}
          placeholder="Your full name"
          maxLength={80}
          autoComplete="name"
          className="h-8"
        />
        <button
          type="button"
          onClick={() => {
            const next = !visible
            setVisible(next)
            void save({ showRealName: next })
          }}
          disabled={busy || !name.trim()}
          aria-pressed={visible}
          aria-label={visible ? 'Hide my real name from others' : 'Show my real name to others'}
          title={visible ? 'Visible to others — press to hide' : 'Hidden — press to show'}
          className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
            visible ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {saved ? <Check className="h-3 w-3 text-emerald-500" /> : null}
        {visible
          ? 'Other people see your name next to your username.'
          : 'Hidden — other people see only your username.'}
      </p>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
