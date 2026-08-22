import { describe, expect, it, vi } from 'vitest'
import { basin, decodeEntities, isInlandStation, maritimeConditions, parseLatestObservations, parseStations, seaState } from './maritime'
import type { SourceContext, SourceInput } from '../types'

/**
 * The maritime gateway, against the exact bytes NOAA publishes.
 *
 * The fixture is a real slice of `latest_obs.txt`, including the two things a
 * naive reader gets wrong: the `MM` sentinel where an instrument had nothing to
 * say, and the fact that the columns are positional — so a value read one place
 * out reports the sea temperature as the air temperature and nothing complains.
 */
const OBS = `#STN       LAT      LON  YYYY MM DD hh mm WDIR WSPD   GST WVHT  DPD APD MWD   PRES  PTDY  ATMP  WTMP  DEWP  VIS   TIDE
#text      deg      deg   yr mo day hr mn degT  m/s   m/s   m   sec sec degT   hPa   hPa  degC  degC  degC  nmi     ft
22101    37.24   126.02  2026 08 21 23 00 130   8.0    MM  0.0   0   MM  MM     MM    MM  25.5  25.9    MM   MM     MM
46006    40.75  -137.44  2026 08 21 22 50 300  12.0  15.0  7.2  13  10 295  1011.2  -1.2  14.1  15.0  11.0  MM     MM
41049    27.49   -62.94  2026 08 21 23 00  90   5.0   6.0  1.4   8   6  95  1015.0   0.3  27.0  28.4  24.0 10.0     MM
51000    23.53  -153.79  2026 08 21 22 30 070   6.0   7.0  2.1   9   7  60  1016.0   0.1  26.0  26.5  22.0  MM     MM
BADROW 1 2 3`

const STATIONS = `<?xml version="1.0" encoding="utf-8"?><stations created="2026-08-22T00:31:42UTC" count="4">
  <station id="22101" lat="37.24" lon="126.02" name="Korea South" owner="KMA" pgm="International Partners" type="buoy" dart="n"/>
  <station id="46006" lat="40.75" lon="-137.44" name="Sea State" owner="NDBC" pgm="Weather buoy" type="buoy" dart="n"/>
  <station id="51000" lat="23.53" lon="-153.79" name="Northern Hawaii One" owner="NDBC" pgm="DART" type="dart" dart="y"/>
  <station id="45141" lat="61.5" lon="-114.0" elev="156.0" name="Great Slave Lake" owner="ECCC" pgm="IOOS Partners" type="buoy" dart="n"/>
  <station id="62114" lat="58.3" lon="0.0" elev="0" name="Tartan &quot;A&quot; AWS" owner="Private Industry Oil &amp; Gas" pgm="International Partners" type="fixed" dart="n"/>
</stations>`

function ctxOf(
  handler: (url: string) => { ok?: boolean; status?: number; text?: string },
): SourceContext {
  return {
    fetch: vi.fn(async (url: string) => {
      const r = handler(url)
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        text: async () => r.text ?? '',
      } as unknown as Response
    }),
  } as unknown as SourceContext
}

const both = ctxOf((url) => ({ text: url.includes('activestations') ? STATIONS : OBS }))
const ask = (value: string): SourceInput => ({ value }) as SourceInput

