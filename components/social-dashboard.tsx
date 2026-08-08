'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Share2,
  Loader2,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

/**
 * The social publishing dashboard.
 *
 * Operator-only: everything here is behind ADMIN_SECRET, which is entered once
 * and kept in sessionStorage for the tab rather than in a cookie, so closing the
 * tab ends the operator session. The secret is sent as a header, never in the
 * URL, so it cannot end up in a server log or a browser history entry.
 *
 * Every channel has three independent switches — enabled, auto-publish and a
 * kind filter — because the failure operators actually fear is "it started
 * posting everything".
 */
type Platform = 'webhook' | 'discord' | 'slack' | 'telegram'
type Kind = 'post' | 'research' | 'signal'

interface Channel {
  id: string
  platform: Platform
  label: string
  target: string
  hasSecret: boolean
  enabled: boolean
  autoPublish: boolean
  kindFilter: Kind | null
  lastStatus: string | null
  lastError: string | null
  lastAt: string | null
  deliveredCount: number
  failedCount: number
}

interface PlatformInfo {
  platform: Platform
  targetHint: string
  needsSecret: boolean
}

const PLATFORM_LABEL: Record<Platform, string> = {
  webhook: 'Webhook',
  discord: 'Discord',
  slack: 'Slack',
  telegram: 'Telegram',
}

