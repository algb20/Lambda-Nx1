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
  'property',
  'companies',
  'statements',
  'courts',
  'regulation',
  'officials',
  'resources',
  'grid',
  'space-weather',
  'orbital',
  'geo',
  'research',
  'reference',
  'open-data',
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
  { label: 'Money & entities', modes: ['finance', 'ownership', 'procurement', 'board', 'markets', 'property', 'companies'] },
  { label: 'Law & the state', modes: ['statements', 'courts', 'regulation', 'officials'] },
  { label: 'Earth & systems', modes: ['resources', 'grid', 'space-weather', 'orbital'] },
  { label: 'Knowledge & record', modes: ['research', 'reference', 'open-data', 'news', 'media'] },
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
  property: {
    answers:
      'Housing: what homes sold for, how much is being built, what a mortgage costs and how much stock is unsold — from the national statistical authority of each territory.',
    example: 'press Load',
    limit:
      'Aggregate market structure only. Never an individual address or a per-property valuation: an address is somebody’s home, and charter §3 rules it out. Every figure carries its published period, which is months behind by nature.',
  },
  companies: {
    answers:
      'A company as its regulator holds it: legal name and former names, industry, listings, the last filings, and the figures it reported — each with the period it covers and the form it came from. With no subject, the largest filers ranked by their own balance sheets.',
    example: 'Apple',
    limit:
      'US-registered filers only. A company that does not file with the SEC will not be found — that is a limit of the source, not evidence the company does not exist. Figures are as filed, never adjusted, and a quarterly number is not an annual one.',
  },
  statements: {
    answers:
      'What the institutions whose words are themselves acts have just said — sanctions, executive instruments, Security Council actions, rate decisions — ranked by consequence, with the reasoning for that ranking on every line.',
    example: 'sanctions',
    limit:
      'Nine press offices, read directly. The ranking is our own analysis of four things a document *is* — who issued it, what instrument it is, how many independent institutions are addressing the same subject, and how old it is — and every factor is shown. It is never a forecast and never a sentiment reading.',
  },
  courts: {
    answers:
      'What American courts have just decided — opinions as filed, newest first, grouped by court. Search a party, a subject or a doctrine.',
    example: 'antitrust',
    limit:
      'United States case law only, from the Free Law Project index. A case absent here has not been shown not to exist; it may simply be in a jurisdiction the index does not cover.',
  },
  regulation: {
    answers:
      'What a government is actually doing, on the day it does it: proposed rules, final rules, notices and presidential documents from the US Federal Register.',
    example: 'artificial intelligence',
    limit:
      'The US federal journal only. State, municipal and non-US rulemaking are not in it — and a notice is not a rule, which is why the type leads each group.',
  },
  officials: {
    answers:
      'What central bank governors and board members actually said, in their own words, as collected by the BIS.',
    example: 'inflation',
    limit:
      'Public acts of office — a policy speech, on the record. This never follows a person, and it holds nothing about anyone’s private life (charter §3). Central banks only; other officials are not in this feed.',
  },
  resources: {
    answers:
      'Metals, energy minerals and food at the IMF price series that national budgets, mining investment and food-security policy are set against.',
    example: 'press Load',
    limit:
      'Monthly averages, published in arrears, and labelled as such. Not a live quote, never a forecast — a copper price shown without its month is read as today’s and is not.',
  },
  grid: {
    answers:
      'How Britain is powered right now, by fuel and by interconnector, metered half-hourly by the body that settles the electricity market.',
    example: 'press Load',
    limit:
      'Great Britain only. Very few countries publish metered generation openly and without a key; where they do not, we do not guess.',
  },
  'space-weather': {
    answers:
      'NOAA’s own R/S/G scales and the planetary K index — the alerts airlines, satellite operators and grid engineers act on.',
    example: 'press Load',
    limit:
      'Conditions and recent measurements as NOAA published them. Space-weather forecasting is genuinely hard and we publish none of our own.',
  },
  orbital: {
    answers:
      'What is overhead: crewed stations and everything launched in the last thirty days, with orbital period and inclination from the published element sets.',
    example: 'ISS',
    limit:
      'A tracked-object catalogue, not a live position. Orbital period is arithmetic on the published mean motion; predicting where an object will be is a different problem and we do not claim it.',
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
  'open-data': {
    answers:
      'Which governments hold a record of something — searched across every national open-data catalogue at once, with the publishing ministry or agency named on each result.',
    example: 'flood risk',
    limit:
      'It finds the record, not its contents. And it says plainly when a catalogue could not be reached, because “nothing found” and “we could not look” are different answers.',
  },
  media: {
    answers:
      'What an image file itself reveals — embedded metadata, camera details, and any coordinates left in the file.',
    example: 'https://example.com/photo.jpg',
    limit:
      'It reads the file, nothing more. Most platforms strip metadata on upload, so an empty result is normal.',
  },
}
