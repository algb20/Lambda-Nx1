import { GATEWAY_LIMIT } from './rate-limit'

/**
 * The public API, described once.
 *
 * ## Why this file rather than a written document
 *
 * Every comparable platform surveyed in `docs/COMPETITORS.md` publishes API
 * documentation; we had none, which is the third gap that survey found and the
 * only one nothing had been done about. The obvious response is to write a page
 * listing the endpoints — and it is the wrong response, for the reason every
 * hand-written API document eventually proves: it is a *copy* of the routes,
 * and a copy drifts. A parameter is renamed, a route is added, and the document
 * quietly becomes a set of confident lies about software that no longer works
 * that way.
 *
 * So the catalogue is data, the page renders it, and a test asserts it against
 * the filesystem in both directions: every endpoint described here must exist
 * as a route, and every route that exists must be either described here or
 * explicitly listed as internal. Adding a route without deciding which it is
 * fails the build. That is the whole mechanism, and it is the only reason this
 * document can be trusted six months from now.
 *
 * ## What "public" means here
 *
 * The gateways are usable without an account by design (charter §1). That is a
 * deliberate product decision and it is what makes the rate limit necessary:
 * every gateway call fans out to public providers — NASA, USGS, CISA,
 * OpenSanctions — who rate-limit *us*, not the caller.
 *
 * Endpoints that read or write a person's own data are not public API surface
 * and are not listed. Neither are the admin and cron routes, which are
 * secret-gated. Listing them would be advertising a door rather than
 * documenting a product.
 */

export type ApiMethod = 'GET' | 'POST'

export interface ApiParam {
  name: string
  type: 'string'
  required: boolean
  description: string
  example: string
}

export interface ApiEndpoint {
  /** Path as served, e.g. `/api/world`. */
  path: string
  method: ApiMethod
  /** Route directory under `app/api`, used by the drift test. */
  route: string
  title: string
  /** What it answers, in one sentence a caller can act on. */
  description: string
  /** JSON body fields for POST endpoints. GET endpoints take none. */
  params?: ApiParam[]
  /** The fields a caller is most likely to want, named honestly. */
  returns: string[]
}

export interface ApiGroup {
  id: string
  title: string
  description: string
  endpoints: ApiEndpoint[]
}

/** One POST gateway that takes a single free-text field. */
function gateway(
  route: string,
  title: string,
  description: string,
  field: string,
  fieldDescription: string,
  example: string,
  returns: string[],
): ApiEndpoint {
  return {
    path: `/api/${route}`,
    route,
    method: 'POST',
    title,
    description,
    params: [
      { name: field, type: 'string', required: true, description: fieldDescription, example },
    ],
    returns,
  }
}

/** What every graded finding carries, stated once instead of per endpoint. */
export const EVIDENCE_FIELDS = [
  'claim — what the source stated, never our paraphrase',
  'sourceKey, sourceUrl — who said it and where to check',
  'retrievedAt — when we fetched it',
  'publishedAt — when the source says it happened, or null if it stated none',
  'admiralty — source letter A–F and information number 1–6',
  'confidence — confirmed, probable, possible or unconfirmed',
]

