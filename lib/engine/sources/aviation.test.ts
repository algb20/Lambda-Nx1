import { describe, expect, it, vi } from 'vitest'
import { faaAirspaceStatus, faaUpdateTime } from './aviation'
import type { SourceContext, SourceInput } from '../types'

const INPUT: SourceInput = { capability: 'world_events', value: '' }

/**
 * A trimmed copy of the real document, keeping every structural quirk that
 * matters: the four delay types, the repeated `Airport Closures` section, and
 * the `Update_Time` format that `Date.parse` cannot read.
 */
const XML = `<AIRPORT_STATUS_INFORMATION><Update_Time>Fri Aug 14 23:58:22 2026 GMT</Update_Time>
<Dtd_File>http://www.fly.faa.gov/AirportStatus.dtd</Dtd_File>
<Delay_type><Name>Ground Stop Programs</Name><Ground_Stop_List>
  <Program><ARPT>DEN</ARPT><Reason>thunderstorms</Reason><End_Time>6:30 pm MDT</End_Time></Program>
</Ground_Stop_List></Delay_type>
<Delay_type><Name>Ground Delay Programs</Name><Ground_Delay_List>
  <Ground_Delay><ARPT>JFK</ARPT><Reason>airport volume</Reason><Avg>1 hour and 2 minutes</Avg><Max>2 hours and 27 minutes</Max></Ground_Delay>
</Ground_Delay_List></Delay_type>
<Delay_type><Name>General Arrival/Departure Delay Info</Name><Arrival_Departure_Delay_List>
  <Delay><ARPT>EWR</ARPT><Reason>TM Initiatives:MINIT:VOL</Reason><Arrival_Departure Type="Departure"><Min>46 minutes</Min><Max>1 hour</Max><Trend>Increasing</Trend></Arrival_Departure></Delay>
</Arrival_Departure_Delay_List></Delay_type>
<Delay_type><Name>Airport Closures</Name><Airport_Closure_List>
  <Airport><ARPT>PVD</ARPT><Reason>!PVD 08/055 PVD AD AP CLSD EXC HEL</Reason><Start>Aug 11 at 04:30 UTC.</Start><Reopen>Aug 22 at 09:45 UTC.</Reopen></Airport>
</Airport_Closure_List></Delay_type>
<Delay_type><Name>Airport Closures</Name><Airport_Closure_List>
  <Airport><ARPT>PVD</ARPT><Reason>!PVD 08/055 PVD AD AP CLSD EXC HEL</Reason><Start>Aug 11 at 04:30 UTC.</Start><Reopen>Aug 22 at 09:45 UTC.</Reopen></Airport>
</Airport_Closure_List></Delay_type>
</AIRPORT_STATUS_INFORMATION>`

function ctx(body: string, ok = true): SourceContext {
  return {
    fetch: vi.fn(async () => ({ ok, status: ok ? 200 : 503, text: async () => body })),
  } as unknown as SourceContext
}

describe('faaUpdateTime', () => {
  it("reads the FAA's own stamp", () => {
    expect(faaUpdateTime('Fri Aug 14 23:58:22 2026 GMT')).toBe('2026-08-14T23:58:22.000Z')
  })

  /**
   * The reason this function exists rather than a bare parse: without a zone,
   * V8 reads the date as local time, so the same document would produce
   * different timestamps on a laptop and on the deployed host.
   */
  it('assumes GMT when the FAA omits the zone, not the host offset', () => {
    expect(faaUpdateTime('Fri Aug 14 23:58:22 2026')).toBe('2026-08-14T23:58:22.000Z')
  })

  it('returns null rather than a guess when there is no stamp', () => {
    expect(faaUpdateTime(null)).toBeNull()
    expect(faaUpdateTime('whenever')).toBeNull()
  })
})

describe('faaAirspaceStatus', () => {
  it('reads all four programme types out of the bespoke XML', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    const labels = evidence.map((e) => (e.data as { categoryLabel: string }).categoryLabel)
    expect(labels).toContain('Ground stop')
    expect(labels).toContain('Ground delay')
    expect(labels).toContain('Arrival/departure delay')
    expect(labels).toContain('Airport closure')
  })

  it('grades the FAA reporting its own orders as A/1', async () => {
    const [first] = await faaAirspaceStatus.run(INPUT, ctx(XML))
    expect(first.admiralty).toEqual({ source: 'A', info: 1 })
    expect(first.confidence).toBe('confirmed')
  })

  /**
   * The FAA repeats the whole `Airport Closures` section once per closed
   * field. Emitted twice, one closure would read as two independent
   * confirmations — the exact inflation the fusion layer exists to prevent.
   */
  it('collapses the duplicated closure sections into one finding', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    const closures = evidence.filter(
      (e) => (e.data as { categoryLabel: string }).categoryLabel === 'Airport closure',
    )
    expect(closures).toHaveLength(1)
  })

  it('ranks a closure above a delay, using the authority’s own action', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    const sev = (label: string) =>
      (
        evidence.find((e) => (e.data as { categoryLabel: string }).categoryLabel === label)
          ?.data as { assignedSeverity: number }
      ).assignedSeverity
    expect(sev('Airport closure')).toBeGreaterThan(sev('Ground stop'))
    expect(sev('Ground stop')).toBeGreaterThan(sev('Ground delay'))
    expect(sev('Ground delay')).toBeGreaterThan(sev('Arrival/departure delay'))
  })

  it('quotes the numbers an operator needs, not just an average', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    const jfk = evidence.find((e) => e.claim.startsWith('JFK'))!
    expect(jfk.claim).toContain('avg 1 hour and 2 minutes')
    expect(jfk.claim).toContain('max 2 hours and 27 minutes')
    const ewr = evidence.find((e) => e.claim.startsWith('EWR'))!
    expect(ewr.claim).toContain('46 minutes–1 hour')
    expect(ewr.claim).toContain('increasing')
  })

  /**
   * The feed names airports by code and nothing else. A coordinate here would
   * have to be invented, and a confidently misplaced ground stop is worse than
   * an unplaced one.
   */
  it('places findings by country and never invents a coordinate', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    for (const e of evidence) {
      const d = e.data as Record<string, unknown>
      expect(d.lat).toBeUndefined()
      expect(d.lon).toBeUndefined()
      expect(d.country).toBe('United States of America')
    }
  })

  it('carries the document time onto every finding', async () => {
    const evidence = await faaAirspaceStatus.run(INPUT, ctx(XML))
    expect(evidence.every((e) => e.publishedAt === '2026-08-14T23:58:22.000Z')).toBe(true)
  })

  it('surfaces a failed request instead of reporting a quiet airspace', async () => {
    await expect(faaAirspaceStatus.run(INPUT, ctx('', false))).rejects.toThrow(/503/)
  })

  it('returns nothing when the FAA reports no delays at all', async () => {
    const quiet = '<AIRPORT_STATUS_INFORMATION><Update_Time>Fri Aug 14 23:58:22 2026 GMT</Update_Time></AIRPORT_STATUS_INFORMATION>'
    expect(await faaAirspaceStatus.run(INPUT, ctx(quiet))).toEqual([])
  })
})
