'use client'

import { useCallback, useState } from 'react'
import { CheckCircle2, Database, Loader2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Create the database schema, from the deployment, in one press.
 *
 * ## The failure this replaces
 *
 * The instruction used to be: open `db/schema.sql` raw on GitHub, select nine
 * hundred lines, copy them, paste them into the provider's SQL editor, run.
 * That works right up until a paste is truncated — and one was. The database
 * stopped at migration 0015, four tables short, and the only visible symptom
 * anywhere in the product was sign-up answering "an error occurred".
 *
 * A step a person can half-complete without knowing is not a step; it is a
 * trap. The deployment already holds the credential and the schema, so it is
 * the thing that should be doing this.
 *
 * ## Why the secret is typed, not stored
 *
 * `ADMIN_SECRET` is the operator credential this deployment already uses. It is
 * typed into this box, sent once, and never written to storage — not
 * `localStorage`, not a cookie, not the URL. Anyone reading this machine later
 * finds nothing, and a shared link carries no credential (charter §5).
 */

interface Status {
  reachable: boolean
  missing: string[]
  declared: number
  migrations: number
  complete: boolean
  error: string | null
  hint: string | null
}

interface ApplyResult {
  applied: boolean
  missingBefore: string[]
  missingAfter: string[]
  created: string[]
  migrations: number
  elapsedMs: number
  error: string | null
  hint: string | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'busy'; what: 'checking' | 'applying' }
  | { kind: 'status'; value: Status }
  | { kind: 'applied'; value: ApplyResult }
  | { kind: 'refused'; message: string }

export function SchemaInstaller() {
  const [secret, setSecret] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const call = useCallback(
    async (method: 'GET' | 'POST') => {
      const key = secret.trim()
      if (!key) return
      setPhase({ kind: 'busy', what: method === 'GET' ? 'checking' : 'applying' })
      try {
        const res = await fetch('/api/admin/schema', {
          method,
          cache: 'no-store',
          // A header, never the query string: a URL is logged by every proxy
          // between here and the server, and a credential in a log is a
          // credential leaked.
          headers: { 'x-admin-secret': key },
        })
        const body = (await res.json().catch(() => ({}))) as Partial<Status & ApplyResult> & {
          error?: string
        }

        if (res.status === 403) {
          return setPhase({ kind: 'refused', message: 'That is not the ADMIN_SECRET for this deployment.' })
        }
        if (res.status === 503) {
          return setPhase({
            kind: 'refused',
            message:
              'ADMIN_SECRET is not set on this deployment, so there is no operator credential to check. Add it in the hosting project settings and redeploy.',
          })
        }
        if (method === 'GET') return setPhase({ kind: 'status', value: body as Status })
        setPhase({ kind: 'applied', value: body as ApplyResult })
      } catch (error) {
        setPhase({
          kind: 'refused',
          message: error instanceof Error ? error.message : 'The request did not complete.',
        })
      }
    },
    [secret],
  )

  const busy = phase.kind === 'busy'

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Database className="h-4 w-4 shrink-0 text-primary" />
        Create the database tables
      </h2>
      <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        A connected database is not a ready one — its tables have to exist before accounts,
        verification codes or saved investigations can work. This applies the schema this build
        ships, from here. It is safe to run more than once: every statement is guarded, so a
        database that is already complete is left untouched.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          autoComplete="off"
          className="h-9 max-w-xs flex-1"
        />
        <Button onClick={() => void call('GET')} disabled={!secret.trim() || busy} variant="outline" size="sm">
          {busy && phase.what === 'checking' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          What is missing?
        </Button>
        <Button onClick={() => void call('POST')} disabled={!secret.trim() || busy} size="sm">
          {busy && phase.what === 'applying' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Apply the schema
        </Button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        The secret is sent once and never stored — not in this browser, not in the address bar.
      </p>

      <Report phase={phase} />
    </Card>
  )
}

/** Every outcome says what is now true of the database, never just "done". */
function Report({ phase }: { phase: Phase }) {
  if (phase.kind === 'idle' || phase.kind === 'busy') return null

  if (phase.kind === 'refused') {
    return <Line tone="bad">{phase.message}</Line>
  }

  if (phase.kind === 'status') {
    const s = phase.value
    if (!s.reachable) {
      return (
        <Line tone="bad">
          The database did not answer{s.error ? `: ${s.error}` : '.'}
          {s.hint ? ` — ${s.hint}` : ''}
        </Line>
      )
    }
    if (s.missing.length === 0) {
      return (
        <Line tone="good">
          Complete — all {s.declared} tables exist. Nothing to apply.
        </Line>
      )
    }
    return (
      <Line tone="warn">
        {s.missing.length} of {s.declared} tables are missing: <Tables names={s.missing} />
      </Line>
    )
  }

  const r = phase.value
  if (!r.applied) {
    return (
      <Line tone="bad">
        The schema did not finish{r.error ? `: ${r.error}` : '.'}
        {r.hint ? ` — ${r.hint}` : ''}
        {/* What a failed run still managed to do. Leaving this out is exactly
            how a half-applied database became invisible for days. */}
        {r.created.length > 0 ? (
          <>
            {' '}It did create <Tables names={r.created} /> before stopping.
          </>
        ) : null}
        {r.missingAfter.length > 0 ? (
          <>
            {' '}Still missing: <Tables names={r.missingAfter} />.
          </>
        ) : null}
      </Line>
    )
  }

  if (r.created.length === 0 && r.missingBefore.length === 0) {
    return (
      <Line tone="good">
        Already complete — nothing needed creating. Ran {r.migrations} migrations in {r.elapsedMs} ms.
      </Line>
    )
  }

  return (
    <Line tone="good">
      Done in {r.elapsedMs} ms. Created <Tables names={r.created} />.
      {r.missingAfter.length > 0 ? (
        <>
          {' '}
          <span className="font-medium">Still missing: </span>
          <Tables names={r.missingAfter} /> — this is unexpected on a successful run; run it again
          and report it if it persists.
        </>
      ) : (
        ' The database is now complete. Accounts and verification codes will work without a redeploy.'
      )}
    </Line>
  )
}

function Tables({ names }: { names: string[] }) {
  return <code className="break-all text-[12px]">{names.join(', ')}</code>
}

function Line({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  const style =
    tone === 'good'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : tone === 'warn'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'bg-destructive/10 text-destructive'
  return (
    <p className={`mt-3 flex items-start gap-2 rounded-md p-2.5 text-[13px] leading-relaxed ${style}`}>
      {tone === 'good' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="min-w-0">{children}</span>
    </p>
  )
}