describe('reading what the instrument actually said', () => {
  it('reads every column by position, not by hope', () => {
    // Station 46006: the one row with a full set. A one-column slip here would
    // print the sea temperature under the air temperature's name and nothing
    // would ever complain — the ECB yield curve shipped exactly that bug.
    const o = parseLatestObservations(OBS).find((x) => x.station === '46006')!
    expect(o).toMatchObject({
      lat: 40.75,
      lon: -137.44,
      windDirection: 300,
      windSpeed: 12,
      windGust: 15,
      waveHeight: 7.2,
      wavePeriod: 13,
      pressure: 1011.2,
      pressureTendency: -1.2,
      airTemp: 14.1,
      waterTemp: 15,
    })
  })

  it('treats MM as absent rather than as zero', () => {
    // `MM` is NOAA saying the instrument had nothing to report. Reading it as 0
    // would put a dead anemometer on the board as a dead calm.
    const o = parseLatestObservations(OBS).find((x) => x.station === '22101')!
    expect(o.windGust).toBeNull()
    expect(o.pressure).toBeNull()
    expect(o.visibility).toBeNull()
    // And a genuine zero stays a zero.
    expect(o.waveHeight).toBe(0)
  })

  it('carries the buoy’s own UTC timestamp, never ours', () => {
    const o = parseLatestObservations(OBS).find((x) => x.station === '46006')!
    expect(o.at).toBe('2026-08-21T22:50:00.000Z')
  })

  it('drops a truncated line instead of guessing which columns survived', () => {
    const stations = parseLatestObservations(OBS).map((o) => o.station)
    expect(stations).not.toContain('BADROW')
    expect(stations).toHaveLength(4)
  })

  it('reads the station register, including which buoys watch for tsunamis', () => {
    const s = parseStations(STATIONS)
    expect(s).toHaveLength(5)
    expect(s.find((x) => x.id === '51000')).toMatchObject({
      name: 'Northern Hawaii One',
      owner: 'NDBC',
      dart: true,
    })
    expect(s.find((x) => x.id === '46006')?.dart).toBe(false)
  })
})

describe('saying how rough it is in words a mariner uses', () => {
  it('follows the WMO sea-state code rather than a scale we invented', () => {
    expect(seaState(0.05)).toContain('calm')
    expect(seaState(1.0)).toBe('slight')
    expect(seaState(3.0)).toBe('rough')
    expect(seaState(7.2)).toBe('high')
    expect(seaState(15)).toBe('phenomenal')
  })

  /**
   * Every coordinate below is a real station from the live feed, and the first
   * version of `basin` got three of them wrong — it put **Guam, Yap and Palau
   * in the Indian Ocean**, three thousand kilometres from it, because it used
   * one longitude band for an ocean whose eastern limit moves with latitude.
   */
  it('puts a reading in the ocean it is actually in', () => {
    expect(basin(40.75, -137.44)).toBe('Pacific Ocean') // NDBC 46006
    expect(basin(34.5, -120.8)).toBe('Pacific Ocean') // Harvest, California
    expect(basin(23.53, -153.79)).toBe('Pacific Ocean') // Northern Hawaii One
    expect(basin(-14.3, -170.5)).toBe('Pacific Ocean') // Aunuu, American Samoa
    expect(basin(13.4, 144.7)).toBe('Pacific Ocean') // Guam
    expect(basin(9.7, 138.2)).toBe('Pacific Ocean') // Rumung, Yap
    expect(basin(7.6, 134.7)).toBe('Pacific Ocean') // Ngaraard, Palau
    expect(basin(34.0, 127.5)).toBe('Pacific Ocean') // Korean waters
    expect(basin(39.8, -73.8)).toBe('Atlantic Ocean') // Barnegat, New Jersey
    expect(basin(27.49, -62.94)).toBe('Atlantic Ocean')
    expect(basin(18.5, -66.7)).toBe('Atlantic Ocean') // Arecibo, Puerto Rico
    expect(basin(50.1, -6.1)).toBe('Atlantic Ocean') // Sevenstones, Celtic Sea
    expect(basin(59.5, 1.5)).toBe('North Sea & Baltic') // Beryl A
    expect(basin(51.1, 1.8)).toBe('North Sea & Baltic') // Sandettie, Dover Strait
    expect(basin(-20, 60)).toBe('Indian Ocean')
    expect(basin(15, 65)).toBe('Indian Ocean') // Arabian Sea
    expect(basin(36, 15)).toBe('Mediterranean & Black Sea')
    expect(basin(75, 10)).toBe('Arctic Ocean')
    expect(basin(-65, 0)).toBe('Southern Ocean')
  })

  it('divides the Atlantic from the Pacific along the continents, not one meridian', () => {
    // At 40°N North America is wide, so the divide is past -100; at 40°S the
    // southern cone is narrow and it sits at -70. One cut misplaces one coast
    // or the other, whichever cut you choose.
    expect(basin(40, -125)).toBe('Pacific Ocean')
    expect(basin(40, -70)).toBe('Atlantic Ocean')
    expect(basin(-40, -75)).toBe('Pacific Ocean')
    expect(basin(-40, -55)).toBe('Atlantic Ocean')
  })

  it('survives a longitude outside -180..180 rather than inventing an ocean', () => {
    expect(basin(0, 190)).toBe(basin(0, -170))
    expect(basin(0, -190)).toBe(basin(0, 170))
  })
})

