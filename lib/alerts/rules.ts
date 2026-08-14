/**
 * The alert rule language.
 *
 * ## Why a language at all, and why this one
 *
 * Comparable platforms alert on a threshold: magnitude above six, price below a
 * level, a keyword appearing. That is the right shape for a metrics tool and
 * the wrong shape for an intelligence platform, because it can only express
 * facts about the *world* and never about the *evidence* — and here the second
 * is often the more actionable of the two. "Wake me when three independent
 * origins agree" and "wake me when two sources contradict each other" are
 * questions no threshold alert can ask, and they are exactly the questions this
 * platform's data model can answer.
 *
 * So the language has fields for both: what happened, and how well we know it.
 *
 * ## Why it is data and not code
 *
 * The obvious implementation of a user-written condition is a small expression
 * evaluated at runtime, and it is the wrong one at any price. A rule is written
 * by a user, stored in our database, and evaluated on our server on a schedule
 * — which makes an expression evaluator a remote code execution primitive with
 * a persistence layer attached. There is no sandbox worth trusting for that.
 *
 * A rule here is therefore a **tree of typed comparisons**. There is no
 * evaluator to escape from because there is nothing to evaluate: the tree is
 * walked, each leaf compares one known field against one literal, and an
 * unknown field or operator is refused at validation time rather than
 * interpreted. The language is deliberately not Turing-complete and never will
 * be — no loops, no function calls, no property paths, no string interpolation.
 *
 * The cost is that some conditions cannot be expressed. That is the correct
 * trade: a user who needs something inexpressible gets a clear "unsupported"
 * message, which is a far better outcome than a platform that can be made to
 * run arbitrary code by anyone who signs up.
 */

/**
 * The subject an alert rule is evaluated against.
 *
 * Structural on purpose: a world event and a news story both produce one of
 * these, and neither module is imported here. That keeps this file free of the
 * engine (and therefore of `node:crypto`, so a client can validate a rule
 * before submitting it), and it means a new signal type becomes alertable by
 * writing a mapper rather than by touching the language.
 *
 * Every field is nullable because every field genuinely can be unknown, and
 * what a comparison does with an unknown is the subtlest decision in the file —
 * see `compare`.
 */
export interface AlertSubject {
  /** Stable identity, so a rule can be told not to fire twice on one thing. */
  id: string
  /** The headline or event title. */
  title: string
  /** Event category where there is one: 'seismic', 'flood', 'cyber-advisory'… */
  category: string | null
  country: string | null
  lat: number | null
  lon: number | null
  /** The measured magnitude, in the source's own unit. */
  magnitude: number | null
  /** 0–1, from a real measurement or an agency's own alert level. */
  severity: number | null
  /** How many independent origins reported it. Never how many outlets. */
  independentOrigins: number
  /** Our grade of the evidence: 'confirmed' | 'corroborated' | … */
  grade: string | null
  /** Admiralty source letter of the strongest report, e.g. 'A'. */
  sourceRating: string | null
  /** Source keys behind it. */
  sources: string[]
  /** True when reports of this subject disagree about something. */
  contested: boolean
  /** When it happened, per the source. Null when no source stated a time. */
  observedAt: string | null
  /** When we received it. Always known. */
  receivedAt: string
}

export const FIELDS = [
  'title',
  'category',
  'country',
  'magnitude',
  'severity',
  'independentOrigins',
  'grade',
  'sourceRating',
  'sources',
  'contested',
  'observedAt',
  'receivedAt',
  'location',
] as const

export type Field = (typeof FIELDS)[number]

export const OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
  'withinKm',
  'newerThanMinutes',
  'olderThanMinutes',
] as const

export type Operator = (typeof OPERATORS)[number]

/** A point and a radius — the value shape `withinKm` takes. */
export interface GeoValue {
  lat: number
  lon: number
  km: number
}

export type LeafValue = string | number | boolean | string[] | GeoValue

export interface Leaf {
  field: Field
  op: Operator
  value: LeafValue
}

