/**
 * Translation dictionaries. Lambda NX is built to support every language: add a
 * locale by adding its code to LOCALES and a dictionary here — the provider,
 * switcher and RTL handling pick it up automatically. English is the fallback,
 * so a missing key never breaks the UI.
 *
 * (User-generated and source content is already language-agnostic: the engine,
 * the AI analyst and the news/nexus gateways handle any language of input.)
 */
export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

/** Right-to-left locales. */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(['ar'])

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
}

type Dict = Record<string, string>

const en: Dict = {
  'app.tagline': 'Intelligence platform',
  'badge.passiveLawful': 'Passive · Lawful',
  'feed.hero.title': 'Investigate anything — one query, full dossier',
  'feed.hero.sub': 'domain · IP · email · company · wallet · hash — every gateway at once, in an instant',
  'feed.open': 'Open',
  'nav.ideas': 'Ideas',
  'nav.calibration': 'Score',
  'nav.globe': 'Globe',
  'nav.monitor': 'Monitor',
  'ideas.title': 'Ideas & feedback',
  'ideas.subtitle':
    'Suggest features, improvements, integrations or data sources. Every idea is auto-triaged and clustered; the most-wanted rise to the top.',
  'ideas.form.title': 'Title',
  'ideas.form.titlePlaceholder': 'A short, clear summary',
  'ideas.form.body': 'Details',
  'ideas.form.bodyPlaceholder': 'What should we build, improve or fix — and why it matters',
  'ideas.form.kind': 'Type',
  'ideas.submit': 'Send suggestion',
  'ideas.submitting': 'Sending…',
  'ideas.thanks': 'Thank you — your idea was received and triaged.',
  'ideas.top': 'Most wanted',
  'ideas.demand': 'asks',
  'ideas.votes': 'votes',
  'ideas.vote': 'Upvote',
  'ideas.empty': 'No suggestions yet. Be the first — your idea shapes the roadmap.',
  'ideas.needDb': 'The suggestions store is not configured yet (it comes online at deploy). You can still write below.',
  'kind.feature': 'Feature',
  'kind.improvement': 'Improvement',
  'kind.bug': 'Bug',
  'kind.integration': 'Integration',
  'kind.data_source': 'Data source',
  'kind.other': 'Other',
  'common.error': 'Something went wrong',
}

const ar: Dict = {
  'app.tagline': 'منصّة استخبارات',
  'badge.passiveLawful': 'سلبي · قانوني',
  'feed.hero.title': 'حقّق في أي شيء — استعلام واحد، ملفّ كامل',
  'feed.hero.sub': 'نطاق · IP · بريد · شركة · محفظة · بصمة — كل البوّابات دفعةً واحدة، في لحظة',
  'feed.open': 'افتح',
  'nav.ideas': 'أفكار',
  'nav.calibration': 'الدقّة',
  'nav.globe': 'الكرة',
  'nav.monitor': 'مراقبة',
  'ideas.title': 'الأفكار والملاحظات',
  'ideas.subtitle':
    'اقترح ميزات أو تحسينات أو تكاملات أو مصادر بيانات. كل فكرة تُصنَّف وتُجمَّع تلقائيًا، والأكثر طلبًا يتصدّر.',
  'ideas.form.title': 'العنوان',
  'ideas.form.titlePlaceholder': 'ملخّص قصير وواضح',
  'ideas.form.body': 'التفاصيل',
  'ideas.form.bodyPlaceholder': 'ما الذي نبنيه أو نحسّنه أو نصلحه — ولماذا هو مهم',
  'ideas.form.kind': 'النوع',
  'ideas.submit': 'إرسال الاقتراح',
  'ideas.submitting': 'جارٍ الإرسال…',
  'ideas.thanks': 'شكرًا — استُلمت فكرتك وصُنّفت.',
  'ideas.top': 'الأكثر طلبًا',
  'ideas.demand': 'طلب',
  'ideas.votes': 'صوت',
  'ideas.vote': 'تصويت',
  'ideas.empty': 'لا اقتراحات بعد. كن الأول — فكرتك تصنع خارطة الطريق.',
  'ideas.needDb': 'مخزن الاقتراحات غير مُهيّأ بعد (يعمل عند النشر). يمكنك الكتابة أدناه.',
  'kind.feature': 'ميزة',
  'kind.improvement': 'تحسين',
  'kind.bug': 'خلل',
  'kind.integration': 'تكامل',
  'kind.data_source': 'مصدر بيانات',
  'kind.other': 'أخرى',
  'common.error': 'حدث خطأ ما',
}

export const DICTIONARIES: Record<Locale, Dict> = { en, ar }
