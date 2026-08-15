import { API_GROUPS, RATE_LIMIT, allEndpoints } from '@/lib/api-catalog'
import { PLAN_LIST, TIERS_ENFORCED } from '@/lib/plans/plans'
import { CATALOG, activeSources } from '@/lib/engine/catalog'
import { allSourceCatalog } from '@/lib/engine/sources'

/**
 * `/llms.txt` — the product, described for machines.
 *
 * ## Why this exists
 *
 * We found it by being on the receiving end of one. Reading a competitor's
 * product had failed for months: their dashboard is client-rendered, our fetch
 * executes no JavaScript, and every attempt returned a marketing shell. Then
 * their own `404` body pointed at an OpenAPI spec, and `/llms.txt` turned out to
 * describe the entire product — architecture, counts, endpoints, tiers — in
 * plain text, with no browser, no account and no key.
 *
 * A platform that publishes for agents gets read by agents. Ours had nothing,
 * so an agent asked to evaluate intelligence platforms could describe every
 * competitor and not us.
 *
 * ## Why it is generated rather than written
 *
 * Every number below comes from the definition the product enforces — the API
 * catalogue, the plan table, the source catalogue — and `lib/api-catalog.test.ts`
 * already asserts the first of those against the filesystem in both directions.
 * A hand-written version of this file would be a second copy of facts that
 * change, which is the failure mode we watched a competitor's own docs avoid
 * only because they generate theirs too.
 *
 * Counted per charter §2a: integrations are providers we call and parse, never
 * the far larger number of publishers reachable through them.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function planLines(): string {
  return PLAN_LIST.map((p) => {
    const price =
      p.price.usd === 0 && p.price.pi === 0
        ? 'Free'
        : `${p.price.pi} PI or $${p.price.usd}/${p.price.interval}`
    return [
      `### ${p.name}`,
      ``,
      `- Price: ${price}`,
      `- Signup required: ${p.id === 'free' ? 'No' : 'Yes'}`,
      `- Limits: ${p.limits.dailyInvestigations} investigations/day, ${p.limits.monitors} monitor${p.limits.monitors === 1 ? '' : 's'}`,
      `- Unlocks: ${p.features.join(', ')}`,
    ].join('\n')
  }).join('\n\n')
}

function endpointLines(): string {
  return API_GROUPS.map((g) => {
    const rows = g.endpoints
      .map((e) => {
        const body = e.params
          ? ` — body: {"${e.params[0].name}": "${e.params[0].example}"}`
          : ''
        return `- \`${e.method} ${e.path}\` — ${e.title}. ${e.description}${body}`
      })
      .join('\n')
    return `### ${g.title}\n\n${g.description}\n\n${rows}`
  }).join('\n\n')
}

export async function GET(): Promise<Response> {
  const integrations = CATALOG.length
  const active = activeSources().length
  const coded = allSourceCatalog.length

  const body = `# Lambda NX

> A multi-gateway OSINT and intelligence-analysis platform. Every finding carries
> the source that made it, when the source published it, when we fetched it, an
> Admiralty rating and a confidence grade — so any claim can be checked rather
> than believed.

Lambda NX is an *analysis* product, not a data dump. Its value is in pivoting,
verification, confidence grading and documentation. It runs as a Pi Network app
and as a standalone web app from one codebase.

## What makes it different from the rest of the field

- **Corroboration is counted by independent origin, not by outlet.** Twenty
  newsrooms carrying one wire is **one** confirmation, and the product says so.
  This is the single deepest difference between Lambda NX and every comparable
  platform surveyed; the others count sources.
- **Severity is never invented.** It is derived only where a real measure exists
  — an earthquake magnitude, a burned area, an agency's own alert level.
  Everything else is reported as \`unscored\`, which is a distinct state from
  "low", because a week nobody measured must not render as a calm week.
- **Publication time and retrieval time are separate fields**, and a missing
  publication date is reported as missing rather than filled in with "now".
- **Absence is reported.** A feed that answers with nothing shows as \`empty\`,
  not green; a feed that stopped publishing years ago is detected and named; and
  where we have no coverage at all, the coverage layer draws it.
- **The platform diagnoses itself in public** at \`GET /api/diagnose\` — which
  feeds are failing and why, whether one category is drowning the board, and
  whether events carry a source-stated time. A platform that cannot be checked
  cannot be trusted.
- **Passive only.** The engine never sends a packet to the subject of an
  investigation. No scanning, no probing — enforced by a guardrail in code, not
  promised in marketing.

## Scale, counted honestly

Competitors quote figures that mix three different things. These are separated,
always:

- **Integrations — ${integrations} declared, ${active} active.** Distinct
  providers we call and parse, plus ${coded} coded source modules.
- **Publishers** — the outlets and registries reachable *through* those
  integrations — number in the tens of thousands. That figure is legitimate only
  when labelled, and it is never quoted as an integration count.
- **Independent origins** — how many of those are genuinely not copies of one
  another. Far smaller than either, and the only number that enters a confidence
  score.

## API

${RATE_LIMIT.requests} requests per ${RATE_LIMIT.windowSeconds} seconds per
caller, no key and no account required. Every response carries
${RATE_LIMIT.headers.join(', ')}. Over the limit answers \`429\` with
\`retryAfterSeconds\`.

**Overage is never silently charged.** Exceeding a limit is rejected, not
billed. If metered overage is ever introduced it will be documented here first.

${allEndpoints().length} public endpoints:

${endpointLines()}

Full reference: https://lambdanx.app/docs/api

## Plans

${TIERS_ENFORCED ? '' : '**Tiers are defined but not yet enforced** — everything currently runs on the free tier.\n\n'}${planLines()}

Machine-readable pricing: https://lambdanx.app/pricing.md
Human pricing page: https://lambdanx.app/pricing

## Guardrails, which are not negotiable

- Public and lawful data only. Availability is not permission; robots.txt, terms
  of service and rate limits are respected.
- No private-individual targeting, no mass personal surveillance, no stalking.
  The product monitors public signals — domains, infrastructure, breaches, brand
  mentions — on demand.
- No breach-data hoarding. Exposure checks answer yes or no; credentials are
  never returned or stored.
- Data minimisation, documented purpose, deletion supported.

## Source

https://github.com/algb20/Lambda-Nx1
`

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}