export type Condition =
  | Leaf
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

export interface AlertRule {
  id: string
  name: string
  condition: Condition
  /** Off without being deleted — a rule that fired too much is usually paused. */
  enabled: boolean
}

// ── Validation ───────────────────────────────────────────────────────────────

export class RuleError extends Error {
  constructor(
    message: string,
    /** Where in the tree, e.g. "all[1].any[0]" — a rule can nest deeply. */
    readonly path: string,
  ) {
    super(path ? `${path}: ${message}` : message)
    this.name = 'RuleError'
  }
}

/**
 * Which operators each field accepts.
 *
 * The table is the type system of the language. Without it, `magnitude
 * contains "7"` would validate and then silently never match — a rule that
 * looks armed and is not, which is the worst failure an alert can have,
 * because the user learns about it only by missing the thing they were
 * watching for.
 */
const ALLOWED: Record<Field, readonly Operator[]> = {
  title: ['eq', 'neq', 'contains'],
  category: ['eq', 'neq', 'in'],
  country: ['eq', 'neq', 'in', 'contains'],
  magnitude: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  severity: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  independentOrigins: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  grade: ['eq', 'neq', 'in'],
  sourceRating: ['eq', 'neq', 'in'],
  sources: ['contains', 'in'],
  contested: ['eq'],
  observedAt: ['newerThanMinutes', 'olderThanMinutes'],
  receivedAt: ['newerThanMinutes', 'olderThanMinutes'],
  location: ['withinKm'],
}

/** Rules nest; a rule that nests this deep is a bug or an attack, not a query. */
export const MAX_DEPTH = 8

/** A branch with hundreds of arms is a denial-of-service dressed as a filter. */
export const MAX_BRANCH = 32

function isGeoValue(v: unknown): v is GeoValue {
  if (!v || typeof v !== 'object') return false
  const g = v as Record<string, unknown>
  return (
    typeof g.lat === 'number' &&
    typeof g.lon === 'number' &&
    typeof g.km === 'number' &&
    Number.isFinite(g.lat) &&
    Number.isFinite(g.lon) &&
    Number.isFinite(g.km) &&
    Math.abs(g.lat) <= 90 &&
    Math.abs(g.lon) <= 180 &&
    g.km > 0
  )
}

function validateLeaf(leaf: Leaf, path: string): void {
  if (!FIELDS.includes(leaf.field)) {
    throw new RuleError(`unknown field "${String(leaf.field)}"`, path)
  }
  if (!OPERATORS.includes(leaf.op)) {
    throw new RuleError(`unknown operator "${String(leaf.op)}"`, path)
  }
  const allowed = ALLOWED[leaf.field]
  if (!allowed.includes(leaf.op)) {
    throw new RuleError(
      `"${leaf.field}" does not support "${leaf.op}" (it accepts: ${allowed.join(', ')})`,
      path,
    )
  }

  switch (leaf.op) {
    case 'withinKm':
      if (!isGeoValue(leaf.value)) {
        throw new RuleError('withinKm needs { lat, lon, km } with a positive radius', path)
      }
      return
    case 'in':
      if (!Array.isArray(leaf.value) || leaf.value.length === 0) {
        throw new RuleError('"in" needs a non-empty list of values', path)
      }
      if (leaf.value.length > MAX_BRANCH) {
        throw new RuleError(`"in" accepts at most ${MAX_BRANCH} values`, path)
      }
      if (!leaf.value.every((v) => typeof v === 'string')) {
        throw new RuleError('"in" values must all be strings', path)
      }
      return
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'newerThanMinutes':
    case 'olderThanMinutes':
      if (typeof leaf.value !== 'number' || !Number.isFinite(leaf.value)) {
        throw new RuleError(`"${leaf.op}" needs a finite number`, path)
      }
      return
    case 'contains':
      if (typeof leaf.value !== 'string' || leaf.value.trim() === '') {
        throw new RuleError('"contains" needs a non-empty string', path)
      }
      return
    default:
      if (
        typeof leaf.value !== 'string' &&
        typeof leaf.value !== 'number' &&
        typeof leaf.value !== 'boolean'
      ) {
        throw new RuleError('value must be a string, number or boolean', path)
      }
  }
}

