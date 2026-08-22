/**
 * One language, one name — so a count of languages counts languages.
 *
 * ## The measurement that produced this
 *
 * The broadcasts gateway's headline claim is the one no radio directory makes:
 * **how many distinct languages a place is transmitting in right now**. Walked
 * in a real browser against Saudi Arabia, the page said seven, and listed them:
 *
 * ```
 * ar · arabi · arabic · العربية · english · filipino · kurdish
 * ```
 *
 * Four of those seven are Arabic. The honest answer is four languages, and the
 * product was overstating its own headline number by 75% — on the one figure it
 * exists to provide. The global sample had the same shape: `persian`, `irani`
 * and `iranian` counted three times, `english` and `american english` twice.
 *
 * This is the charter's §2a discipline applied where it is easiest to miss.
 * There, the rule is that publishers are not integrations and neither is an
 * independent origin. Here it is the same rule one level down: **a spelling is
 * not a language.** A platform that inflates "sources" by counting mirrors and
 * a platform that inflates "languages" by counting transliterations are making
 * the identical mistake, and this project exists partly to refuse it.
 *
 * ## What this does not do
 *
 * It does not drop what it fails to recognise. An unrecognised name is a
 * language we could not identify, not an absence — Luganda came back from the
 * live catalogue and belongs in the count whether or not a table here knows it.
 * Unknown names are normalised for case and kept, so the count can be too high
 * by a spelling we have not seen but never too low by one we discarded.
 */

/**
 * ISO 639-1, the two-letter codes, mapped to the English name.
 *
 * The full set rather than a convenient subset, because the catalogue is
 * community-maintained and a station in any language may write its code instead
 * of its name — which is exactly what `ar` did.
 */
const ISO_639_1: Record<string, string> = {
  aa: 'afar', ab: 'abkhazian', ae: 'avestan', af: 'afrikaans', ak: 'akan',
  am: 'amharic', an: 'aragonese', ar: 'arabic', as: 'assamese', av: 'avaric',
  ay: 'aymara', az: 'azerbaijani', ba: 'bashkir', be: 'belarusian', bg: 'bulgarian',
  bh: 'bihari', bi: 'bislama', bm: 'bambara', bn: 'bengali', bo: 'tibetan',
  br: 'breton', bs: 'bosnian', ca: 'catalan', ce: 'chechen', ch: 'chamorro',
  co: 'corsican', cr: 'cree', cs: 'czech', cu: 'church slavonic', cv: 'chuvash',
  cy: 'welsh', da: 'danish', de: 'german', dv: 'divehi', dz: 'dzongkha',
  ee: 'ewe', el: 'greek', en: 'english', eo: 'esperanto', es: 'spanish',
  et: 'estonian', eu: 'basque', fa: 'persian', ff: 'fulah', fi: 'finnish',
  fj: 'fijian', fo: 'faroese', fr: 'french', fy: 'western frisian', ga: 'irish',
  gd: 'scottish gaelic', gl: 'galician', gn: 'guarani', gu: 'gujarati', gv: 'manx',
  ha: 'hausa', he: 'hebrew', hi: 'hindi', ho: 'hiri motu', hr: 'croatian',
  ht: 'haitian creole', hu: 'hungarian', hy: 'armenian', hz: 'herero', ia: 'interlingua',
  id: 'indonesian', ie: 'interlingue', ig: 'igbo', ii: 'sichuan yi', ik: 'inupiaq',
  io: 'ido', is: 'icelandic', it: 'italian', iu: 'inuktitut', ja: 'japanese',
  jv: 'javanese', ka: 'georgian', kg: 'kongo', ki: 'kikuyu', kj: 'kuanyama',
  kk: 'kazakh', kl: 'kalaallisut', km: 'khmer', kn: 'kannada', ko: 'korean',
  kr: 'kanuri', ks: 'kashmiri', ku: 'kurdish', kv: 'komi', kw: 'cornish',
  ky: 'kyrgyz', la: 'latin', lb: 'luxembourgish', lg: 'luganda', li: 'limburgish',
  ln: 'lingala', lo: 'lao', lt: 'lithuanian', lu: 'luba-katanga', lv: 'latvian',
  mg: 'malagasy', mh: 'marshallese', mi: 'maori', mk: 'macedonian', ml: 'malayalam',
  mn: 'mongolian', mr: 'marathi', ms: 'malay', mt: 'maltese', my: 'burmese',
  na: 'nauru', nb: 'norwegian', nd: 'north ndebele', ne: 'nepali', ng: 'ndonga',
  nl: 'dutch', nn: 'norwegian', no: 'norwegian', nr: 'south ndebele', nv: 'navajo',
  ny: 'chichewa', oc: 'occitan', oj: 'ojibwe', om: 'oromo', or: 'odia',
  os: 'ossetian', pa: 'punjabi', pi: 'pali', pl: 'polish', ps: 'pashto',
  pt: 'portuguese', qu: 'quechua', rm: 'romansh', rn: 'kirundi', ro: 'romanian',
  ru: 'russian', rw: 'kinyarwanda', sa: 'sanskrit', sc: 'sardinian', sd: 'sindhi',
  se: 'northern sami', sg: 'sango', si: 'sinhala', sk: 'slovak', sl: 'slovenian',
  sm: 'samoan', sn: 'shona', so: 'somali', sq: 'albanian', sr: 'serbian',
  ss: 'swati', st: 'southern sotho', su: 'sundanese', sv: 'swedish', sw: 'swahili',
  ta: 'tamil', te: 'telugu', tg: 'tajik', th: 'thai', ti: 'tigrinya',
  tk: 'turkmen', tl: 'tagalog', tn: 'tswana', to: 'tongan', tr: 'turkish',
  ts: 'tsonga', tt: 'tatar', tw: 'twi', ty: 'tahitian', ug: 'uyghur',
  uk: 'ukrainian', ur: 'urdu', uz: 'uzbek', ve: 'venda', vi: 'vietnamese',
  vo: 'volapuk', wa: 'walloon', wo: 'wolof', xh: 'xhosa', yi: 'yiddish',
  yo: 'yoruba', za: 'zhuang', zh: 'chinese', zu: 'zulu',
}

