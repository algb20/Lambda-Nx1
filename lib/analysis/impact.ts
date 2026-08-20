/**
 * Which statements matter, and why — stated rather than scored.
 *
 * ## The problem with an impact number
 *
 * Every product that ranks news shows a number nobody can check. "Impact: 87"
 * is not analysis; it is a claim with the reasoning removed, and a reader has no
 * way to tell a considered judgement from a random one. Worse, the number is
 * usually the *only* thing shown, so the reader ends up trusting an ordering
 * they cannot audit.
 *
 * So this scores, and then says which factors fired and what each contributed.
 * The score exists to order a list; the **reasons** are the product. A reader
 * who disagrees with the ordering can see exactly where it came from, and the
 * factors are few enough to hold in the head.
 *
 * ## The four factors, and why these
 *
 * Each is something a document *is*, not something we guess about it:
 *
 *  1. **Who issued it.** A head of government, a central bank governor or the
 *     Security Council speaking is structurally different from an agency
 *     announcing a workshop. This is a property of the source, known before the
 *     text is read.
 *  2. **What kind of instrument it is.** "Executive order", "resolution",
 *     "sanctions", "rate decision" are acts with legal or market force.
 *     "Visits", "tribute", "workshop" are not. The vocabulary is small,
 *     explicit, and multilingual where the sources are.
 *  3. **Whether other institutions are saying it too.** Independent
 *     corroboration is the one signal this platform already treats as decisive
 *     everywhere else, and a subject that three unrelated bodies address on the
 *     same day is doing something a single press release is not.
 *  4. **How fresh it is.** Decay only — recency can lift nothing on its own, or
 *     every routine notice published this hour would outrank a sanctions
 *     package from yesterday.
 *
 * ## What it deliberately does not do
 *
 * No sentiment, no "predicted market move", no model call. Sentiment on a
 * diplomatic statement is noise dressed as insight, and a forecast is the one
 * thing charter §1 rules out entirely.
 */

export interface ImpactFactor {
  /** What fired, in the reader's language. */
  label: string
  /** Its contribution. Positive lifts, negative lowers. */
  weight: number
}

export interface ImpactAssessment {
  /** 0–100. Exists to order a list, and is never shown without its reasons. */
  score: number
  factors: ImpactFactor[]
  /** One sentence a reader can act on. */
  summary: string
}

/**
 * Institutions whose word carries structural weight, and how much.
 *
 * Not a ranking of importance in the world — a statement of how directly the
 * body's own words bind or move something. A central bank's rate language moves
 * markets by being said; a research agency's press release does not.
 */
export const AUTHORITY_WEIGHT: Record<string, number> = {
  un_press: 26,
  un_news: 20,
  ec_press: 24,
  whitehouse: 30,
  fed_press: 30,
  ecb_press: 28,
  ukgov: 22,
  iaea: 22,
  who_news: 20,
  bis_speeches: 24,
}

/**
 * Instruments, and what each one *does*.
 *
 * Ordered most consequential first; the first match wins, so "emergency
 * sanctions decision" scores as sanctions rather than as an announcement.
 * Patterns are lowercase and matched against the headline plus its summary.
 */
const INSTRUMENTS: Array<{ pattern: RegExp; label: string; weight: number }> = [
  { pattern: /\b(sanction|embargo|asset freeze|designat(?:e|ion))/, label: 'Sanctions or designations', weight: 30 },
  { pattern: /\b(executive order|proclamation|decree)\b/, label: 'Executive instrument', weight: 28 },
  { pattern: /\b(resolution|security council)\b/, label: 'Security Council action', weight: 28 },
  { pattern: /\b(interest rate|rate decision|monetary policy|fomc|basis points?)\b/, label: 'Monetary policy', weight: 27 },
  { pattern: /\b(tariff|duties|trade agreement|export control)\b/, label: 'Trade measure', weight: 25 },
  { pattern: /\b(ceasefire|treaty|accord|peace (?:deal|agreement))\b/, label: 'Treaty or ceasefire', weight: 25 },
  { pattern: /\b(state of emergency|emergency declaration|evacuat)/, label: 'Emergency declaration', weight: 24 },
  { pattern: /\b(indict|prosecut|arrest warrant|charges? filed)/, label: 'Legal action', weight: 22 },
  { pattern: /\b(regulation|directive|rulemaking|enforcement action)\b/, label: 'Regulatory act', weight: 18 },
  { pattern: /\b(joint statement|communiqu)/, label: 'Joint statement', weight: 16 },
  { pattern: /\b(warning|alert|outbreak|epidemic)\b/, label: 'Public warning', weight: 16 },
  { pattern: /\b(report|review|assessment|minutes)\b/, label: 'Published assessment', weight: 10 },
  // Deliberately negative. These are real activity and they are not news, and
  // without pushing them down they fill the board on any quiet day.
  { pattern: /\b(visit|tribute|anniversar|award|workshop|webinar|appointment|results day)/, label: 'Routine or ceremonial', weight: -14 },
]

/** Half-life of freshness, in hours. A day-old statement keeps half its lift. */
const DECAY_HOURS = 24
const MAX_RECENCY_PENALTY = 18

