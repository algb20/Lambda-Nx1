import { describe, expect, it } from 'vitest'
import { LIVE_WITHIN_HOURS, assessLiveness, endpointFor, readStations } from './broadcasts'

const NOW = Date.parse('2026-08-20T12:00:00Z')
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()

/** The shape the catalogue really returns, taken from a live response. */
const station = (over: Record<string, unknown> = {}) => ({
  stationuuid: 'uuid-1',
  name: 'France Info',
  url_resolved: 'https://stream.example.org/franceinfo',
  homepage: 'https://www.franceinfo.fr',
  countrycode: 'FR',
  country: 'France',
  state: '',
  language: 'french',
  tags: 'news,talk',
  codec: 'MP3',
  bitrate: 128,
  hls: 0,
  geo_lat: 48.85,
  geo_long: 2.35,
  lastcheckok: 1,
  lastcheckoktime_iso8601: ago(217 * 24),
  lastchecktime_iso8601: ago(217 * 24),
  clicktimestamp_iso8601: ago(0.1),
  clickcount: 500,
  ...over,
})

describe('how we know a stream works', () => {
  /**
   * The measurement that reshaped this gateway. The catalogue's own health flag
   * looked authoritative; reading the raw data showed **every check timestamp
   * was 217 days old** — its checker had stopped months earlier and the flag was
   * frozen at whatever it last saw. Meanwhile `clicktimestamp` was minutes old.
   */
  it('prefers a listener opening it over a months-old probe', () => {
    const live = assessLiveness(ago(0.1), ago(217 * 24), NOW)
    expect(live.basis).toBe('opened')
    expect(live.says).toContain('a listener opened it')
    expect(live.says).toContain('minutes ago')
  })

  it('falls back to the probe when that is the only recent evidence', () => {
    const live = assessLiveness(null, ago(2), NOW)
    expect(live.basis).toBe('checked')
    expect(live.says).toContain('probe answered')
  })

  /** "Live" about January, presented as now, is the failure this prevents. */
  it('calls old evidence stale rather than live', () => {
    const live = assessLiveness(ago(400), ago(500), NOW)
    expect(live.basis).toBe('stale')
    expect(live.says).toContain('not known to be working now')
    expect(live.says).toContain('days ago')
  })

  it('says plainly when there is no evidence at all', () => {
    const live = assessLiveness(null, null, NOW)
    expect(live.basis).toBe('stale')
    expect(live.ageHours).toBe(Infinity)
    expect(live.says).toContain('no evidence')
  })

  it('puts the boundary where the constant says', () => {
    expect(assessLiveness(ago(LIVE_WITHIN_HOURS - 1), null, NOW).basis).toBe('opened')
    expect(assessLiveness(ago(LIVE_WITHIN_HOURS + 1), null, NOW).basis).toBe('stale')
  })

  it('always states an age, never a bare claim', () => {
    for (const live of [
      assessLiveness(ago(0.05), null, NOW),
      assessLiveness(null, ago(5), NOW),
      assessLiveness(ago(300), null, NOW),
    ]) {
      expect(live.says).toMatch(/minutes ago|hours ago|days ago/)
    }
  })

  it('ignores a timestamp it cannot parse rather than treating it as now', () => {
    expect(assessLiveness('not a date', null, NOW).basis).toBe('stale')
  })
})

describe('reading the catalogue', () => {
  it('reads a station with everything it carries', () => {
    const [s] = readStations([station()], NOW)
    expect(s.name).toBe('France Info')
    expect(s.countryIso).toBe('FR')
    expect(s.languages).toEqual(['french'])
    expect(s.tags).toEqual(['news', 'talk'])
    expect(s.bitrate).toBe(128)
    expect(s.lat).toBe(48.85)
    expect(s.liveness.basis).toBe('opened')
  })

  it('drops an entry the catalogue records as failing', () => {
    expect(readStations([station({ lastcheckok: 0 })], NOW)).toHaveLength(0)
  })

  it('drops an entry with no evidence of ever working', () => {
    const dead = station({
      lastcheckoktime_iso8601: null,
      lastchecktime_iso8601: null,
      clicktimestamp_iso8601: null,
    })
    expect(readStations([dead], NOW)).toHaveLength(0)
  })

  /** A link a browser cannot open is a link that fails in the reader's hands. */
  it('drops a stream whose URL is not http', () => {
    expect(readStations([station({ url_resolved: 'rtsp://x/y', url: '' })], NOW)).toHaveLength(0)
  })

  /**
   * 0/0 is the catalogue's "no location". Plotting it puts a French radio
   * station in the Gulf of Guinea.
   */
  it('treats a zero coordinate as unknown rather than as a place', () => {
    const [s] = readStations([station({ geo_lat: 0, geo_long: 0 })], NOW)
    expect(s.lat).toBeNull()
    expect(s.lon).toBeNull()
  })

  it('treats a zero bitrate as unknown rather than as silent', () => {
    expect(readStations([station({ bitrate: 0 })], NOW)[0].bitrate).toBeNull()
  })

  /** Best-evidenced first: a stream played ten minutes ago outranks a popular
   *  one whose only evidence is from January. */
  it('ranks by how well liveness is known, then by listeners', () => {
    const rows = readStations(
      [
        station({ stationuuid: 'stale-popular', clicktimestamp_iso8601: ago(400), clickcount: 9999 }),
        station({ stationuuid: 'fresh-quiet', clicktimestamp_iso8601: ago(0.2), clickcount: 3 }),
      ],
      NOW,
    )
    expect(rows.map((r) => r.id)).toEqual(['fresh-quiet', 'stale-popular'])
  })

  it('sorts by listeners within the same evidence band', () => {
    const rows = readStations(
      [
        station({ stationuuid: 'quiet', clickcount: 5 }),
        station({ stationuuid: 'busy', clickcount: 900 }),
      ],
      NOW,
    )
    expect(rows.map((r) => r.id)).toEqual(['busy', 'quiet'])
  })

  it('splits the comma-joined language and tag fields', () => {
    const [s] = readStations([station({ language: 'arabic, english', tags: 'news, ,talk' })], NOW)
    expect(s.languages).toEqual(['arabic', 'english'])
    expect(s.tags).toEqual(['news', 'talk'])
  })

  it('returns nothing for a body that is not a list', () => {
    expect(readStations(null, NOW)).toEqual([])
    expect(readStations({}, NOW)).toEqual([])
  })

  it('skips a nameless station rather than emitting a blank row', () => {
    expect(readStations([station({ name: '  ' })], NOW)).toHaveLength(0)
  })
})

describe('choosing the catalogue endpoint', () => {
  /**
   * A two-letter query is a country code. Searching it by name would match "GB"
   * inside "Radio GBH" — the same class of bug the venues gateway had.
   */
  it('sends a two-letter query to the country endpoint', () => {
    expect(endpointFor('sa', 50)).toContain('/bycountrycodeexact/SA')
    expect(endpointFor('GB', 50)).toContain('/bycountrycodeexact/GB')
  })

  it('sends anything longer to the name search', () => {
    expect(endpointFor('france info', 50)).toContain('/byname/france%20info')
  })

  it('returns the most-opened worldwide when nothing was asked for', () => {
    expect(endpointFor('', 50)).toContain('/topclick/50')
    expect(endpointFor('   ', 50)).toContain('/topclick/50')
  })

  it('asks the catalogue to hide entries it knows are broken', () => {
    expect(endpointFor('sa', 50)).toContain('hidebroken=true')
  })
})
