'use client'

import { useState } from 'react'
import { Send, PenLine } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { usePiAuthOptional } from '@/contexts/pi-auth-context'
import { POST_LIMITS, type PublicPost } from '@/lib/posts'

/**
 * Publish on the app itself. Signed-in users write a post; it appears in the
 * feed immediately and gets its own shareable permalink. Signed-out users see a
 * gentle prompt instead (the gateways stay open to everyone — charter §1).
 */
export function Composer({ onPublished }: { onPublished: (post: PublicPost) => void }) {
  const pi = usePiAuthOptional()
  const signedIn = Boolean(pi?.userData)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
    setError(null)
    if (title.trim().length < 3 || body.trim().length < 1) {
      setError('Add a title and something to say.')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post<{ post: PublicPost }>('/api/posts', {
        title: title.trim(),
        body: body.trim(),
        kind: 'post',
      })
      onPublished(data.post)
      setTitle('')
      setBody('')
    } catch (e) {
      const status = (e as { status?: number }).status
      setError(status === 401 ? 'Sign in to publish.' : 'Could not publish — try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!signedIn) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <PenLine className="h-4 w-4 shrink-0" />
        <span>Sign in with Pi to publish posts and research to the feed.</span>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={POST_LIMITS.title}
        placeholder="Title"
        className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={POST_LIMITS.body}
        placeholder="Share a finding, a signal, or a short piece of research…"
        rows={3}
        className="mt-2 w-full resize-y bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {error ? <span className="text-rose-500">{error}</span> : `${body.length}/${POST_LIMITS.body}`}
        </span>
        <Button size="sm" onClick={publish} disabled={busy} className="gap-1.5">
          <Send className="h-4 w-4" />
          {busy ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </Card>
  )
}
