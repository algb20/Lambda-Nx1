import type { EventCategory } from '../modules/world-events-shared'

/**
 * What a headline is about.
 *
 * ## The problem this solves
 *
 * Roughly eighty of our sources are general newsrooms — DW, El País, Folha,
 * The Hindu, Al Jazeera, Punch, Dawn. Their catalogue record can only declare
 * `topics: ['news']`, because that is the truth: a general feed publishes an
 * earthquake, a central-bank decision and a football result in the same hour.
 * Categorising by source therefore files all of it as `world`, and on the live
 * board that came to **1,512 items — 52% of everything**, with real seismic and
 * health reporting buried inside it.
 *
 * The information is right there in the headline. Nothing was reading it.
 *
 * ## What this is, precisely
 *
 * A lexicon over the title text. It is a **signal, not an audit** — the same
 * caveat recorded in `docs/UNREACHED.md` about keyword-based capability
 * detection, and it applies to us exactly as it applies to our survey of
 * others. A headline saying "the earthquake in Turkish politics" will score
 * seismic. That is a real error rate and it is why the threshold exists.
 *
 * Three properties make it defensible rather than a guess:
 *
 *  1. **It abstains.** Below the threshold the answer is `null` and the caller
 *     keeps `world`. A general political headline *is* world news; forcing
 *     every item into a specific bucket would trade one dishonest label for
 *     twenty-three.
 *  2. **It is multilingual by construction.** Our feeds publish in Arabic,
 *     Spanish, Portuguese, French and German. An English-only lexicon would
 *     classify the English-language press and quietly file the rest as
 *     `world` — a bias that would look like editorial judgement and would
 *     actually be a missing dictionary.
 *  3. **Specific beats general.** `earthquake` outranks `disaster`, so a
 *     headline naming both is filed by the more informative word.
 *
 * ## Why not a model
 *
 * A model would be better and we cannot have one here: this runs inside a
 * request that already sweeps 120 feeds, on a host with no GPU, for users who
 * may have no API key at all. A lexicon runs in microseconds, is inspectable
 * line by line, and is wrong in ways a reader can predict. The AI-analyst layer
 * re-reads the same items when a key is present; this is the floor, not the
 * ceiling.
 */

/** A term and what it implies, with the weight its specificity earns. */
interface Term {
  /** Lower-cased substring. Matched on a word boundary where the script has one. */
  match: string
  category: EventCategory
  /** 2 = names the event type outright. 1 = suggestive, needs a second hit. */
  weight: 1 | 2
}

/**
 * Terms in the languages our sources actually publish in.
 *
 * Ordered by category rather than alphabetically, because the maintenance
 * question is always "what else means conflict" and never "what starts with c".
 */