describe('the register, read as XML rather than as text', () => {
  it('decodes the entities a name actually contains', () => {
    // The live board showed a North Sea platform as `Tartan &quot;A&quot; AWS`.
    expect(decodeEntities('Tartan &quot;A&quot; AWS')).toBe('Tartan "A" AWS')
    expect(decodeEntities('Private Industry Oil &amp; Gas')).toBe('Private Industry Oil & Gas')
    // `&amp;` is decoded last, so an escaped entity stays escaped rather than
    // becoming a character that was never in the register.
    expect(decodeEntities('&amp;quot;')).toBe('&quot;')
  })

  it('keeps the elevation, which is what tells a lake from a sea', () => {
    const s = parseStations(STATIONS)
    expect(s.find((x) => x.id === '45141')?.elevation).toBe(156)
    expect(s.find((x) => x.id === '22101')?.elevation).toBeNull()
  })
})

describe('telling a lake from a sea', () => {
  const station = (over: Partial<ReturnType<typeof parseStations>[number]>) => ({
    id: '00000', name: 'x', owner: 'x', programme: '', type: '', lat: 0, lon: 0,
    elevation: null, dart: false, ...over,
  })

  /**
   * Real elevations from the live register. Elevation alone cannot do this —
   * Lake Champlain at 30 m sits *below* a dozen genuine Alaskan sea stations —
   * which is why the `45xxx` block, NDBC's own inland series, is read too.
   */
  it('keeps coastal lights at sea', () => {
    expect(isInlandStation(station({ id: 'cspa2', elevation: 25 }))).toBe(false) // Cape Spencer, AK
    expect(isInlandStation(station({ id: 'sgxa2', elevation: 60 }))).toBe(false) // St George, AK
    expect(isInlandStation(station({ id: 'mdxa2', elevation: 43.3 }))).toBe(false) // Middleton Island, AK
  })

  it('puts the lakes inland, including the ones lower than the sea stations', () => {
    expect(isInlandStation(station({ id: '45012', elevation: 74.7 }))).toBe(true) // Lake Ontario
    expect(isInlandStation(station({ id: '45166', elevation: 30 }))).toBe(true) // Lake Champlain — below Alaska
    expect(isInlandStation(station({ id: 'lmfs1', elevation: 107.9 }))).toBe(true) // Lake Murray, SC
    expect(isInlandStation(station({ id: '45141', elevation: 156 }))).toBe(true) // Great Slave Lake
  })

  it('does not guess when the register states no elevation', () => {
    expect(isInlandStation(station({ id: '41049', elevation: null }))).toBe(false)
    expect(isInlandStation(undefined)).toBe(false)
  })
})

