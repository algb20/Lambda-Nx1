import { NextResponse } from 'next/server'
import { getWorldEvents } from '@/lib/modules/world-events'
import { rankByBand, scoreAllCountries, scoreCountry } from '@/lib/analysis/country-risk'
import { watchAllCorridors } from '@/lib/analysis/corridors'

/**
 * GET /api/countries — country instability, and how well each country is seen.
 *
 * `?iso=YE` returns one country's full dossier (every component, every blind
 * spot). Without it, the world ranking arrives **in observability bands** rather
 * than as one list, because one list is itself the claim that every row is
 * comparable with every other — and across countries seen through very
 * different amounts of coverage, it is not.
 *
 * `?corridors=1` adds the critical-corridor watch, which reads the same events
 * against a different question: not whether a country is unstable, but whether
 * a place the world's traffic cannot bypass is under pressure.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const iso = params.get('iso')?.trim().toUpperCase()

  try {
    const world = await getWorldEvents()
    // Both placed and unplaced events carry a country, and an event without a
    // coordinate is still evidence about the country it names — dropping it
    // here would make thinly mapped countries look quieter than they are.
    const signals = [...world.events, ...world.unplaceable]
    const now = Date.parse(world.generatedAt) || Date.now()

    if (iso) {
      return NextResponse.json({
        generatedAt: world.generatedAt,
        country: scoreCountry(signals, iso, now),
      })
    }

    const risks = scoreAllCountries(signals, now)
    return NextResponse.json({
      generatedAt: world.generatedAt,
      counted: risks.length,
      /**
       * Stated in the payload, not only in the docs: an API that returns a
       * ranking without saying what the ranking is made of invites exactly the
       * misreading this whole module exists to prevent.
       */
      method:
        'Two independent numbers per country. `signal` is what public sources reported, weighted by how much each category bears on stability, lifted by severity, decayed by age. `observability` is how well we can see the country at all — independent origins first, then distinct sources, then volume. They are never combined, and countries are grouped into bands within which comparison is honest. A low signal in a thinly observed band means we cannot see the country, never that it is calm.',
      bands: rankByBand(risks),
      ...(params.get('corridors') ? { corridors: watchAllCorridors(world.events, now) } : {}),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Country scoring failed' },
      { status: 502 },
    )
  }
}