/**
 * Names that are the same language written differently.
 *
 * Three kinds, and each was observed in live catalogue data rather than
 * imagined: the language's own name for itself (`العربية`), a demonym standing
 * in for the language (`iranian` for Persian, which is a different word for a
 * different thing and universally used for this), and a plain misspelling or
 * truncation (`arabi`).
 *
 * Entries are added when a real feed produces them. Guessing at variants nobody
 * publishes would make this table look thorough and be untested.
 */
const ALIASES: Record<string, string> = {
  // Endonyms.
  'العربية': 'arabic',
  'عربي': 'arabic',
  'عربية': 'arabic',
  'فارسی': 'persian',
  中文: 'chinese',
  普通话: 'chinese',
  日本語: 'japanese',
  한국어: 'korean',
  русский: 'russian',
  ελληνικά: 'greek',
  עברית: 'hebrew',
  हिन्दी: 'hindi',
  ไทย: 'thai',
  español: 'spanish',
  français: 'french',
  português: 'portuguese',
  deutsch: 'german',
  italiano: 'italian',
  nederlands: 'dutch',
  türkçe: 'turkish',
  polski: 'polish',
  svenska: 'swedish',
  suomi: 'finnish',
  norsk: 'norwegian',
  dansk: 'danish',
  čeština: 'czech',
  magyar: 'hungarian',
  українська: 'ukrainian',
  // Demonyms and common alternative names.
  farsi: 'persian',
  irani: 'persian',
  iranian: 'persian',
  mandarin: 'chinese',
  cantonese: 'chinese',
  castilian: 'spanish',
  flemish: 'dutch',
  filipino: 'tagalog',
  bahasa: 'indonesian',
  'bahasa indonesia': 'indonesian',
  'bahasa melayu': 'malay',
  // Misspellings and truncations seen in the live catalogue.
  arabi: 'arabic',
  englsh: 'english',
  spanich: 'spanish',
}

/**
 * Regional qualifiers that name a variety, not a language.
 *
 * "American English" and "English" are one language on any count that means
 * anything. The qualifier is dropped only when what remains is a language we
 * recognise, so "Sign Language" is never reduced to "Language".
 */
const VARIETY_QUALIFIERS = [
  'american', 'british', 'australian', 'canadian', 'indian', 'nigerian',
  'brazilian', 'european', 'latin', 'modern', 'standard', 'classical',
  'traditional', 'simplified', 'egyptian', 'levantine', 'gulf', 'moroccan',
]

