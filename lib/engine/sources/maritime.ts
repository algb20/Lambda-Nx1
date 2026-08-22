/**
 * Maritime & ocean — the half of transport that was never built.
 *
 * ## The gap this closes
 *
 * `docs/OSINT_REFERENCE.md` §2.7 pairs aviation and maritime in one section
 * because they are one question: where are the things that move, and what
 * conditions are they moving through. We built aviation — OpenSky flights, FAA
 * airspace status — and never built the other half. So the platform could tell
 * you where an aircraft was and had **nothing whatever** to say about the sea,
 * which carries roughly ninety per cent of world trade.
 *
 * ## Why NOAA's buoy network, and not ship tracking
 *
 * The obvious maritime gateway is AIS: live vessel positions. We checked, and
 * every route to it — aisstream, Global Fishing Watch, the commercial
 * aggregators — requires a key or a commercial agreement. There is no keyless
 * one. That is recorded in `docs/GATEWAY-MAP.md` rather than papered over.
 *
 * What *is* open, and is better evidence than a vessel position anyway, is the
 * **National Data Buoy Center**: 1,351 active stations, of which around 850
 * report at any moment, each measuring the sea it floats in. Wave height and
 * period, wind and gust, pressure and its tendency, air and water temperature —
 * with coordinates, so every reading is also a point on the globe.
 *
 * ## Why these are graded A/1
 *
 * A buoy measuring a wave is an **instrument reading**, not a report about one.
 * It sits with the USGS seismometers and the NOAA space-weather scales, not
 * with the outlets that write about storms. The distinction is the whole
 * Admiralty discipline: this source did not hear that the sea was rough, it
 * was there.
 *
 * ## §3
 *
 * Read-only, keyless, passive. NOAA publishes these files precisely to be
 * fetched, and nothing here touches a vessel, a person or a private facility.
 */
import type { Evidence, Source, SourceContext, SourceInput } from '../types'
import { expectOk } from '../fetch-guard'

const NDBC = 'https://www.ndbc.noaa.gov'

/** NDBC writes `MM` where an instrument had nothing to report. */
function value(raw: string | undefined): number | null {
  if (!raw || raw === 'MM') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export interface Observation {
  station: string
  lat: number
  lon: number
  at: string | null
  /** Significant wave height, metres. */
  waveHeight: number | null
  /** Dominant wave period, seconds. */
  wavePeriod: number | null
  /** Wind speed and gust, metres per second. */
  windSpeed: number | null
  windGust: number | null
  windDirection: number | null
  /** Sea-level pressure, hPa, and its three-hour tendency. */
  pressure: number | null
  pressureTendency: number | null
  airTemp: number | null
  waterTemp: number | null
  visibility: number | null
}

/**
 * The fixed-width table NOAA publishes, read by column position.
 *
 * Two header lines name the columns and their units, then one line per station.
 * Splitting on whitespace is safe here and only here: every field is either a
 * number or the literal `MM`, so no value can contain a space. A station
 * identifier is never blank, which is what makes the first column a reliable
 * anchor.
 */
export function parseLatestObservations(text: string): Observation[] {
  const out: Observation[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const f = line.trim().split(/\s+/)
    // Through the tide column; a truncated line is a broken row, not a station
    // with missing data, and guessing which columns survived would misattribute
    // every figure after the break.
    if (f.length < 19) continue

    const [station, lat, lon, yyyy, mm, dd, hh, min] = f
    const latitude = value(lat)
    const longitude = value(lon)
    if (!station || latitude === null || longitude === null) continue

    /**
     * The publisher's own timestamp, in UTC, which NOAA states in the header.
     * Never our clock: a reading is the moment the instrument took it, and the
     * whole `retrievedAt` / `publishedAt` split exists so a stale buoy cannot
     * be mistaken for a live one.
     */
    const at =
      yyyy && mm && dd && hh && min
        ? `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:00.000Z`
        : null

    out.push({
      station,
      lat: latitude,
      lon: longitude,
      at: at && !Number.isNaN(Date.parse(at)) ? at : null,
      windDirection: value(f[8]),
      windSpeed: value(f[9]),
      windGust: value(f[10]),
      waveHeight: value(f[11]),
      wavePeriod: value(f[12]),
      pressure: value(f[15]),
      pressureTendency: value(f[16]),
      airTemp: value(f[17]),
      waterTemp: value(f[18]),
      visibility: value(f[20]),
    })
  }
  return out
}

/**
 * XML entity references, as they appear in the register.
 *
 * The live board showed a North Sea platform as `Tartan &quot;A&quot; AWS`,
 * because attribute values are XML and nothing decoded them. Five entities is
 * the whole of what a well-formed attribute may contain without a DTD, so this
 * is complete rather than a common-cases list — and `&amp;` is replaced last,
 * so `&amp;quot;` decodes to the literal `&quot;` rather than to a quotation
 * mark that was never there.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

export interface Station {
  id: string
  name: string
  owner: string
  programme: string
  type: string
  lat: number | null
  lon: number | null
  /**
   * Site elevation in metres above mean sea level, where the register states
   * it. This is what tells a lake from a sea: an instrument 156 m above mean
   * sea level is on Great Slave Lake, not in an ocean.
   */
  elevation: number | null
  /** A Deep-ocean Assessment and Reporting of Tsunamis buoy. */
  dart: boolean
}