export function validateCondition(condition: Condition, path = '', depth = 0): void {
  if (depth > MAX_DEPTH) throw new RuleError(`nested deeper than ${MAX_DEPTH}`, path)
  if (!condition || typeof condition !== 'object') {
    throw new RuleError('condition must be an object', path)
  }

  if ('all' in condition || 'any' in condition) {
    const key = 'all' in condition ? 'all' : 'any'
    const arms = (condition as Record<string, unknown>)[key]
    if (!Array.isArray(arms) || arms.length === 0) {
      throw new RuleError(`"${key}" needs at least one condition`, path)
    }
    if (arms.length > MAX_BRANCH) {
      throw new RuleError(`"${key}" accepts at most ${MAX_BRANCH} conditions`, path)
    }
    arms.forEach((arm, i) =>
      validateCondition(arm as Condition, `${path}${path ? '.' : ''}${key}[${i}]`, depth + 1),
    )
    return
  }

  if ('not' in condition) {
    validateCondition(
      (condition as { not: Condition }).not,
      `${path}${path ? '.' : ''}not`,
      depth + 1,
    )
    return
  }

  validateLeaf(condition as Leaf, path)
}

// ── Evaluation ───────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371

/** Great-circle distance. Same maths as the fusion engine, for the same reason. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The unknown-value rule, which is the subtlest decision in this file.
 *
 * A comparison against a field the subject does not have returns **false**, and
 * never true. That is not obvious: one could argue an unknown magnitude should
 * satisfy `magnitude < 7`, since it might be. But an alert is a claim that
 * something *is* the case, and firing on a field we could not read would mean
 * waking someone at three in the morning on the strength of a missing value.
 *
 * The consequence is worth stating plainly, because it surprises people: a rule
 * excluding something — `NOT (country eq "X")` — will fire for a subject with
 * no country at all, because the inner comparison is false and the negation
 * makes it true. That is the correct reading. "This is not about X" is true of
 * something whose location is unknown; the user asked to be told when it is not
 * X, and an unknown place is not X.
 */
function compare(op: Operator, actual: unknown, expected: LeafValue, now: number): boolean {
  if (op === 'withinKm') return false // handled by the caller, which has both coords

  if (op === 'newerThanMinutes' || op === 'olderThanMinutes') {
    if (typeof actual !== 'string') return false
    const t = Date.parse(actual)
    if (!Number.isFinite(t)) return false
    const ageMinutes = (now - t) / 60_000
    return op === 'newerThanMinutes'
      ? ageMinutes <= (expected as number)
      : ageMinutes > (expected as number)
  }

  if (Array.isArray(actual)) {
    // The only array field is `sources`. `contains` asks whether one named
    // source is among them; `in` asks whether any of several are.
    const list = actual.map((v) => String(v).toLowerCase())
    if (op === 'contains') return list.includes(String(expected).toLowerCase())
    if (op === 'in') {
      const wanted = (expected as string[]).map((v) => v.toLowerCase())
      return list.some((v) => wanted.includes(v))
    }
    return false
  }

  if (actual === null || actual === undefined) return false

  switch (op) {
    case 'eq':
      return typeof actual === 'string' && typeof expected === 'string'
        ? actual.toLowerCase() === expected.toLowerCase()
        : actual === expected
    case 'neq':
      return typeof actual === 'string' && typeof expected === 'string'
        ? actual.toLowerCase() !== expected.toLowerCase()
        : actual !== expected
    case 'gt':
      return typeof actual === 'number' && actual > (expected as number)
    case 'gte':
      return typeof actual === 'number' && actual >= (expected as number)
    case 'lt':
      return typeof actual === 'number' && actual < (expected as number)
    case 'lte':
      return typeof actual === 'number' && actual <= (expected as number)
    case 'contains':
      return String(actual).toLowerCase().includes(String(expected).toLowerCase())
    case 'in':
      return (expected as string[]).some(
        (v) => v.toLowerCase() === String(actual).toLowerCase(),
      )
    default:
      return false
  }
}