const TERMS: Term[] = [
  // ── Armed conflict ────────────────────────────────────────────────────────
  ...t('conflict', 2, [
    'airstrike', 'air strike', 'shelling', 'offensive', 'ceasefire', 'insurgent',
    'militant', 'militia', 'gunmen', 'armed group', 'war crimes', 'troops',
    'missile', 'drone strike', 'rebel', 'jihadist', 'bombing',
    'غارة', 'قصف', 'اشتباك', 'هدنة', 'مسلح', 'صاروخ', 'إرهاب', 'مقاتل',
    'bombardeo', 'alto el fuego', 'militante', 'ataque aéreo',
    'bombardeio', 'cessar-fogo',
    'frappe', 'cessez-le-feu', 'milice',
    'luftangriff', 'waffenruhe',
  ]),
  // `terrorist` sits at weight 1 rather than 2 because it qualifies as often as
  // it describes: "terrorist financiers" in a securities-enforcement story is
  // finance, not fighting. Paired with any other conflict term it still
  // reaches the threshold; alone it abstains, which is the right answer.
  ...t('conflict', 1, [
    'killed', 'soldiers', 'army', 'attack', 'terrorist',
    'قتلى', 'جيش', 'هجوم', 'إرهابي', 'muertos', 'mortos', 'armée',
  ]),

  // ── Cyber ─────────────────────────────────────────────────────────────────
  ...t('cyber', 2, [
    'ransomware', 'malware', 'phishing', 'data breach', 'cyberattack',
    'cyber attack', 'zero-day', 'vulnerability', 'botnet', 'ddos', 'spyware',
    'هجوم سيبراني', 'اختراق', 'برمجية خبيثة', 'تسريب بيانات',
    'ciberataque', 'ciberataque', 'cyberattaque', 'cyberangriff',
  ]),
  ...t('cyber', 1, ['hackers', 'encryption', 'قراصنة', 'piratas informáticos']),

  // ── Economy & markets ─────────────────────────────────────────────────────
  ...t('economy', 2, [
    'inflation', 'interest rate', 'central bank', 'gdp', 'recession',
    'unemployment', 'tariff', 'trade deficit', 'bond yield', 'stock market',
    'currency', 'budget deficit', 'sanctions', 'imf', 'world bank',
    'تضخم', 'أسعار الفائدة', 'البنك المركزي', 'ركود', 'بطالة', 'عقوبات', 'تعريفة',
    'inflación', 'tasa de interés', 'banco central', 'recesión', 'desempleo', 'aranceles',
    'inflação', 'juros', 'banco central', 'desemprego',
    'inflation', 'banque centrale', 'chômage',
    'zinssatz', 'zentralbank', 'arbeitslosigkeit',
  ]),
  ...t('economy', 1, ['exports', 'imports', 'investors', 'صادرات', 'واردات', 'exportaciones', 'exportações']),

  // ── Energy & power ────────────────────────────────────────────────────────
  ...t('energy', 2, [
    'power grid', 'blackout', 'power outage', 'oil price', 'opec', 'refinery',
    // Qualified, because "Pipeline Road" is a street in Kochi and the bare word
    // filed a municipal encroachment story under energy.
    'oil pipeline', 'gas pipeline', 'pipeline rupture', 'pipeline explosion',
    'nuclear plant', 'electricity supply', 'gas supply',
    'انقطاع الكهرباء', 'الشبكة الكهربائية', 'مصفاة', 'أنبوب النفط', 'أسعار النفط',
    'apagón', 'red eléctrica', 'refinería',
    'apagão', 'refinaria',
    'panne de courant', 'raffinerie',
    'stromausfall', 'raffinerie',
  ]),

  // ── Transport ─────────────────────────────────────────────────────────────
  ...t('transport', 2, [
    'plane crash', 'derailment', 'shipwreck', 'airport closed', 'flight cancell',
    'ground stop', 'runway', 'cargo ship', 'port closure', 'rail strike',
    'تحطم طائرة', 'خروج قطار عن مساره', 'غرق سفينة', 'إغلاق مطار',
    'accidente aéreo', 'descarrilamiento', 'naufragio',
    'acidente aéreo', 'descarrilamento', 'naufrágio',
    'crash aérien', 'déraillement', 'naufrage',
    'flugzeugabsturz', 'entgleisung',
  ]),

  // ── Science & research ────────────────────────────────────────────────────
  ...t('research', 2, [
    'study finds', 'researchers', 'peer-reviewed', 'clinical trial', 'preprint',
    'scientists say', 'published in nature', 'telescope', 'genome',
    'دراسة', 'باحثون', 'تجربة سريرية', 'علماء',
    'investigadores', 'ensayo clínico', 'científicos',
    'pesquisadores', 'cientistas',
    'chercheurs', 'essai clinique',
    'forscher', 'studie',
  ]),

  // ── Health ────────────────────────────────────────────────────────────────
  ...t('health', 2, [
    'outbreak', 'epidemic', 'pandemic', 'cholera', 'measles', 'ebola', 'malaria',
    'dengue', 'influenza', 'vaccination campaign', 'quarantine', 'mpox',
    'تفشي', 'وباء', 'كوليرا', 'حصبة', 'ملاريا', 'إيبولا', 'تطعيم', 'حجر صحي',
    'brote', 'epidemia', 'sarampión', 'vacunación',
    'surto', 'epidemia', 'sarampo', 'vacinação',
    'épidémie', 'rougeole', 'vaccination',
    'ausbruch', 'epidemie', 'masern',
  ]),

  // ── Geophysical & weather — the categories that were being buried ─────────
  ...t('seismic', 2, [
    'earthquake', 'magnitude', 'aftershock', 'seismic',
    'زلزال', 'هزة أرضية', 'ارتدادية',
    'terremoto', 'sismo', 'réplica',
    'tremblement de terre', 'séisme',
    'erdbeben',
  ]),
  ...t('volcano', 2, [
    'volcano', 'eruption', 'lava', 'ash cloud',
    'بركان', 'ثوران', 'حمم',
    'volcán', 'erupción', 'vulcão', 'erupção',
    'volcan', 'éruption', 'vulkan', 'ausbruch des vulkans',
  ]),
  ...t('tsunami', 2, ['tsunami', 'tidal wave', 'تسونامي', 'موجة مد']),
  ...t('flood', 2, [
    'flood', 'flooding', 'deluge', 'inundation', 'burst its banks',
    'فيضان', 'سيول', 'غمر',
    'inundación', 'inundações', 'enchente', 'alagamento',
    'inondation', 'überschwemmung', 'hochwasser',
  ]),
  ...t('wildfire', 2, [
    'wildfire', 'bushfire', 'forest fire', 'blaze burn',
    'حريق غابات', 'حرائق',
    'incendio forestal', 'incêndio florestal',
    'feu de forêt', 'waldbrand',
  ]),
  ...t('storm', 2, [
    'hurricane', 'typhoon', 'cyclone', 'tornado', 'blizzard', 'severe storm',
    'إعصار', 'عاصفة', 'زوبعة',
    'huracán', 'tifón', 'ciclón', 'tormenta',
    'furacão', 'tufão', 'ciclone', 'tempestade',
    'ouragan', 'tempête', 'wirbelsturm', 'sturm',
  ]),
  ...t('drought', 2, ['drought', 'جفاف', 'sequía', 'seca', 'sécheresse', 'dürre']),
  ...t('landslide', 2, [
    'landslide', 'mudslide', 'rockfall',
    'انهيار أرضي', 'deslizamiento', 'deslizamento', 'glissement de terrain', 'erdrutsch',
  ]),
  ...t('temperature', 2, [
    'heatwave', 'heat wave', 'cold snap', 'record temperature',
    'موجة حر', 'موجة برد', 'ola de calor', 'onda de calor', 'canicule', 'hitzewelle',
  ]),
  ...t('space', 2, [
    'solar flare', 'geomagnetic storm', 'asteroid', 'spacecraft', 'satellite launch',
    'توهج شمسي', 'كويكب', 'مركبة فضائية',
    'llamarada solar', 'asteroide', 'astronave',
    'éruption solaire', 'sonneneruption',
  ]),

  // ── Humanitarian ──────────────────────────────────────────────────────────
  ...t('humanitarian', 2, [
    'refugees', 'displaced', 'famine', 'humanitarian crisis', 'aid convoy',
    'internally displaced', 'food insecurity',
    'لاجئين', 'نازحين', 'مجاعة', 'أزمة إنسانية', 'مساعدات إنسانية',
    'refugiados', 'desplazados', 'hambruna', 'crisis humanitaria',
    'deslocados', 'fome',
    'réfugiés', 'déplacés', 'famine',
    'flüchtlinge', 'hungersnot',
  ]),
]

