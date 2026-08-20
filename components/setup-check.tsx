'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  diagnose,
  verdict,
  type CheckState,
  type DiagnosisCheck,
  type ProbeResult,
} from '@/lib/deployment/diagnose'

/**
 * "Why is my copy empty?" — answered by the app itself.
 *
 * Three completely different causes produce one identical blank screen: a
 * deployment serving static files with no server, a server with no outbound
 * access, and a missing database. A person looking at an empty globe cannot
 * tell which they have, and every one of them is a different afternoon of work.
 *
 * So the app runs the checks and says which. It is the one page that must work
 * when nothing else does, so it fetches nothing on the server, needs no account
 * and no database, and treats every failure as a finding rather than an error.
 */
export function SetupCheck() {
  const [checks, setChecks] = useState<DiagnosisCheck[] | null>(null)
  const [running, setRunning] = useState(false)

  const probe = useCallback(async (path: string, init?: RequestInit): Promise<ProbeResult> => {
    const began = Date.now()
    try {
      const res = await fetch(path, { cache: 'no-store', ...init })
      const text = await res.text()
      let body: unknown = null
      let json = false
      try {
        body = JSON.parse(text)
        json = true
      } catch {
        // An HTML body is the signal, not an accident: it means a file server
        // answered where a route handler should have.
        body = text.slice(0, 400)
      }
      return { status: res.status, json, body, ms: Date.now() - began }
    } catch (error) {
      return {
        status: 0,
        json: false,
        body: null,
        ms: Date.now() - began,
        error: error instanceof Error ? error.message : 'request failed',
      }
    }
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    // In parallel: the whole point is a fast answer, and a serial run behind a
    // 30-second world sweep would make the diagnostic feel like the fault.
    const [health, world, board] = await Promise.all([
      probe('/api/health?deep=1'),
      probe('/api/world'),
      probe('/api/intelligence/boards/space-weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ])
    setChecks(diagnose({ health, world, board }))
    setRunning(false)
  }, [probe])

  useEffect(() => {
    void run()
  }, [run])

  const summary = checks ? verdict(checks) : null

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Is this copy working?</h1>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              An empty map, empty panels and empty gateways all look the same and have three
              different causes. This runs the checks that tell them apart.
            </p>
          </div>
          <Button onClick={() => void run()} disabled={running} variant="outline" size="sm">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            Run again
          </Button>
        </div>

        {summary ? (
          <p
            className={`mt-3 rounded-md p-2.5 text-sm leading-relaxed ${
              summary.state === 'fail'
                ? 'bg-destructive/10 text-destructive'
                : summary.state === 'warn'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {summary.message}
          </p>
        ) : null}
      </Card>

      {!checks && running ? (
        <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking…
        </Card>
      ) : null}

      {checks?.map((check) => (
        <Card key={check.id} className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <StateIcon state={check.state} />
            {check.title}
          </h2>
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
            {check.detail}
          </p>
          {check.action ? (
            <p className="mt-2 max-w-prose rounded-md bg-muted/60 p-2.5 text-[13px] leading-relaxed">
              <span className="font-medium">Do this: </span>
              {check.action}
            </p>
          ) : null}
        </Card>
      ))}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Running it yourself</h2>
        <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          The download is source code, not a runnable app — unzipping it starts nothing. Three
          commands turn it into a running product:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-[12px] leading-relaxed">
          <code>{'npm install\nnpm run build\nnpm start          # http://localhost:3000'}</code>
        </pre>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          The map, the panels, the news and all 26 gateways work immediately after that — no key, no
          account, no database. Only accounts and cross-device preferences need one.
        </p>
      </Card>
    </div>
  )
}

function StateIcon({ state }: { state: CheckState }) {
  if (state === 'ok') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
  if (state === 'fail') return <XCircle className="h-4 w-4 shrink-0 text-destructive" />
  if (state === 'warn') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
  return <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" />
}