/**
 * Telling a lake from a sea, using two signals the register itself supplies.
 *
 * ## Why one signal was not enough
 *
 * The first attempt used elevation alone at 100 m, and the live board still
 * filed **eleven Lake Ontario stations under the Atlantic Ocean**. Reading the
 * register's actual distribution showed why a single cut cannot work:
 *
 * | Elevation | What is actually there |
 * |---|---|
 * | 15–60 m | Alaskan coastal lights — Cape Spencer, St George, Cape Seniavin. **Ocean.** |
 * | 30 m | Lake Champlain. **Inland.** |
 * | 73–78 m | The whole Lake Ontario shore. **Inland.** |
 * | 85–183 m | Lake Wateree, Lake Murray, Strom Thurmond Dam, the upper Great Lakes, Great Slave Lake. **Inland.** |
 *
 * Lake Champlain sits *below* a dozen genuine sea stations, so no threshold
 * separates them. Two signals do, and both come from the register rather than
 * from a name we pattern-matched:
 *
 *  1. **Elevation above 65 m.** Higher than every ocean station in the register
 *     — the highest is St George at 60 m — and lower than Lake Ontario at 73 m.
 *     The gap is real and it is where the line belongs.
 *  2. **The `45xxx` identifier block**, which is NDBC's own Great Lakes and
 *     inland-waters series. That is the publisher's classification, not ours,
 *     and it catches Lake Champlain where elevation cannot.
 */
export const INLAND_ELEVATION_M = 65

/** NDBC's own series for the Great Lakes and inland waters. */
const INLAND_ID = /^45\d{3}$/

export function isInlandStation(station: Station | undefined): boolean {
  if (!station) return false
  if (INLAND_ID.test(station.id)) return true
  return station.elevation != null && station.elevation > INLAND_ELEVATION_M
}

/** The station register — who owns each instrument, and what it is. */
export function parseStations(xml: string): Station[] {
  const out: Station[] = []
  for (const m of xml.matchAll(/<station\s([^>]*?)\/?>/g)) {
    const attrs = new Map<string, string>()
    for (const a of m[1].matchAll(/([a-z]+)="([^"]*)"/g)) attrs.set(a[1], a[2])
    const id = attrs.get('id')
    if (!id) continue
    out.push({
      id,
      /**
       * A blank name is not a name. Several international partners publish
       * `name=""`, and `?? id` does not catch an empty string — so the board
       * showed rows reading `" (22103)"` with a leading space where the
       * station should have been.
       */
      name: decodeEntities(attrs.get('name') ?? '').trim() || id,
      owner: decodeEntities(attrs.get('owner') ?? '').trim() || 'Unknown',
      programme: attrs.get('pgm') ?? '',
      type: attrs.get('type') ?? '',
      lat: value(attrs.get('lat')),
      lon: value(attrs.get('lon')),
      elevation: value(attrs.get('elev')),
      dart: attrs.get('dart') === 'y',
    })
  }
  return out
}