function fieldValue(subject: AlertSubject, field: Field): unknown {
  switch (field) {
    case 'location':
      return null // read directly by the withinKm branch
    default:
      return subject[field as Exclude<Field, 'location'>]
  }
}

export function evaluate(
  condition: Condition,
  subject: AlertSubject,
  now: number = Date.now(),
): boolean {
  if ('all' in condition) {
    return (condition.all as Condition[]).every((c) => evaluate(c, subject, now))
  }
  if ('any' in condition) {
    return (condition.any as Condition[]).some((c) => evaluate(c, subject, now))
  }
  if ('not' in condition) {
    return !evaluate((condition as { not: Condition }).not, subject, now)
  }

  const leaf = condition as Leaf
  if (leaf.op === 'withinKm') {
    // A subject with no coordinate is not inside any radius. It is not outside
    // one either, but the alert asked "is it here", and we cannot say yes.
    if (subject.lat === null || subject.lon === null) return false
    const g = leaf.value as GeoValue
    return haversineKm(subject.lat, subject.lon, g.lat, g.lon) <= g.km
  }

  return compare(leaf.op, fieldValue(subject, leaf.field), leaf.value, now)
}

/**
 * The rule in words, for the interface and for the alert itself.
 *
 * An alert that arrives saying only "rule 7 matched" is an alert its recipient
 * has to go and look up, at whatever hour it arrived. The rule that fired
 * belongs in the message.
 */
export function describeCondition(condition: Condition): string {
  if ('all' in condition) {
    return (condition.all as Condition[]).map(describeCondition).join(' and ')
  }
  if ('any' in condition) {
    return `(${(condition.any as Condition[]).map(describeCondition).join(' or ')})`
  }
  if ('not' in condition) {
    return `not ${describeCondition((condition as { not: Condition }).not)}`
  }

  const leaf = condition as Leaf
  const phrase: Record<Operator, string> = {
    eq: 'is',
    neq: 'is not',
    gt: 'is above',
    gte: 'is at least',
    lt: 'is below',
    lte: 'is at most',
    contains: 'contains',
    in: 'is one of',
    withinKm: 'is within',
    newerThanMinutes: 'is newer than',
    olderThanMinutes: 'is older than',
  }

  if (leaf.op === 'withinKm') {
    const g = leaf.value as GeoValue
    return `location is within ${g.km} km of ${g.lat}, ${g.lon}`
  }
  if (leaf.op === 'newerThanMinutes' || leaf.op === 'olderThanMinutes') {
    return `${leaf.field} ${phrase[leaf.op]} ${leaf.value} minutes`
  }
  if (Array.isArray(leaf.value)) {
    return `${leaf.field} ${phrase[leaf.op]} ${leaf.value.join(', ')}`
  }
  return `${leaf.field} ${phrase[leaf.op]} ${String(leaf.value)}`
}

/**
 * Run every enabled rule over every subject.
 *
 * Deliberately quadratic and deliberately not optimised. The realistic load is
 * tens of rules over hundreds of subjects — thousands of comparisons, which is
 * microseconds — and an index would add a correctness surface for a saving
 * nobody would notice. If a deployment ever outgrows this, the fix is a
 * pre-filter on the cheapest leaf, not a rewrite.
 */
export function matchRules(
  rules: AlertRule[],
  subjects: AlertSubject[],
  now: number = Date.now(),
): Array<{ rule: AlertRule; subject: AlertSubject; because: string }> {
  const hits: Array<{ rule: AlertRule; subject: AlertSubject; because: string }> = []
  for (const rule of rules) {
    if (!rule.enabled) continue
    for (const subject of subjects) {
      if (evaluate(rule.condition, subject, now)) {
        hits.push({ rule, subject, because: describeCondition(rule.condition) })
      }
    }
  }
  return hits
}
