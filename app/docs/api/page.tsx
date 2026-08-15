import Link from 'next/link'
import type { Metadata } from 'next'
import {
  API_GROUPS,
  EVIDENCE_FIELDS,
  RATE_LIMIT,
  allEndpoints,
  type ApiEndpoint,
} from '@/lib/api-catalog'

/**
 * The API reference.
 *
 * Rendered entirely from `lib/api-catalog.ts`, which a test asserts against the
 * filesystem in both directions: nothing documented here can fail to exist, and
 * no route can exist without someone having decided whether it is public. That
 * check is the reason this page is worth reading at all — a hand-written API
 * document is a copy of the routes, and a copy drifts into confident lies about
 * software that no longer works that way.
 */
export const metadata: Metadata = {
  title: 'API reference — Lambda NX',
  description:
    'The open Lambda NX API: live world boards, OSINT gateways and specialist intelligence families. No key required.',
  alternates: { canonical: '/docs/api' },
}

function curlFor(endpoint: ApiEndpoint): string {
  const url = `https://lambdanx.app${endpoint.path}`
  if (endpoint.method === 'GET') return `curl "${url}"`
  const body = endpoint.params
    ? `{"${endpoint.params[0].name}": "${endpoint.params[0].example}"}`
    : '{}'
  return `curl -X POST "${url}" \\\n  -H 'content-type: application/json' \\\n  -d '${body}'`
}

function Endpoint({ endpoint }: { endpoint: ApiEndpoint }) {
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
            {endpoint.method}
          </span>
          <code className="font-mono text-sm">{endpoint.path}</code>
        </div>
        <h3 className="text-sm font-semibold">{endpoint.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{endpoint.description}</p>
      </header>

      {endpoint.params && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Body
          </h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {endpoint.params.map((p) => (
              <li key={p.name}>
                <code className="font-mono text-foreground">{p.name}</code>{' '}
                <span className="text-xs">
                  {p.type}
                  {p.required ? ', required' : ', optional'}
                </span>{' '}
                — {p.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Returns
        </h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {endpoint.returns.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <pre className="overflow-x-auto rounded bg-muted p-3 text-xs leading-relaxed">
        <code>{curlFor(endpoint)}</code>
      </pre>
    </article>
  )
}

export default function ApiDocsPage() {
  const total = allEndpoints().length

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">API reference</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {total} open endpoints. No key, no account, no sign-up. Everything returns JSON, and every
          finding carries what you need to check it yourself.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Before you start</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">
              {RATE_LIMIT.requests} requests per {RATE_LIMIT.windowSeconds} seconds
            </strong>
            , per caller. Every response carries {RATE_LIMIT.headers.join(', ')} so a well-behaved
            client can pace itself instead of discovering the wall. Over the limit answers{' '}
            <code className="font-mono">429</code> with{' '}
            <code className="font-mono">retryAfterSeconds</code>. The limit exists because each
            gateway call fans out to public providers who rate-limit <em>us</em>, not you — one
            looping client would take the platform down for everyone.
          </li>
          <li>
            <strong className="text-foreground">Calls can be slow, and that is honest.</strong> A
            gateway sweeps many providers in parallel; the ceiling is 60 seconds and the normal path
            is a few. Nothing is fabricated to answer faster.
          </li>
          <li>
            <strong className="text-foreground">Passive only.</strong> These endpoints read public
            providers <em>about</em> a subject. Nothing here contacts the subject itself, and the
            engine refuses to — it is a guardrail in code, not a policy statement.
          </li>
          <li>
            <strong className="text-foreground">No breach data is served.</strong> Exposure checks
            answer whether an address appears in known breaches. They never return credentials.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What a finding carries</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every graded item across every gateway has the same shape, so one parser reads all of
          them:
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {EVIDENCE_FIELDS.map((f) => (
            <li key={f}>
              <code className="font-mono text-xs">{f.split(' — ')[0]}</code>
              {f.includes(' — ') ? ` — ${f.split(' — ').slice(1).join(' — ')}` : ''}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <code className="font-mono">publishedAt</code> is <code className="font-mono">null</code>{' '}
          when the source stated no time. It is never filled in with the retrieval time — a missing
          publication date is a real finding about a source, and substituting “now” would turn a
          five-year-old report into breaking news.
        </p>
      </section>

      {API_GROUPS.map((group) => (
        <section key={group.id} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{group.description}</p>
          </div>
          <div className="space-y-3">
            {group.endpoints.map((e) => (
              <Endpoint key={e.path} endpoint={e} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Errors</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <code className="font-mono">400</code> — the body was not JSON, or a required field was
            missing. The message names the field.
          </li>
          <li>
            <code className="font-mono">429</code> — over the rate limit, with{' '}
            <code className="font-mono">retryAfterSeconds</code>.
          </li>
          <li>
            <code className="font-mono">500</code> — the gateway itself failed. A provider being
            down is <em>not</em> a 500: the response still arrives, and the failing feed is named in
            the source health it carries. An absent source is reported, never hidden.
          </li>
        </ul>
      </section>

      <footer className="border-t pt-6 text-sm text-muted-foreground">
        <Link href="/" className="underline">
          Back to Lambda
        </Link>
        <span className="px-2">·</span>
        <Link href="/pricing" className="underline">
          Pricing
        </Link>
        <span className="px-2">·</span>
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </footer>
    </main>
  )
}
