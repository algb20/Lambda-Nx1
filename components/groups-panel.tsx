'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Loader2, Plus, LogOut, Copy, Check, AlertCircle, Lock, Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

/**
 * Groups.
 *
 * Each account may own two, and the panel says so before anyone hits the limit
 * rather than after — a cap that only appears as an error message is a cap that
 * feels like a bug. Joining other people's groups is unlimited; only creating
 * them is bounded.
 */
interface GroupItem {
  id: string
  name: string
  slug: string
  description: string | null
  visibility: 'public' | 'private'
  memberCount: number
  isOwner: boolean
  inviteCode: string | null
}

export function GroupsPanel() {
  const [groups, setGroups] = useState<GroupItem[] | null>(null)
  const [owned, setOwned] = useState(0)
  const [limit, setLimit] = useState(2)
  const [canCreate, setCanCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/groups', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setGroups(data.groups ?? [])
      setOwned(data.owned ?? 0)
      setLimit(data.limit ?? 2)
      setCanCreate(Boolean(data.canCreate))
    } catch {
      setGroups([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Request failed')
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    const ok = await act({
      action: 'create',
      name,
      description,
      visibility: isPrivate ? 'private' : 'public',
    })
    if (ok) {
      setName('')
      setDescription('')
      setIsPrivate(false)
    }
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard refused; the code is on screen to copy by hand */
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Groups</h3>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {owned}/{limit} created
        </Badge>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        You can create up to {limit} groups. Joining groups other people run is unlimited.
      </p>

      {groups === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No groups yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                {g.visibility === 'private' ? (
                  <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                ) : (
                  <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {g.memberCount} member{g.memberCount === 1 ? '' : 's'}
                </span>
                {g.isOwner ? (
                  <Badge variant="outline" className="shrink-0 text-[9px]">
                    owner
                  </Badge>
                ) : null}
              </div>
              {g.description ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{g.description}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                {g.isOwner && g.inviteCode ? (
                  <button
                    onClick={() => copy(g.inviteCode!)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border hover:bg-muted"
                    title="Copy the invite code"
                  >
                    {copied === g.inviteCode ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {g.inviteCode}
                  </button>
                ) : null}
                {g.isOwner ? null : (
                  <button
                    onClick={() => act({ action: 'leave', groupId: g.id })}
                    disabled={busy}
                    className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <LogOut className="h-3 w-3" /> Leave
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={60}
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is it for? (optional)"
            maxLength={500}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-primary)]"
            />
            Private — reachable only with the invite code
          </label>
          <Button onClick={create} disabled={busy || name.trim().length < 3} className="w-full gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create group
          </Button>
        </div>
      ) : (
        <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
          {owned >= limit
            ? `You have created your ${limit} groups. Delete one to make room for another.`
            : 'Sign in to create a group.'}
        </p>
      )}

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </Card>
  )
}