function t(category: EventCategory, weight: 1 | 2, matches: string[]): Term[] {
  return matches.map((match) => ({ match: match.toLowerCase(), category, weight }))
}

/**
 * The score a headline must reach before it is filed anywhere but `world`.
 *
 * Set at 2, which one specific term reaches on its own and two suggestive ones
 * reach together. Lower would let a single word like "attack" — which appears
 * in headlines about tennis and about tax policy — decide a category. Higher
 * would require two specific terms in one headline, which real headlines
 * rarely contain, and the classifier would abstain on almost everything.
 */
const THRESHOLD = 2

/**
 * Scripts where a word boundary is meaningful.
 *
 * Latin and Cyrillic text needs `\bterm\b`, or `war` matches "warehouse" and
 * `ice` matches "police". Arabic is written without spaces around clitics — the
 * definite article and prepositions attach directly to the word — so a boundary
 * test there would reject the majority of correct matches. Chinese and Japanese
 * have no word separators at all. The rule is therefore chosen per term, by the
 * script the term is written in, rather than applied uniformly and wrongly.
 */
function hasBoundaries(term: string): boolean {
  return /^[\p{Script=Latin}\p{Script=Cyrillic}\s\d'-]+$/u.test(term)
}

const MATCHERS = TERMS.map((term) => ({
  ...term,
  test: hasBoundaries(term.match)
    ? new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(term.match)}(?:[^\\p{L}\\p{N}]|$)`, 'iu')
    : null,
}))

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface TopicVerdict {
  category: EventCategory
  score: number
  /** The terms that decided it, so a reader can check the machine's working. */
  matched: string[]
}

/**
 * Classify a headline, or abstain.
 *
 * Returns `null` when nothing reached the threshold — which is the common case
 * for general reporting and is the correct answer, not a failure.
 */
export function classifyHeadline(title: string): TopicVerdict | null {
  const text = title.toLowerCase()
  if (text.length < 8) return null

  const scores = new Map<EventCategory, { score: number; matched: string[] }>()
  for (const term of MATCHERS) {
    const hit = term.test ? term.test.test(text) : text.includes(term.match)
    if (!hit) continue
    const entry = scores.get(term.category) ?? { score: 0, matched: [] }
    entry.score += term.weight
    entry.matched.push(term.match)
    scores.set(term.category, entry)
  }

  let best: TopicVerdict | null = null
  for (const [category, entry] of scores) {
    if (entry.score < THRESHOLD) continue
    // Ties go to the category with more distinct evidence, then alphabetically
    // so the same headline always lands in the same place. A classifier whose
    // answer depends on Map iteration order is a classifier nobody can test.
    if (
      !best ||
      entry.score > best.score ||
      (entry.score === best.score && entry.matched.length > best.matched.length) ||
      (entry.score === best.score &&
        entry.matched.length === best.matched.length &&
        category < best.category)
    ) {
      best = { category, score: entry.score, matched: entry.matched }
    }
  }
  return best
}

/** How many terms the lexicon carries — reported by the diagnostics route. */
export function lexiconSize(): { terms: number; categories: number } {
  return { terms: TERMS.length, categories: new Set(TERMS.map((t) => t.category)).size }
}