describe('the gateway', () => {
  it('names the station rather than printing a five-digit code', async () => {
    const claims = (await maritimeConditions.run(ask(''), both)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('Sea State (46006)'))).toBe(true)
    // An unregistered station is still reported, under its number.
    expect(claims.some((c) => c.includes('Station 41049'))).toBe(true)
    // And a blank or self-referential register name never produces a row that
    // begins with a space, which is what the live board actually showed for
    // several international partner stations.
    expect(claims.every((c) => c.trim() === c && !c.startsWith('('))).toBe(true)
  })

  it('does not print a station identifier twice when the register has no real name', async () => {
    const ctx = ctxOf((url) => ({
      text: url.includes('activestations')
        ? '<stations><station id="22101" lat="37.24" lon="126.02" name="" owner="KMA" dart="n"/></stations>'
        : OBS,
    }))
    const claims = (await maritimeConditions.run(ask(''), ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.startsWith('Station 22101'))).toBe(true)
    expect(claims.some((c) => c.includes('22101 (22101)'))).toBe(false)
  })

  it('leads with the roughest sea being measured, not the lowest station number', async () => {
    const out = await maritimeConditions.run(ask(''), both)
    const rough = out.filter((e) => (e.data as { group: string }).group === 'Roughest seas now measured')
    expect(rough[0]?.claim).toContain('46006')
    expect(rough[0]?.claim).toContain('7.2 m — high')
  })

  it('reports wind at sea in knots, because that is the unit at sea', async () => {
    const out = await maritimeConditions.run(ask(''), both)
    const e = out.find((x) => x.claim.includes('46006'))!
    // 12 m/s is 23 kn; 15 m/s gusting is 29 kn.
    expect(e.claim).toContain('wind 23 kn, gusting 29')
  })

  it('marks the tsunami network, which is the one class whose presence is the story', async () => {
    const out = await maritimeConditions.run(ask(''), both)
    const dart = out.find((e) => (e.data as { group: string }).group === 'Tsunami detection network (DART)')
    expect(dart?.claim).toContain('tsunami buoy')
    expect(dart?.claim).toContain('Northern Hawaii One')
  })

  it('searches the name, the owner and the number — the three things a person knows', async () => {
    for (const q of ['hawaii', 'kma', '41049']) {
      const out = await maritimeConditions.run(ask(q), both)
      const matched = out.filter((e) => (e.data as { group: string }).group.startsWith('Stations matching'))
      expect(matched.length, `no match for "${q}"`).toBeGreaterThan(0)
    }
  })

  it('carries coordinates, so every reading is also a point on the globe', async () => {
    const out = await maritimeConditions.run(ask(''), both)
    const e = out.find((x) => x.claim.includes('46006'))!
    expect(e.data).toMatchObject({ lat: 40.75, lon: -137.44 })
  })

  it('grades a buoy measuring its own sea as an observation, not a report', async () => {
    const out = await maritimeConditions.run(ask(''), both)
    expect(out[0]?.admiralty).toEqual({ source: 'A', info: 1 })
    expect(out[0]?.confidence).toBe('confirmed')
  })

  it('still reports the readings when the station register fails', async () => {
    // The register is an enrichment. Losing it should cost the reader the
    // station names, not the observations.
    const ctx = ctxOf((url) =>
      url.includes('activestations') ? { ok: false, status: 503 } : { text: OBS },
    )
    const out = await maritimeConditions.run(ask(''), ctx)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((e) => e.claim.startsWith('Station '))).toBe(true)
  })

  it('fails loudly when the observations themselves cannot be fetched', async () => {
    // An empty board must never be readable as a calm sea.
    await expect(
      maritimeConditions.run(ask(''), ctxOf((url) => (url.includes('latest_obs') ? { ok: false, status: 500 } : { text: STATIONS }))),
    ).rejects.toThrow(/500/)
  })

  it('does not file a lake under an ocean', async () => {
    // The live board put **Lake Winnipeg in the Atlantic Ocean**. NDBC's network
    // carries the Great Lakes and reservoirs as far inland as Lake Murray, and
    // confident nonsense on one row costs the reader their trust in every other.
    const obs = `${OBS}\n45141    61.50  -114.00  2026 08 21 23 00 200   6.0   8.0  0.4   3  MM  MM  1013.0   0.1  18.0  17.0    MM   MM     MM`
    const ctx = ctxOf((url) => ({ text: url.includes('activestations') ? STATIONS : obs }))
    const out = await maritimeConditions.run(ask(''), ctx)
    const lake = out.find((e) => e.claim.includes('Great Slave Lake'))
    expect((lake?.data as { group: string }).group).toBe('Lakes & inland waters')
    // And it does not compete in "roughest seas" either: a reservoir with a
    // metre of chop is not one of the roughest seas on earth.
    expect(out.every((e) => !(e.claim.includes('Great Slave') && (e.data as { group: string }).group !== 'Lakes & inland waters'))).toBe(true)
  })

  it('shows a platform’s real name, not its XML escaping', async () => {
    const obs = `${OBS}\n62114    58.30     0.00  2026 08 21 23 00 200   8.5    MM   MM  MM  MM  MM  1018.0   0.1  10.8    MM    MM   MM     MM`
    const ctx = ctxOf((url) => ({ text: url.includes('activestations') ? STATIONS : obs }))
    const claims = (await maritimeConditions.run(ask(''), ctx)).map((e) => e.claim)
    expect(claims.some((c) => c.includes('Tartan "A" AWS'))).toBe(true)
    expect(claims.every((c) => !c.includes('&quot;'))).toBe(true)
  })

  it('reads passively, from one declared host', () => {
    expect(maritimeConditions.passive).toBe(true)
    expect(maritimeConditions.hosts).toEqual(['www.ndbc.noaa.gov'])
  })
})