const SECRET_STORAGE_KEY = 'lambda-nx.admin-secret'

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      {/* left-0 is load-bearing: the button's own centring would otherwise
          become the knob's static position and push it past the pill. */}
      <span
        className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function SocialDashboard() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [secretStorage, setSecretStorage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(
    null,
  )

  // New-channel form
  const [platform, setPlatform] = useState<Platform>('discord')
  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('')
  const [token, setToken] = useState('')
  const [kindFilter, setKindFilter] = useState<Kind | ''>('')
  const [creating, setCreating] = useState(false)

  const api = useCallback(
    async (path: string, init: RequestInit = {}, key?: string) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          'Content-Type': 'application/json',
          'x-admin-secret': key ?? secret,
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`)
      return data
    },
    [secret],
  )

  const load = useCallback(
    async (key: string) => {
      setLoading(true)
      setError(null)
      try {
        const data = await api('/api/admin/social', {}, key)
        setChannels(data.channels ?? [])
        setPlatforms(data.platforms ?? [])
        setSecretStorage(data.secretStorage !== false)
        setAuthed(true)
        sessionStorage.setItem(SECRET_STORAGE_KEY, key)
      } catch (err) {
        setAuthed(false)
        setError(err instanceof Error ? err.message : 'Could not load channels')
      } finally {
        setLoading(false)
      }
    },
    [api],
  )

  useEffect(() => {
    const saved = sessionStorage.getItem(SECRET_STORAGE_KEY)
    if (saved) {
      setSecret(saved)
      load(saved)
    }
  }, [load])

  const info = platforms.find((p) => p.platform === platform)

  const create = async () => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const data = await api('/api/admin/social', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          label,
          target,
          secret: token || undefined,
          kindFilter: kindFilter || null,
        }),
      })
      setChannels((cur) => [...cur, data.channel])
      setLabel('')
      setTarget('')
      setToken('')
      setKindFilter('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the channel')
    } finally {
      setCreating(false)
    }
  }

  const patch = async (id: string, body: Partial<Channel>) => {
    // Optimistic: a toggle that waits for a round trip feels broken.
    setChannels((cur) => cur.map((c) => (c.id === id ? { ...c, ...body } : c)))
    try {
      const data = await api('/api/admin/social', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...body }),
      })
      setChannels((cur) => cur.map((c) => (c.id === id ? data.channel : c)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that change')
      await load(secret)
    }
  }

  const remove = async (id: string) => {
    try {
      await api(`/api/admin/social?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      setChannels((cur) => cur.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the channel')
    }
  }

  const test = async (id: string) => {
    setTesting(id)
    setTestResult(null)
    try {
      const data = await api('/api/admin/social/test', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
      setTestResult({
        id,
        ok: Boolean(data.result?.ok),
        message: data.result?.ok ? 'Delivered' : (data.result?.error ?? 'Failed'),
      })
      await load(secret)
    } catch (err) {
      setTestResult({ id, ok: false, message: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setTesting(null)
    }
  }

  if (!authed) {
    return (
      <Card className="mx-auto mt-16 w-full max-w-sm p-6">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">Publishing channels</h1>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Operator area. Enter the admin secret to continue.
        </p>
        <div className="space-y-2">
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(secret)}
            placeholder="Admin secret"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Button onClick={() => load(secret)} disabled={loading || !secret} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock'}
          </Button>
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 py-6">
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Publishing channels</h1>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {channels.filter((c) => c.enabled).length} active
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Where a published post is broadcast. Each channel has three separate switches: whether it
        is on at all, whether new posts go out automatically, and which kind of post qualifies.
        Unlisted posts are never broadcast.
      </p>

      {error ? (
        <Card className="flex items-start gap-2 border-destructive/40 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </Card>
      ) : null}

      {channels.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
          No channels yet. Add one below and send it a test.
        </Card>
      ) : (
        <div className="space-y-2">
          {channels.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {PLATFORM_LABEL[c.platform]}
                    </Badge>
                    {c.hasSecret ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <ShieldCheck className="h-3 w-3 text-emerald-500" /> token stored
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {c.target}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.deliveredCount} delivered · {c.failedCount} failed
                    {c.lastAt ? ` · last ${new Date(c.lastAt).toISOString().slice(0, 16).replace('T', ' ')}` : ''}
                  </p>
                  {c.lastStatus === 'error' && c.lastError ? (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      {c.lastError}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${c.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
                <label className="flex items-center gap-2 text-xs">
                  <Toggle
                    on={c.enabled}
                    onChange={(v) => patch(c.id, { enabled: v })}
                    label={`Enable ${c.label}`}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Toggle
                    on={c.autoPublish}
                    onChange={(v) => patch(c.id, { autoPublish: v })}
                    label={`Auto-publish to ${c.label}`}
                  />
                  Auto-publish
                </label>
                <select
                  value={c.kindFilter ?? ''}
                  onChange={(e) => patch(c.id, { kindFilter: (e.target.value || null) as Kind | null })}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  aria-label={`Post kinds for ${c.label}`}
                >
                  <option value="">All kinds</option>
                  <option value="post">Posts only</option>
                  <option value="research">Research only</option>
                  <option value="signal">Signals only</option>
                </select>
                <button
                  onClick={() => test(c.id)}
                  disabled={testing === c.id}
                  className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1 ring-border hover:bg-muted disabled:opacity-50"
                >
                  {testing === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Send test
                </button>
              </div>

              {testResult?.id === c.id ? (
                <p
                  className={`mt-2 flex items-start gap-1.5 text-xs ${
                    testResult.ok ? 'text-emerald-500' : 'text-destructive'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  {testResult.message}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Add a channel
        </h2>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <button
                key={p.platform}
                onClick={() => setPlatform(p.platform)}
                aria-pressed={platform === p.platform}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  platform === p.platform
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {PLATFORM_LABEL[p.platform]}
              </button>
            ))}
          </div>

          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name it, e.g. Team Discord"
            maxLength={80}
          />
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={info?.targetHint ?? 'Target'}
            autoCapitalize="none"
            spellCheck={false}
          />
          {info?.needsSecret ? (
            <>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bot token"
                autoCapitalize="none"
                spellCheck={false}
              />
              {!secretStorage ? (
                <p className="text-[11px] text-amber-600">
                  SOCIAL_SECRET_KEY is not set on the server, so a bot token cannot be stored
                  encrypted yet. The webhook platforms work without it.
                </p>
              ) : null}
            </>
          ) : null}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as Kind | '')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-label="Which post kinds this channel receives"
          >
            <option value="">All kinds</option>
            <option value="post">Posts only</option>
            <option value="research">Research only</option>
            <option value="signal">Signals only</option>
          </select>

          <Button
            onClick={create}
            disabled={creating || label.trim().length < 2 || !target.trim()}
            className="w-full"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add channel'}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            New channels start with auto-publish off. Turn it on once a test has arrived.
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-sm font-semibold">Why these platforms</h2>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Discord, Slack and generic webhooks accept a direct POST, so Lambda can publish to
          them on its own. X, Facebook, LinkedIn and Instagram require an approved OAuth
          application, which this deployment does not have — rather than showing buttons that
          cannot work, use a webhook into an automation tool that already holds those
          credentials. Telegram works directly with a bot token, which is stored encrypted and
          never displayed again.
        </p>
      </Card>
    </div>
  )
}