export function assessImpact(input: {
  sourceKey: string
  headline: string
  detail?: string | null
  at?: string | null
  /** How many *independent* institutions addressed the same subject today. */
  corroboratingBodies?: number
  now?: number
}): ImpactAssessment {
  const factors: ImpactFactor[] = []
  const text = `${input.headline} ${input.detail ?? ''}`.toLowerCase()

  // 1 — who said it
  const authority = AUTHORITY_WEIGHT[input.sourceKey] ?? 14
  factors.push({ label: `Issued by ${describeAuthority(input.sourceKey)}`, weight: authority })

  // 2 — what it is
  const instrument = INSTRUMENTS.find((i) => i.pattern.test(text))
  if (instrument) factors.push({ label: instrument.label, weight: instrument.weight })

  // 3 — who else is saying it
  const bodies = input.corroboratingBodies ?? 1
  if (bodies > 1) {
    // Capped: a subject covered by five institutions is not five times more
    // consequential than one covered by two, and an uncapped term would let
    // corroboration alone outrank a sanctions package.
    factors.push({ label: `${bodies} independent institutions addressing it`, weight: Math.min(18, (bodies - 1) * 9) })
  }

  // 4 — how old
  const now = input.now ?? Date.now()
  const at = input.at ? Date.parse(input.at) : NaN
  if (Number.isFinite(at)) {
    const hours = Math.max(0, (now - at) / 3_600_000)
    // Decay only — see the header. Recency lifts nothing by itself.
    const penalty = -Math.min(MAX_RECENCY_PENALTY, Math.round((hours / DECAY_HOURS) * 9))
    if (penalty < 0) factors.push({ label: describeAge(hours), weight: penalty })
  } else {
    factors.push({ label: 'No published time stated', weight: -6 })
  }

  const raw = factors.reduce((n, f) => n + f.weight, 0)
  const score = Math.max(0, Math.min(100, raw))

  return { score, factors, summary: summarise(score, instrument?.label ?? null, bodies) }
}

function describeAuthority(sourceKey: string): string {
  const names: Record<string, string> = {
    un_press: 'the United Nations',
    un_news: 'UN News',
    ec_press: 'the European Commission',
    whitehouse: 'the White House',
    fed_press: 'the Federal Reserve',
    ecb_press: 'the European Central Bank',
    ukgov: 'the UK government',
    iaea: 'the IAEA',
    who_news: 'the World Health Organization',
    bis_speeches: 'a central bank, via the BIS',
  }
  return names[sourceKey] ?? sourceKey
}

function describeAge(hours: number): string {
  if (hours < 1) return 'Published within the hour'
  if (hours < 24) return `Published ${Math.round(hours)} hours ago`
  const days = Math.round(hours / 24)
  return `Published ${days} day${days === 1 ? '' : 's'} ago`
}

/**
 * The sentence. Bands rather than the number, because "score 63" tells a reader
 * nothing they can act on and "an act with legal force" tells them what it is.
 *
 * ## The thresholds are measured, not guessed
 *
 * They were first set at 70/45/25 by intuition, and a live sweep of 130 real
 * statements showed nothing at all reaching the top band: a UN sanctions
 * committee amending 21 entries scored 60, and a presidential instrument on
 * supply chains scored 58. Those *are* consequential, so an intuition that
 * called them merely "worth reading" was wrong — and a top band nothing can
 * reach is a band that does not exist.
 *
 * Refitted against that distribution. The scale is bounded above by design
 * (authority 30 + instrument 30 + corroboration 18 = 78 before any decay), so
 * a threshold of 70 was asking for a near-perfect score on a decaying value.
 */
function summarise(score: number, instrument: string | null, bodies: number): string {
  const corroborated = bodies > 1 ? `, and ${bodies} independent institutions are addressing it` : ''
  if (score >= 55) {
    return `Consequential${instrument ? ` — ${instrument.toLowerCase()}` : ''}${corroborated}. This is the kind of statement that changes what other parties do.`
  }
  if (score >= 35) {
    return `Worth reading${instrument ? ` — ${instrument.toLowerCase()}` : ''}${corroborated}. Substantive, without immediate force.`
  }
  if (score >= 18) {
    return `Routine institutional activity${instrument ? ` — ${instrument.toLowerCase()}` : ''}. Here for completeness rather than because it changes anything.`
  }
  return 'Low consequence — ceremonial, procedural, or too old to be acted on.'
}

/**
 * How many independent bodies are addressing each subject.
 *
 * Keyed by the distinctive words a headline shares with others, which is a
 * blunt instrument and is meant to be: precise topic modelling would be a
 * different project, and the question here is only "is more than one
 * institution talking about this today".
 */
export function corroborationBySubject(
  items: Array<{ sourceKey: string; headline: string }>,
): Map<string, number> {
  const bySubject = new Map<string, Set<string>>()
  for (const item of items) {
    for (const term of subjectTerms(item.headline)) {
      const bodies = bySubject.get(term) ?? new Set<string>()
      bodies.add(item.sourceKey)
      bySubject.set(term, bodies)
    }
  }
  const out = new Map<string, number>()
  for (const item of items) {
    let best = 1
    for (const term of subjectTerms(item.headline)) {
      best = Math.max(best, bySubject.get(term)?.size ?? 1)
    }
    out.set(item.headline, best)
  }
  return out
}

/**
 * The words in a headline that could identify a subject.
 *
 * Capitalised words and long ones — a proper noun or a substantive term is what
 * two institutions writing about the same thing will share. Common words are
 * dropped, because "statement" appearing in nine headlines is not nine bodies
 * addressing one subject.
 */
const NOISE = new Set([
  'statement', 'joint', 'press', 'release', 'news', 'daily', 'meeting', 'report',
  'session', 'general', 'secretary', 'president', 'minister', 'commission',
  'council', 'committee', 'board', 'office', 'about', 'after', 'their', 'which',
  'during', 'other', 'first', 'today', 'international', 'national', 'european',
])

function subjectTerms(headline: string): string[] {
  const words = headline.match(/[A-Za-z؀-ۿ][\w؀-ۿ-]{4,}/g) ?? []
  return [...new Set(words.map((w) => w.toLowerCase()))].filter((w) => !NOISE.has(w)).slice(0, 8)
}
