'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { initialsOf } from '@/lib/modules/avatar'

/**
 * A user's picture, and the control to change it.
 *
 * `Avatar` is the read-only face used wherever a name appears; it falls back to
 * initials rather than an empty circle, so a user without a picture still reads
 * as a person. `AvatarSetting` is the upload control.
 */
export function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null
  name?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 align-middle font-semibold text-primary"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden={!name}
    >
      {showImage ? (
        // A plain <img>: the source is our own route, already sized and cached
        // hard by its versioned key, so the image optimiser adds nothing.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={name ? `${name}` : ''}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}

interface Me {
  id: string
  username: string
  avatarUrl?: string | null
}

export function AvatarSetting() {
  const [me, setMe] = useState<Me | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.user) setMe(d.user as Me)
      })
      .catch(() => {
        /* the panel does not appear */
      })
    return () => {
      alive = false
    }
  }, [])

  if (!me) return null

  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/avatar', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
      setMe({ ...me, avatarUrl: data.avatarUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/avatar', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not remove the picture')
      setMe({ ...me, avatarUrl: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the picture')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">Your picture</h3>
      <div className="flex items-center gap-3">
        <Avatar src={me.avatarUrl} name={me.username} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{me.username}</p>
          <p className="text-[11px] text-muted-foreground">
            PNG, JPEG or WebP, up to 2 MB. Shown beside your name everywhere.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {me.avatarUrl ? 'Change picture' : 'Upload a picture'}
        </button>
        {me.avatarUrl ? (
          <button
            onClick={remove}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs text-muted-foreground ring-1 ring-border hover:bg-muted disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </Card>
  )
}