export const API_GROUPS: ApiGroup[] = [
  {
    id: 'live',
    title: 'Live boards',
    description:
      'Read-only pictures of the world right now. No body, no account, no key. These are the heaviest calls the platform makes — each one fans out across the source catalogue — so they are the ones the rate limit is really about.',
    endpoints: [
      {
        path: '/api/world',
        route: 'world',
        method: 'GET',
        title: 'The world picture',
        description:
          'Every measured hazard and reported event we currently hold, graded and deduplicated, with the ones that carry no coordinate listed separately rather than dropped.',
        returns: [
          'events — placeable, each with category, severity and both timestamps',
          'unplaceable — real events with no coordinate, shown rather than discarded',
          'fused — distinct events, each carrying every report of it',
          'sourceHealth — per feed: ok, cached, empty or failed, with the reason',
          'coverage — where we are blind, stated as a finding',
        ],
      },
      {
        path: '/api/mcp',
        route: 'mcp',
        method: 'POST',
        title: 'Model Context Protocol — the platform as agent tools',
        description:
          'JSON-RPC 2.0. Lets Claude, or any MCP-capable agent, read live public-source intelligence instead of answering about the world from training-data memory. Six tools: world events, country risk, country ranking, corridor status, gateway queries and source health. GET the same URL for a plain description of the tools.',
        returns: [
          'Every tool result carries its sources, its timestamps, and a non-empty `limits` list',
          'The handshake instructs the agent to relay the limits alongside the numbers',
          'Open, like every other read surface here — an agent endpoint behind a key is one nobody wires up',
        ],
      },
      {
        path: '/api/countries',
        route: 'countries',
        method: 'GET',
        title: 'Country instability, with its observability beside it',
        description:
          'Every country present in the feed, scored twice and never once: what public sources reported, and how well we can see the country at all. Returned in observability bands rather than one list, because one list asserts that every row is comparable with every other. `?iso=XX` for a single dossier; `?corridors=1` adds the critical-corridor watch.',
        returns: [
          'bands — densely, moderately and thinly observed, each with what that means',
          'signal — 0–100, what was reported, weighted by bearing on stability',
          'observability — 0–100, independent origins first, then sources, then volume',
          'components — per category: count, contribution, and the strongest report named',
          'blindSpots — what this score does not cover. Never empty, for any country',
          'corridors — optional: pressure near places world traffic cannot bypass',
        ],
      },
      {
        path: '/api/brief',
        route: 'brief',
        method: 'GET',
        title: 'The analytic read',
        description:
          'The standing mechanical reading of the world picture: what is corroborated, what rests on a single origin, and what is old. Costs no model call and no credential, which is why it is open.',
        returns: ['headline', 'sections', 'signals', 'generatedAt'],
      },
      {
        path: '/api/trending',
        route: 'trending',
        method: 'GET',
        title: "The day's subjects",
        description:
          'What the world is actually looking up, from real view counts, ranked by our own scoring. Every item links to its source.',
        returns: ['spotlight', 'items', 'generatedAt'],
      },
      {
        path: '/api/chain',
        route: 'chain',
        method: 'GET',
        title: 'Blockchain radar',
        description:
          'Bitcoin network state — chain tip, mempool depth, fee bands — plus market structure and the day’s movers.',
        returns: ['networks', 'venues', 'movers'],
      },
      {
        path: '/api/diagnose',
        route: 'diagnose',
        method: 'GET',
        title: 'What is wrong right now',
        description:
          'The platform’s own diagnosis of itself: which feeds are failing and why, whether one category is drowning the board, and whether events carry a source-stated time. Published rather than hidden, because a platform that cannot be checked cannot be trusted.',
        returns: ['feeds', 'balance', 'dates', 'news', 'catalogue'],
      },
      {
        path: '/api/health',
        route: 'health',
        method: 'GET',
        title: 'Readiness',
        description:
          'Whether this instance is configured and ready. Booleans and provider names only — never a secret, never a value. Answers 503 when a required check fails, so a load balancer can act on it.',
        returns: ['status', 'checks'],
      },
    ],
  },
  {
    id: 'osint',
    title: 'Core OSINT',
    description:
      'The passive investigation gateways. Every one of them reads public providers *about* a subject and never contacts the subject itself — no scanning, no probing, enforced centrally rather than promised here.',
    endpoints: [
      gateway(
        'intelligence/domain',
        'Domain & infrastructure',
        'DNS, certificate transparency, registration and hosting, pivoted into the entities they share.',
        'domain',
        'A domain name. No scheme, no path.',
        'example.com',
        ['entities', 'findings', 'pivots', 'confidence'],
      ),
      gateway(
        'intelligence/email',
        'Email footprint',
        'Where an address appears in public records and whether it appears in known breach exposure — a yes/no check, never credential data.',
        'email',
        'A full email address.',
        'someone@example.com',
        ['findings', 'exposure', 'confidence'],
      ),
      gateway(
        'intelligence/username',
        'Username footprint',
        'Public presence of a handle across platforms that publish it.',
        'username',
        'A handle, without the @.',
        'exampleuser',
        ['findings', 'platforms', 'confidence'],
      ),
      gateway(
        'intelligence/media',
        'Media verification',
        'What an image can be shown to be: embedded metadata, provenance signals and reverse-lookup leads.',
        'imageBase64',
        'The image, base64-encoded.',
        'iVBORw0KGgo…',
        ['findings', 'metadata', 'confidence'],
      ),
      gateway(
        'intelligence/geo',
        'Geospatial & transport',
        'Places, boundaries and transport infrastructure from open geographic registries.',
        'query',
        'A place name or coordinate pair.',
        'Port of Rotterdam',
        ['findings', 'places', 'confidence'],
      ),
      gateway(
        'intelligence/research',
        'Scholarly index',
        'Papers, authors and citations across OpenAlex, Crossref and PubMed.',
        'query',
        'A topic, title or author.',
        'malaria vector control',
        ['findings', 'works', 'confidence'],
      ),
      gateway(
        'intelligence/open-data',
        'Open-data federation',
        'One query across national open-data portals through the CKAN Action API, with per-portal health.',
        'query',
        'A dataset topic.',
        'air quality',
        ['datasets', 'portals', 'portalHealth'],
      ),
      gateway(
        'intelligence/reference',
        'Reference graph',
        'Wikidata entities resolved into our ontology, so a name becomes something you can pivot on.',
        'query',
        'An entity name.',
        'International Monetary Fund',
        ['entities', 'links', 'confidence'],
      ),
      gateway(
        'intelligence/nexus',
        'Nexus — unified investigation',
        'One query run across every applicable gateway at once, fused into a single graded picture. The flagship, and the most expensive call in the API.',
        'query',
        'Anything: a domain, a company, a person’s public handle, a place.',
        'example.com',
        ['entities', 'findings', 'pivots', 'fusion', 'confidence'],
      ),
    ],
  },
  {
    id: 'gateways',
    title: 'Specialist gateways',
    description:
      'The same engine pointed at other lawful families. Each extends the OSINT method rather than replacing it — the guardrails, the Admiralty grading and the independence counting are identical.',
    endpoints: [
      gateway(
        'intelligence/threat',
        'Threat intelligence',
        'What is publicly known about an indicator: exploited-vulnerability catalogues, national CERT advisories, reputation and exposure signals.',
        'indicator',
        'A domain, IP, hash or CVE identifier.',
        'CVE-2026-0001',
        ['findings', 'advisories', 'confidence'],
      ),
      gateway(
        'intelligence/news',
        'News & signals',
        'Reports clustered into events and graded by how many *independent origins* carried them. Twenty outlets running one wire is one confirmation, and this says so.',
        'query',
        'A topic, or empty for the whole board.',
        'Strait of Hormuz',
        ['stories', 'items', 'analysis', 'staleFeeds'],
      ),
      gateway(
        'intelligence/finance',
        'Finance, sanctions & corporate',
        'Sanctions designations, corporate registries and legal-entity identifiers.',
        'query',
        'A company or person name, or an LEI.',
        'Example Holdings Ltd',
        ['findings', 'designations', 'entities', 'confidence'],
      ),
      gateway(
        'intelligence/markets',
        'Markets & economy',
        'Instruments, indices, commodities and macroeconomic series.',
        'query',
        'A ticker, index or series name.',
        'brent crude',
        ['findings', 'series', 'confidence'],
      ),
      gateway(
        'intelligence/ownership',
        'Ownership & control',
        'Beneficial ownership and control networks from public registries.',
        'query',
        'A company name or identifier.',
        'Example Holdings Ltd',
        ['entities', 'links', 'confidence'],
      ),
      gateway(
        'intelligence/procurement',
        'Public contracts',
        'Tenders and awards from open contracting registries.',
        'query',
        'A buyer, supplier or contract subject.',
        'ministry of health',
        ['findings', 'contracts', 'confidence'],
      ),
      {
        path: '/api/intelligence/board',
        route: 'intelligence/board',
        method: 'POST',
        title: 'Markets board',
        description:
          'The multi-class market overview in one call. Takes no body.',
        returns: ['classes', 'movers', 'generatedAt'],
      },
      {
        path: '/api/intelligence/property',
        route: 'intelligence/property',
        method: 'POST',
        title: 'Property & real estate',
        description:
          'Housing prices, construction and sales activity, mortgage rates and unsold supply, from the statistical authority of each territory. Takes no body. Every figure carries the period it describes — these series are published months in arrears by nature.',
        returns: ['sections', 'summary', 'findings'],
      },
      {
        path: '/api/intelligence/venues',
        route: 'intelligence/venues',
        method: 'POST',
        title: 'Trading venues — every exchange on earth',
        description:
          'The ISO 10383 registry itself: every exchange, MTF, dark pool, clearing venue and registered crypto provider that holds a Market Identifier Code, searchable by name, country, city or MIC — plus the crypto exchange index, labelled separately because a market index is not a registry. Send no query and the answer is the registry\u2019s operating venues.',
        returns: [
          'groups — regulated markets, crypto venues, and reporting infrastructure',
          'each venue with its MIC, legal entity, LEI, country, city and category',
          'summary.withLei — how many can be traced to an owner through GLEIF',
          'limits — registration is not endorsement, stated on every response',
        ],
      },
      {
        path: '/api/intelligence/filings',
        route: 'intelligence/filings',
        method: 'POST',
        title: 'Filings intelligence — the disclosure tape',
        description:
          'Full-text search across every recent SEC filing, graded by disclosure item. Send a phrase to find every filing whose text contains it; send nothing for the last few days of 8-Ks ranked by what they disclose. Item 9.01 appears on most filings and means an exhibit is attached; item 4.02 means a company\u2019s past financials cannot be relied upon, and this tells them apart.',
        returns: [
          'bands — serious, substantive, routine and administrative',
          'each filing with its form, item codes, tickers, CIK and the SEC\u2019s own page',
          'standouts — the consequential item codes present in this window',
          'limits — US filers only, and what an item code does and does not say',
        ],
      },
      {
        path: '/api/intelligence/broadcasts',
        route: 'intelligence/broadcasts',
        method: 'POST',
        title: 'Live broadcasts — what is on air',
        description:
          'Verified-live audio streams by country, language or name, from a catalogue of 62,000 stations across 241 countries. A two-letter query is a country code; anything else is a name search; nothing returns the most-opened stations worldwide. Broadcast presence is a public signal about a place: which languages it transmits in, and whether its stations are reachable at all.',
        returns: [
          'countries — each with its stations and the languages on air from it',
          'each station with its stream URL, languages, codec, bitrate and coordinate',
          'lastCheckedAt — when the stream was last confirmed live, on every row',
          'limits — nothing is proxied or recorded, and coverage is uneven',
        ],
      },
      {
        path: '/api/intelligence/companies',
        route: 'intelligence/companies',
        method: 'POST',
        title: 'Companies',
        description:
          'A company as its regulator holds it — legal and former names, industry, listings, recent filings, and the figures it reported, each with the period it covers and the form it came from. Send no company and the answer is the largest filers ranked by their own balance sheets.',
        params: [
          {
            name: 'company',
            type: 'string',
            required: false,
            description: 'A company name or ticker. Omit for the ranking.',
            example: 'Apple',
          },
        ],
        returns: ['profile', 'financials', 'filings', 'ranking', 'summary'],
      },
      {
        path: '/api/intelligence/boards/[board]',
        route: 'intelligence/boards/[board]',
        method: 'POST',
        title: 'Single-authority boards',
        description:
          'Seven boards, each reading one primary authority and grouping what it published: `courts` (US case law), `regulation` (the Federal Register), `officials` (central-bank speeches), `resources` (IMF commodity prices), `grid` (metered GB electricity), `space-weather` (NOAA scales and Kp), `orbital` (tracked objects). Rows arrive already grouped, and every group carries its own count.',
        params: [
          {
            name: 'query',
            type: 'string',
            required: false,
            description:
              'Narrows the board where its publisher supports search (courts, regulation, officials, orbital). Ignored by the rest.',
            example: 'antitrust',
          },
        ],
        returns: ['groups', 'summary', 'findings', 'title', 'note'],
      },
    ],
  },
  {
    id: 'meta',
    title: 'Plans',
    description: 'What the tiers are, served from the same definition the app itself enforces.',
    endpoints: [
      {
        path: '/api/plans',
        route: 'plans',
        method: 'GET',
        title: 'Plans & pricing',
        description:
          'Every plan, its price, its limits and what it unlocks. Includes the caller’s current plan when signed in.',
        returns: ['plans', 'currentPlan', 'enforced'],
      },
    ],
  },
]