/**
 * How rough the sea is, on the scale mariners actually use.
 *
 * The World Meteorological Organization's sea state code, keyed off
 * significant wave height. A bare number in metres means little to most
 * readers; "very rough" means something to everyone, and unlike a score we
 * invented, this one is the international standard and can be checked.
 */
export function seaState(waveHeightM: number): string {
  if (waveHeightM < 0.1) return 'calm (glassy)'
  if (waveHeightM < 0.5) return 'smooth'
  if (waveHeightM < 1.25) return 'slight'
  if (waveHeightM < 2.5) return 'moderate'
  if (waveHeightM < 4) return 'rough'
  if (waveHeightM < 6) return 'very rough'
  if (waveHeightM < 9) return 'high'
  if (waveHeightM < 14) return 'very high'
  return 'phenomenal'
}

/** Metres per second to knots, which is the unit at sea. */
function knots(ms: number): number {
  return ms * 1.943844
}

function hemisphere(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`
}

/**
 * Where the Americas divide the Atlantic from the Pacific, at a given latitude.
 *
 * A single meridian cannot do this and the first version of this function tried
 * to. The continents are not a straight line: at 40°N the divide is out past
 * −100° because North America is wide there, and at 40°S it is at −70° because
 * South America is narrow. One cut put a Californian buoy in the Atlantic or a
 * New Jersey buoy in the Pacific, depending which cut you chose.
 */
function americasDivide(lat: number): number {
  if (lat >= 30) return -100 // North America, Gulf of Mexico on the Atlantic side
  if (lat >= 7) return -90 // Central America
  if (lat >= -20) return -78 // Colombia, Ecuador, northern Peru
  return -70 // Chile and the southern cone
}

/**
 * Which ocean a coordinate sits in.
 *
 * Coarse, and deliberately so: the point is not cartography, it is that a
 * reader scanning eight hundred station identifiers can find the Pacific. A
 * board grouped by station number is grouped by nothing at all.
 *
 * Coarse is not the same as wrong, though, and the first version was wrong. It
 * used one longitude band for the Indian Ocean, `20°E` to `147°E`, which put
 * **Guam, Yap and Palau in the Indian Ocean** — they are Pacific islands, three
 * thousand kilometres from it. The real eastern limit of the Indian Ocean is
 * latitude-dependent: north of the equator it ends at the Malacca Strait around
 * 100°E, and only south of it does it run out to the Australian limit near
 * 147°E. That is the IHO's own division and it is what this follows now.
 */
export function basin(lat: number, lon: number): string {
  if (lat > 66.5) return 'Arctic Ocean'
  if (lat < -60) return 'Southern Ocean'
  const l = ((((lon + 180) % 360) + 360) % 360) - 180

  // Marginal seas that readers name directly, and would not look for under
  // "Atlantic Ocean" even though that is where they drain.
  if (lat >= 30 && lat <= 47 && l >= -6 && l <= 42) return 'Mediterranean & Black Sea'
  if (lat >= 51 && lat <= 66 && l >= -5 && l <= 30) return 'North Sea & Baltic'

  // The Indian Ocean's eastern limit, which moves with latitude.
  const indianEast = lat >= 0 ? 100 : 147
  if (l >= 20 && l < indianEast) return 'Indian Ocean'

  if (l >= indianEast || l < americasDivide(lat)) return 'Pacific Ocean'
  return 'Atlantic Ocean'
}

interface MaritimePoint {
  group: string
  headline: string
  detail?: string
  value?: number
  unit?: string
  at?: string | null
  url?: string
  weight?: number
  groupWeight?: number
  lat?: number
  lon?: number
}

function point(p: MaritimePoint): Evidence {
  return {
    claim: p.detail ? `${p.headline} — ${p.detail}` : p.headline,
    entity: { type: 'other', value: p.group },
    sourceKey: 'noaa_ndbc',
    sourceUrl: p.url,
    retrievedAt: new Date().toISOString(),
    publishedAt: p.at ?? null,
    // An instrument reporting the sea it floats in. Not a report about an
    // observation — the observation.
    admiralty: { source: 'A', info: 1 },
    confidence: 'confirmed',
    data: { ...p },
  }
}

const GROUP_ORDER = { match: 100, roughest: 90, tsunami: 95, basins: 50, inland: 40 } as const

/**
 * Stations shown per ocean before the rest are summarised.
 *
 * Twenty is a readable group on a phone; 385 is not, and 385 is what the
 * Atlantic actually returns. The number left out is always stated.
 */
export const PER_BASIN = 20

/**
 * Sea conditions worldwide, from the instruments measuring them.
 *
 * Two requests, always: the observations and the register. They are fetched
 * together because a reading without the station's name and owner is a number
 * against a five-digit code, which is data the reader cannot use.
 */
export const maritimeConditions: Source = {
  key: 'noaa_ndbc',
  capability: 'maritime',
  passive: true,
  hosts: ['www.ndbc.noaa.gov'],
  minIntervalMs: 600,
  async run(input: SourceInput, ctx: SourceContext): Promise<Evidence[]> {
    const query = input.value.trim().toLowerCase()

    const [obsRes, stationRes] = await Promise.all([
      ctx.fetch(`${NDBC}/data/latest_obs/latest_obs.txt`),
      ctx.fetch(`${NDBC}/activestations.xml`),
    ])
    // The observations are the gateway; without them there is nothing to show,
    // and a provider failure must say so rather than read as a calm sea.
    const observations = parseLatestObservations(await expectOk('noaa_ndbc', obsRes).text())

    /**
     * The register is an enrichment, not a dependency. If it fails we still
     * report the readings, under their station numbers — degraded and honest
     * beats absent.
     */
    const stations = new Map<string, Station>()
    if (stationRes.ok) {
      for (const s of parseStations(await stationRes.text().catch(() => ''))) {
        stations.set(s.id, s)
      }
    }

    const named = observations.map((o) => {
      const s = stations.get(o.station)
      // A register entry whose name is just the identifier again adds nothing;
      // `22103 (22103)` is worse than `Station 22103`, not better.
      const named = s && s.name !== o.station
      return {
        o,
        label: named ? `${s.name} (${o.station})` : `Station ${o.station}`,
        owner: s?.owner ?? null,
        dart: s?.dart ?? false,
        /**
         * NDBC's network is not only marine: it carries the Great Lakes, and
         * reservoirs as far inland as Lake Murray. The live board filed **Lake
         * Winnipeg under the Atlantic Ocean**, which is the kind of confident
         * nonsense that costs a reader their trust in every other row.
         */
        inland: isInlandStation(s),
        url: `${NDBC}/station_page.php?station=${encodeURIComponent(o.station)}`,
      }
    })

    function row(
      n: (typeof named)[number],
      group: string,
      groupWeight: number,
      weight: number,
    ): Evidence {
      const { o } = n
      const parts: string[] = []
      if (o.waveHeight !== null) {
        parts.push(`waves ${o.waveHeight.toFixed(1)} m — ${seaState(o.waveHeight)}`)
      }
      if (o.wavePeriod !== null && o.wavePeriod > 0) parts.push(`period ${o.wavePeriod}s`)
      if (o.windSpeed !== null) {
        const gust = o.windGust !== null ? `, gusting ${knots(o.windGust).toFixed(0)}` : ''
        parts.push(`wind ${knots(o.windSpeed).toFixed(0)} kn${gust}`)
      }
      if (o.waterTemp !== null) parts.push(`sea ${o.waterTemp.toFixed(1)}°C`)
      if (o.airTemp !== null) parts.push(`air ${o.airTemp.toFixed(1)}°C`)
      if (o.pressure !== null) parts.push(`${o.pressure.toFixed(0)} hPa`)
      parts.push(hemisphere(o.lat, o.lon))
      if (n.owner) parts.push(n.owner)

      return point({
        group,
        groupWeight,
        headline: n.dart ? `${n.label} · tsunami buoy` : n.label,
        detail: parts.join(' · '),
        value: o.waveHeight ?? o.windSpeed ?? undefined,
        unit: o.waveHeight !== null ? 'm' : o.windSpeed !== null ? 'm/s' : undefined,
        at: o.at,
        url: n.url,
        weight,
        lat: o.lat,
        lon: o.lon,
      })
    }

    const out: Evidence[] = []

    if (query) {
      /**
       * A subject search over the station's name, its owner and its number.
       * Someone types "Alaska" or "Hawaii" or a station code; all three are
       * things a person actually knows about a buoy.
       */
      const matched = named.filter(
        (n) =>
          n.label.toLowerCase().includes(query) ||
          (n.owner ?? '').toLowerCase().includes(query) ||
          n.o.station.toLowerCase() === query,
      )
      for (const [i, n] of matched.slice(0, 30).entries()) {
        out.push(row(n, `Stations matching “${input.value.trim()}”`, GROUP_ORDER.match, 1000 - i))
      }
    }

    /**
     * The roughest seas being measured right now.
     *
     * This is the maritime answer to "what is happening": a board of eight
     * hundred stations sorted by identifier tells a reader nothing, and the
     * one thing every reader wants first is where it is worst.
     */
    const rough = named
      // Seas, so inland water is excluded rather than competing: a reservoir
      // with a metre of chop is not one of the roughest seas on earth, and a
      // reader scanning this group is asking about the ocean.
      .filter((n) => n.o.waveHeight !== null && !n.inland)
      .sort((a, b) => (b.o.waveHeight ?? 0) - (a.o.waveHeight ?? 0))
      .slice(0, 15)
    for (const n of rough) {
      out.push(row(n, 'Roughest seas now measured', GROUP_ORDER.roughest, (n.o.waveHeight ?? 0) * 100))
    }

    // The tsunami network, which is the one class of station whose presence is
    // itself the story.
    const darts = named.filter((n) => n.dart).slice(0, 12)
    for (const [i, n] of darts.entries()) {
      out.push(row(n, 'Tsunami detection network (DART)', GROUP_ORDER.tsunami, 1000 - i))
    }

    /**
     * Everything else, by ocean — and **capped**, which is the whole lesson of
     * this gateway's first live walk.
     *
     * The first version emitted all 861 reporting stations. The data was
     * perfect and the page was unusable: **64,056 pixels tall on a phone**,
     * with 731 tap targets — five and a half times the globe page that this
     * project was already told was too long, and 385 rows in the Atlantic group
     * alone. Every other board in the codebase caps in the source (15 to 300
     * rows); this one was the outlier.
     *
     * Nobody reads the 300th buoy. What a reader wants from an ocean is the
     * notable ones, and a way to reach any specific station — which the search
     * already gives. So each basin shows its roughest twenty, and the ones left
     * out are **counted and named as left out** rather than silently dropped:
     * a cap the reader cannot see is indistinguishable from missing coverage.
     */
    const shown = new Set([...rough, ...darts].map((n) => n.o.station))
    const byGroup = new Map<string, Array<(typeof named)[number]>>()
    for (const n of named) {
      if (shown.has(n.o.station)) continue
      const group = n.inland ? 'Lakes & inland waters' : basin(n.o.lat, n.o.lon)
      const list = byGroup.get(group)
      if (list) list.push(n)
      else byGroup.set(group, [n])
    }

    for (const [group, list] of byGroup) {
      const weight = group === 'Lakes & inland waters' ? GROUP_ORDER.inland : GROUP_ORDER.basins
      // Roughest first inside the basin, so the cap keeps what matters rather
      // than whichever stations happen to sort first by identifier.
      const ordered = [...list].sort((a, b) => (b.o.waveHeight ?? -1) - (a.o.waveHeight ?? -1))
      for (const n of ordered.slice(0, PER_BASIN)) {
        out.push(row(n, group, weight, n.o.waveHeight ?? 0))
      }
      const hidden = ordered.length - PER_BASIN
      if (hidden > 0) {
        out.push(
          point({
            group,
            groupWeight: weight,
            headline: `${hidden} more station${hidden === 1 ? '' : 's'} reporting here`,
            detail:
              `${ordered.length} stations are reporting in this group and the ${PER_BASIN} with the ` +
              `highest seas are shown. Search a station name, a sea area or the body that owns the ` +
              `instrument to reach any of the rest.`,
            value: hidden,
            unit: 'stations',
            // Last inside its group: it is a footnote about the group, not a
            // reading, and it must never displace an actual measurement.
            weight: -1,
          }),
        )
      }
    }

    return out
  },
}

export const MARITIME_SOURCES: Source[] = [maritimeConditions]
