/**
 * The gateway catalogue, as data rather than as markup.
 *
 * The list of gateways and the way they are grouped in the interface used to
 * live inside the dashboard component, which meant nothing could check them.
 * Two failures follow from that, and both are silent:
 *
 *  - a gateway added to the code but left out of the grouping becomes
 *    unreachable in the interface while still existing and still being counted;
 *  - a gateway that appears in two families gets two chips, and pressing either
 *    looks like a bug.
 *
 * Here they are plain values, so `lib/gateways.test.ts` asserts the invariant:
 * every gateway appears in exactly one family, and no family names one that does
 * not exist. The `Mode` type is derived from the list, so the type system and
 * the interface cannot drift apart.
 */

/** Every gateway the intelligence dashboard offers, in catalogue order. */
export const ALL_MODES = [
  'nexus',
  'track',
  'domain',
  'username',
  'email',
  'threat',
  'finance',
  'markets',
  'procurement',
  'ownership',
  'news',
  'board',
  'geo',
  'research',
  'reference',
  'media',
] as const

export type Mode = (typeof ALL_MODES)[number]

/**
 * How the gateways are grouped for the eye.
 *
 * Sixteen equal chips in one block force the user to read all sixteen to find
 * the one they want. Families give the eye somewhere to land: "I want the
 * company's owners" goes straight to Money & entities without reading
 * Infrastructure at all. Order runs broadest-first, both between families and
 * inside them.
 */
export const GATEWAY_FAMILIES: ReadonlyArray<{ label: string; modes: readonly Mode[] }> = [
  { label: 'Start anywhere', modes: ['nexus', 'track'] },
  { label: 'Infrastructure', modes: ['domain', 'threat', 'geo'] },
  { label: 'People & accounts', modes: ['username', 'email'] },
  { label: 'Money & entities', modes: ['finance', 'ownership', 'procurement', 'board', 'markets'] },
  { label: 'Knowledge & record', modes: ['research', 'reference', 'news', 'media'] },
]

export interface GatewayGuidance {
  /** One sentence: what question this gateway answers. */
  answers: string
  /** A real example that returns something. */
  example: string
  /** The honest boundary — what this will not tell you. */
  limit: string
}

/**
 * Per-gateway guidance. Every example is one that genuinely returns something
 * from a public source — an example that comes back empty would teach the user
 * the product does not work.
 */
export const GATEWAY_GUIDANCE: Record<Mode, GatewayGuidance> = {
  nexus: {
    answers:
      'Give it anything — a domain, IP, email, company, wallet or file hash — and it works out what the selector is, then runs every gateway that applies at once.',
    example: 'wikipedia.org',
    limit: 'It reads public records about the subject. It never connects to the subject itself.',
  },
  track: {
    answers:
      'Watch one target live — a stock, a coin, a company or a domain — and see its signature change as public sources report.',
    example: 'BTC',
    limit: 'It follows public reporting. It cannot see private trades, orders or internal systems.',
  },
  domain: {
    answers:
      'Everything public about a domain: DNS records, registration, subdomains, hosting, the IPs it resolves to, and how that has changed over time.',
    example: 'wikipedia.org',
    limit:
      'Passive only — no port scans, no probing, no connection to the domain. Absence of a record is not evidence of absence.',
  },
  username: {
    answers:
      'Where a username exists across public platforms, with the profile URL for each hit so you can check it yourself.',
    example: 'octocat',
    limit:
      'A matching username is not a matching person. It never targets a private individual’s personal life.',
  },
  email: {
    answers:
      'Whether an address appears in known public breach disclosures, and which public profiles are tied to it.',
    example: 'test@example.com',
    limit:
      'Exposure only — yes or no, from public disclosures. We never hold, show or redistribute stolen credentials.',
  },
  threat: {
    answers:
      'What threat-intelligence sources have published about an indicator — an IP, domain, URL or file hash.',
    example: '8.8.8.8',
    limit:
      'It reports what others published, graded by source. A clean result is not a guarantee of safety.',
  },
  finance: {
    answers:
      'Sanctions listings, corporate registration and public filings for a company — or the public history of a wallet address.',
    example: 'Apple Inc',
    limit: 'Public registers and filings only. It is not a credit check and not financial advice.',
  },
  board: {
    answers:
      'One live board across asset classes — crypto, equities, rates and FX — from public market data.',
    example: 'press Load',
    limit: 'Market data as published, with its timestamp. It is not advice and not a recommendation.',
  },
  markets: {
    answers: 'One instrument in depth: price, history and the public record around it.',
    example: 'BTC',
    limit: 'Published data with its source and time. Never a forecast, never advice.',
  },
  procurement: {
    answers:
      'Public contracts and government spending tied to a company, an agency or a project.',
    example: 'Lockheed Martin',
    limit:
      'Only contracts that were published. A company absent from the results may simply not appear in the open registers we read.',
  },
  ownership: {
    answers:
      'Who owns and controls a legal entity — parents, subsidiaries and the beneficial-control chain, from public registers.',
    example: 'Nestle',
    limit:
      'Registers vary by jurisdiction and lag reality. A missing link means no public record, not no relationship.',
  },
  geo: {
    answers:
      'A place, a coordinate, or an aircraft by its ICAO24 hex — with the public position and transport data around it.',
    example: '48.8584,2.2945',
    limit:
      'Public feeds only, at their own resolution and delay. It never tracks a person.',
  },
  research: {
    answers:
      'What the research record says about a topic — papers, preprints and technical publications, graded by source.',
    example: 'post-quantum cryptography',
    limit: 'It surfaces and grades published work. It does not judge whether a paper is correct.',
  },
  reference: {
    answers:
      'Structured, cited facts about a company, person or place, pulled from the open reference graph.',
    example: 'Marie Curie',
    limit: 'Only what the public reference record holds, with its source. Public figures and entities only.',
  },
  news: {
    answers:
      'The top world events right now, or the public reporting on a topic you name — each item with its outlet and time.',
    example: 'leave empty for top world events',
    limit: 'Headlines are reports, not confirmed facts. Corroborate before relying on any of them.',
  },
  media: {
    answers:
      'What an image file itself reveals — embedded metadata, camera details, and any coordinates left in the file.',
    example: 'https://example.com/photo.jpg',
    limit:
      'It reads the file, nothing more. Most platforms strip metadata on upload, so an empty result is normal.',
  },
}