/**
 * Routes that exist and are deliberately **not** public API.
 *
 * Every one has a reason, and the reason is the point: this list is what stops
 * the drift test from being satisfied by silence. A new route must be put in one
 * list or the other, and choosing is the moment someone thinks about whether it
 * should be public at all.
 */
export const INTERNAL_ROUTES: Record<string, string> = {
  account: 'a person’s own account',
  'admin/social': 'secret-gated administration',
  'admin/social/test': 'secret-gated administration',
  'admin/visitors': 'secret-gated administration',
  alerts: 'per-user alert rules and signed webhook delivery',
  analyst: 'the AI-analyst layer — needs a key and a paid tier',
  'auth/login': 'authentication, under its own much tighter limit',
  'auth/logout': 'authentication',
  'auth/me': 'the signed-in caller’s own session',
  'auth/methods': 'tells the sign-in form which flows this deployment can offer',
  'auth/password/forgot': 'account recovery — answers identically for every address by design',
  'auth/password/reset': 'account recovery, spending a code we mailed',
  'auth/pi': 'Pi Network authentication',
  preferences: 'a person’s own layout — which panels they opened and which gateways they pinned',
  'auth/pi/claim': 'Pi Network authentication',
  'auth/register': 'authentication',
  'auth/verify/confirm': 'sign-up, spending a code we mailed',
  'auth/verify/request': 'sign-up — sends a code to an address, so it is rate-limited hard',
  follow: 'asks to be sent the brief — mails one confirmation and nothing else until it is clicked',
  'follow/confirm': 'the click that starts a subscription; the token is the only authority',
  'follow/unsubscribe': 'leaving, by link or by a provider’s one-click POST — never behind a sign-in',
  avatar: 'a person’s own profile image',
  'avatar/[...path]': 'a person’s own profile image',
  calibration: 'the forecast-tracking ledger, tied to an account',
  'calibration/due': 'the forecast-tracking ledger, tied to an account',
  'calibration/resolve': 'the forecast-tracking ledger, tied to an account',
  'cron/[job]': 'scheduler-only, authenticated by shared secret',
  export: 'exports a caller’s own investigation',
  'export/share': 'creates a permalink to a caller’s own investigation',
  groups: 'a person’s own groups',
  investigations: 'a person’s own saved investigations',
  monitors: 'a person’s own monitors',
  'monitors/[id]': 'a person’s own monitors',
  ontology: 'the knowledge graph, written by the engine',
  'ontology/global': 'the knowledge graph, written by the engine',
  payments: 'payment flows — Pi and standard',
  posts: 'the publishing surface, tied to an account',
  'posts/[id]': 'the publishing surface, tied to an account',
  'publish/run': 'scheduler-driven publishing',
  'radar/findings': 'the internal research radar',
  'radar/run': 'the internal research radar',
  'self-audit': 'the platform’s own reliability ledger',
  suggestions: 'the feedback loop, tied to an account',
  'suggestions/vote': 'the feedback loop, tied to an account',
  track: 'a fire-and-forget usage beacon',
  translate: 'a UI translation helper, not a data product',
  visit: 'a fire-and-forget visit beacon',
}

/** Every documented endpoint, flattened. */
export function allEndpoints(): ApiEndpoint[] {
  return API_GROUPS.flatMap((g) => g.endpoints)
}

/**
 * The rate limit, read from the same constant the middleware enforces.
 *
 * Quoting a number here that the gate does not actually apply would be the
 * exact failure this whole file is built to prevent, one paragraph in.
 */
export const RATE_LIMIT = {
  requests: GATEWAY_LIMIT.limit,
  windowSeconds: GATEWAY_LIMIT.windowMs / 1000,
  headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}