/**
 * Languages with no ISO 639-1 code that are nonetheless broadcast in.
 *
 * The two-letter list is small and old: it has a code for Volapük and none for
 * Cebuano, which about twenty million people speak and several catalogued
 * stations broadcast in. Anything reached only through 639-2 or 639-3 would
 * otherwise be unrecognised here.
 *
 * More than completeness, this is a **safety** list for the prefix rule below.
 * `romani` is a real language and a prefix of `romanian`; unless Romani is a
 * canonical name in its own right, the truncation fold would quietly turn every
 * Romani-language station into a Romanian one — merging a spelling is the goal,
 * erasing a language is the opposite of it. The test for that case is the
 * reason this list exists at all.
 */
const NO_CODE_LANGUAGES = [
  'romani', 'cebuano', 'hiligaynon', 'ilocano', 'waray', 'kapampangan',
  'chavacano', 'papiamento', 'sranan tongo', 'krio', 'nigerian pidgin',
  'jamaican patois', 'haitian creole', 'kabyle', 'tachelhit', 'tamazight',
  'kurmanji', 'sorani', 'dari', 'balochi', 'brahui', 'saraiki',
  'konkani', 'tulu', 'bhojpuri', 'awadhi', 'maithili', 'chhattisgarhi',
  'hakka', 'hokkien', 'teochew', 'shanghainese',
  'tigre', 'wolaytta', 'sidamo', 'afaan oromo', 'kirundi',
  'luo', 'kamba', 'kalenjin', 'meru', 'ewe', 'ga', 'dagbani', 'fante',
  'bemba', 'nyanja', 'tumbuka', 'lozi', 'tonga',
  'quichua', 'aymara', 'guarani', 'nahuatl', 'mayan', 'mixtec', 'zapotec',
  'sign language',
]

/** Every canonical name this module can produce, for the prefix rule. */
const CANONICAL = new Set([
  ...Object.values(ISO_639_1),
  ...Object.values(ALIASES),
  ...NO_CODE_LANGUAGES,
])

/** Title Case for display: `arabic` → `Arabic`, `haitian creole` → `Haitian Creole`. */
function titleCase(s: string): string {
  return s.replace(/(^|[\s-])([\p{Ll}])/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

/**
 * The canonical display name for one language as a publisher wrote it.
 *
 * Returns `null` only for a string that names nothing at all — empty, or
 * punctuation. Anything else comes back as a language, recognised or not.
 */
export function canonicalLanguage(raw: string): string | null {
  const cleaned = raw
    .normalize('NFC')
    .toLowerCase()
    .replace(/[()[\]{}.,;:!?"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  // A bare number or symbol is not a language name.
  if (!/[\p{L}]/u.test(cleaned)) return null

  if (CANONICAL.has(cleaned)) return titleCase(cleaned)
  if (ALIASES[cleaned]) return titleCase(ALIASES[cleaned])
  if (ISO_639_1[cleaned]) return titleCase(ISO_639_1[cleaned])

  // "american english" → "english", but only when the remainder is a language.
  const words = cleaned.split(' ')
  if (words.length > 1 && VARIETY_QUALIFIERS.includes(words[0])) {
    const rest = words.slice(1).join(' ')
    const resolved = CANONICAL.has(rest) ? rest : ALIASES[rest]
    if (resolved) return titleCase(resolved)
  }

  /**
   * A truncation, folded only when it can mean one thing.
   *
   * `arabi` is a prefix of exactly one canonical name, so it is Arabic. The
   * four-character floor and the uniqueness test are both load-bearing: `ara`
   * would also match Aragonese, and a two-letter fragment matches dozens.
   *
   * This runs **after** the exact lookups, and that order is the guard against
   * the obvious way it could go wrong. `romani` is a prefix of `romanian`; it
   * is also a language in its own right, so as long as it is a canonical name
   * the exact match wins and the prefix rule never sees it. A real language
   * that this module does not know and that happens to be a prefix of one it
   * does is the residual risk, and it is why the table exists.
   */
  if (cleaned.length >= 4 && !cleaned.includes(' ')) {
    const starts = [...CANONICAL].filter((c) => c.startsWith(cleaned))
    if (starts.length === 1) return titleCase(starts[0])
  }

  // Unrecognised, and kept. Luganda is a language whether or not we knew it.
  return titleCase(cleaned)
}

/**
 * The distinct languages in a set of publisher-written names, sorted.
 *
 * This is the function a count should be taken from. Counting the raw strings
 * is what produced "seven languages" for a place broadcasting in four.
 */
export function distinctLanguages(names: Iterable<string>): string[] {
  const out = new Set<string>()
  for (const n of names) {
    const c = canonicalLanguage(n)
    if (c) out.add(c)
  }
  return [...out].sort()
}
